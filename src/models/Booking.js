const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    ride: {
        type: mongoose.Schema.ObjectId,
        ref: 'Ride',
        required: true
    },
    passenger: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    seats: {
        type: Number,
        default: 1,
        required: true,
        min: [1, 'Must book at least 1 seat']
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'cancelled'],
        default: 'pending'
    },
    cancellationReason: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
