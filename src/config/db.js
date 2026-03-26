const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const maskedUri = process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@') : 'UNDEFINED';
        console.log(`[Database] Attempting to connect to: ${maskedUri}`);
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        console.error('Troubleshooting Tip: Make sure your current IP address is whitelisted in MongoDB Atlas.');
        process.exit(1);
    }
};

module.exports = connectDB;
