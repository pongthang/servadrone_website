const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/videos', express.static('videos'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Google Sheets Setup
let sheets;
let isConnected = false;
const SHEET_ID = process.env.SHEET_ID;

async function initializeGoogleSheets() {
  try {
    console.log('🔄 Initializing Google Sheets connection...');
    
    // Check if credentials file exists
    if (!fs.existsSync('credentials.json')) {
      throw new Error('credentials.json file not found');
    }

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync('credentials.json'));
    
    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    sheets = google.sheets({ version: 'v4', auth: authClient });

    // Verify connection
    if (!SHEET_ID) {
      throw new Error('SHEET_ID not found in .env file');
    }

    // Try to read the sheet to verify access
    await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:B1',
    });

    isConnected = true;
    console.log('✅ Google Sheets connected successfully');
    console.log('📋 Sheet ID:', SHEET_ID);

    // Initialize headers if sheet is empty
    await initializeSheetHeaders();

  } catch (error) {
    console.error('❌ Google Sheets connection error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if credentials.json exists in the project folder');
    console.error('   2. Verify SHEET_ID in .env file');
    console.error('   3. Ensure the service account has access to the Google Sheet');
    console.error('   4. Share the sheet with the service account email from credentials.json');
    isConnected = false;
  }
}

async function initializeSheetHeaders() {
  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:B1',
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A1:B1',
        valueInputOption: 'RAW',
        resource: {
          values: [['Email', 'DateTime']]
        }
      });
      console.log('📝 Sheet headers initialized');
    }
  } catch (error) {
    console.error('Error initializing headers:', error.message);
  }
}

async function getAllEmails() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:B',
    });

    const rows = response.data.values || [];
    
    // Skip header row and extract emails
    const emails = rows.slice(1).map(row => row[0]?.toLowerCase().trim()).filter(Boolean);
    
    return emails;
  } catch (error) {
    console.error('Error reading emails:', error.message);
    return [];
  }
}

async function addEmail(email) {
  try {
    const dateTime = new Date().toISOString();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:B',
      valueInputOption: 'RAW',
      resource: {
        values: [[email.toLowerCase(), dateTime]]
      }
    });

    return true;
  } catch (error) {
    console.error('Error adding email:', error.message);
    return false;
  }
}

async function getEmailCount() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:A',
    });

    const rows = response.data.values || [];
    // Subtract 1 for header row
    return Math.max(0, rows.length - 1);
  } catch (error) {
    console.error('Error counting emails:', error.message);
    return 0;
  }
}

// Initialize Google Sheets on startup
initializeGoogleSheets();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Subscribe endpoint
app.post('/api/subscribe', limiter, async (req, res) => {
  try {
    console.log('📧 Subscription request received:', req.body);

    // Check if Google Sheets is connected
    if (!isConnected) {
      console.error('❌ Google Sheets not connected');
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection unavailable. Please try again later.' 
      });
    }

    const { email } = req.body;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log('❌ Invalid email format:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address.' 
      });
    }

    // Check if email already exists
    const existingEmails = await getAllEmails();
    const normalizedEmail = email.toLowerCase().trim();
    
    if (existingEmails.includes(normalizedEmail)) {
      console.log('⚠️ Email already exists:', normalizedEmail);
      return res.status(409).json({ 
        success: false, 
        message: 'This email is already on our waitlist!' 
      });
    }

    // Add new email
    const added = await addEmail(normalizedEmail);
    
    if (!added) {
      console.error('❌ Failed to add email');
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to add email. Please try again.' 
      });
    }

    // Get total signups
    const totalSignups = await getEmailCount();
    
    console.log('✅ Email added successfully:', normalizedEmail, '| Total:', totalSignups);

    res.status(201).json({ 
      success: true, 
      message: 'Successfully joined the waitlist!',
      totalSignups 
    });

  } catch (error) {
    console.error('❌ Subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    // Check if Google Sheets is connected
    if (!isConnected) {
      return res.json({ totalSignups: 0, connected: false });
    }

    const totalSignups = await getEmailCount();
    res.json({ totalSignups, connected: true });
  } catch (error) {
    console.error('Stats error:', error);
    res.json({ totalSignups: 0, connected: false });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 FalconLink Waitlist running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📝 Make sure credentials.json exists and SHEET_ID is in .env`);
});