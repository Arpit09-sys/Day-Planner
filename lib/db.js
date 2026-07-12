const mongoose = require('mongoose');

let cachedConnection = null;

/**
 * Reusable MongoDB connection for Vercel Serverless Functions.
 * Caches the connection across warm invocations to avoid
 * creating a new connection on every request.
 */
async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
    family: 4
  });

  console.log('✅ MongoDB connected (serverless)');
  return cachedConnection;
}

module.exports = connectDB;
