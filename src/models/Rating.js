const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    ride: {
        type: mongoose.Schema.ObjectId,
        ref: 'Ride',
        required: true
    },
    rater: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    ratee: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Rating', ratingSchema);
