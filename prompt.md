write a proper concise prompt to make a node js webapp and frontend also in js,html,css - to collect emails for waitlist of our product - falconlink - India’s First High-Performance Digital Drone Video Link.

you will get mongodb url and save the email in there. It should display the company vision,works also. make the color theme - modern and minimalistic , no need to mention the heading like problem , solution. it is not a pitch deck it is a website . make look professional - drone style -

Information about the company:

Name- ServaDrone. 

Write down your Elevator Pitch
India faces a void in core drone electronics, forcing costly imports. We’re building the first homegrown stack, a high-performance digital video link. We empower Indian makers to cut reliance on imports, ensure quality, and evolve from integrators to true technology owners.

Describe the problem you're addressing *
Explain the problem in not more than 50 words.
India lacks domestic manufacturing of core drone electronics. Reliance on imports for radio control, video transmission and propulsion causes high costs, delays, and quality risks. This void traps Indian companies as mere integrators, preventing them from transitioning into true 
technology leaders.

Describe the solution you're proposing *
Explain the solution in not more than 50 words. The solution is different from the Product you're developing.

We’re building a domestic ecosystem for core drone electronics via in-house design and local manufacturing. This cuts import reliance and costs while ensuring quality. Our modular architecture empowers Indian firms to evolve from assemblers to true technology creators who innovate.

Describe the offering you're developing (product/service/platform)

Servadrone builds India’s first sub-60ms latency with range up to 30km, Full HD digital video link. Our encrypted, modular system empowers FPV, cinema, and surveillance. By owning the full hardware and firmware stack, we deliver performance, security, and customization that imports cannot match.

Competitive Landscape
Global
DJI OcuSync – best-in-class, closed ecosystem


Walksnail Avatar – strong FPV competitor


Hollyland / Accsoon – cinema wireless links


India
No indigenous low-latency digital video link


Most rely on imported RF/video modules


No OEM-grade, customizable video-link provider

Our Edge
Full in-house RF + encoder stack
Lower latency, local optimization
Made in India → cost + policy advantage


Customizable for OEMs & enterprise
Vision
Build India’s first world-class drone-video-link platform—
 and grow into a global leader in high-performance drone hardware.





 ------------------------------------------------------------------------------------------------------

 using google sheet for collecting emails


server.js

 ```js
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
app.use('videos', express.static('videos'));
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
 ```

 above is a code for nodejs webapp to collect emails. it first read the data and get the number of entries. when email is added, first check for same entry, then add the new emails only. Right now mongodb is used. but use google sheet instead , credentials.json present in the same folder. and sheet ID is inside .env file as SHEET_ID variable. keep the same functionality , just change the mongodb in google sheet, datetime , and email should be recorded.






 add a highlight color , lik Miliwatt , we can highlight the watt using the color, mention this how to change I want to test with different color , select so that it match the design. now the website is focus on product and solution content , but focus on product instead, add minimal content for problem and solution , our product name is IRIS below is its specs:
 our drone communication system - IRIS with the following specifications:
1. Supported Camera Interfaces
HDMI input
USB (UVC)
CSI
Ethernet (RTSP/UDP from an onboard computer)
2. Telemetry Support
MAVLink
MSP
Custom message protocols
3. Video Performance
Resolution: 1080p at 90 FPS
Latency: ~50 ms
Range: Up to 7 km
Compression: H.264 / H.265
Bitrate: 20 Mbps (up to 4 km)
4. Ground Station (VRX)
Optional integrated display (handheld ground controller)
Machine-readable video output via Ethernet (RTSP/UDP) or USB
HDMI output
Additionally, several parameters such as physical size, range, and input/output configurations can be customized based on specific requirements. We also provide a complete SDK along with technical support for integration.

Get access to early sample or need customized product for your need. Send your query, 

Name, Name of company,email, sample number , expect number future orders
any query to us. make a form for the above, and when click submit upload the content to the sheet same as the join waitlist google sheet, for simply join waitlist will send empty entries for other fields.