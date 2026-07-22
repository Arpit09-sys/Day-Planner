/* ============================================================
   Day Planner — Express + MongoDB Atlas Server (v3.0)
   Supports: Tasks, Plans, Focus, User, Momentum
   ============================================================ */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// Use Google Public DNS to resolve MongoDB Atlas SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

const taskRoutes = require('./routes/tasks');
const planRoutes = require('./routes/plans');
const focusRoutes = require('./routes/focus');
const userRoutes = require('./routes/user');
const momentumRoutes = require('./routes/momentum');

const app = express();
const PORT = process.env.PORT || 5000;

/* ─── Middleware ─── */
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

/* ─── API Routes ─── */
app.use('/api/tasks', taskRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/user', userRoutes);
app.use('/api/momentum', momentumRoutes);

/* ─── Catch-all: serve index.html for any non-API route ─── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ─── Connect to MongoDB Atlas & Start Server ─── */
mongoose
  .connect(process.env.MONGODB_URI, {
    family: 4  // Force IPv4 — fixes DNS SRV resolution issues
  })
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
