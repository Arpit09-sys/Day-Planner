/* ============================================================
   Day Planner — Express + MongoDB Atlas Server (v3.0)
   Supports: Tasks, Plans, Focus, User, Momentum
   Works both locally (npm run dev) and on Vercel (serverless)
   ============================================================ */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { requireAuth } = require('./lib/auth');

const taskRoutes = require('./routes/tasks');
const planRoutes = require('./routes/plans');
const focusRoutes = require('./routes/focus');
const userRoutes = require('./routes/user');
const momentumRoutes = require('./routes/momentum');
const notificationsRoutes = require('./routes/notifications');
const privacyRoutes = require('./routes/privacy');

const app = express();
const PORT = process.env.PORT || 3000;

/* ─── Middleware ─── */
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

/* ─── Lazy MongoDB connection (works for both local & serverless) ─── */
let cachedDb = null;
async function connectDB() {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  cachedDb = await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log('✅ Connected to MongoDB Atlas');
  return cachedDb;
}

// Ensure DB is connected before any API request
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

/* ─── API Routes ─── */
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/plans', requireAuth, planRoutes);
app.use('/api/focus', requireAuth, focusRoutes);
app.use('/api/momentum', requireAuth, momentumRoutes);
app.use('/api/privacy', requireAuth, privacyRoutes);

/* ─── Local development only: serve static files ─── */
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname)));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

/* ─── Start server (local only — Vercel handles this automatically) ─── */
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
