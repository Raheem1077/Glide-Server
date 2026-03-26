const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // Automatically delete documents when they expire
    }
}, { timestamps: true });

module.exports = mongoose.model('OTP', otpSchema);
