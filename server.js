const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// MongoDB Connection - Accept both MONGODB_URL and MONGODB_URI
const MONGODB_URL = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/falconlink';

console.log('🔄 Attempting MongoDB connection...');
console.log('📍 Connection string:', MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));

mongoose.connect(MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Check if MongoDB is running (local) or connection string is correct (Atlas)');
  console.error('   2. Verify .env file has MONGODB_URL or MONGODB_URI');
  console.error('   3. For Atlas: Check IP whitelist and credentials');
  console.error('   4. Current connection attempt:', MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
});

// Email Schema
const emailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: String,
  userAgent: String
});

const Email = mongoose.model('Email', emailSchema);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Routes
app.post('/api/subscribe', limiter, async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection unavailable. Please try again later.' 
      });
    }

    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address.' 
      });
    }

    const existingEmail = await Email.findOne({ email: email.toLowerCase() });
    
    if (existingEmail) {
      return res.status(409).json({ 
        success: false, 
        message: 'This email is already on our waitlist!' 
      });
    }

    const newEmail = new Email({
      email: email.toLowerCase(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await newEmail.save();

    const totalSignups = await Email.countDocuments();

    res.status(201).json({ 
      success: true, 
      message: 'Successfully joined the waitlist!',
      totalSignups 
    });

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.json({ totalSignups: 0, connected: false });
    }

    const totalSignups = await Email.countDocuments();
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
});