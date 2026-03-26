const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    from: {
        type: String,
        required: [true, 'Please add a pickup location'],
        enum: ['Sargodha', 'Lahore', 'Islamabad', 'Sialkot', 'Multan']
    },
    to: {
        type: String,
        required: [true, 'Please add a destination'],
        enum: ['Sargodha', 'Lahore', 'Islamabad', 'Sialkot', 'Multan']
    },
    date: {
        type: Date,
        required: [true, 'Please add a date']
    },
    time: {
        type: String,
        required: [true, 'Please add a time']
    },
    seats: {
        total: {
            type: Number,
            required: [true, 'Please add total seats'],
            min: [1, 'Must have at least 1 seat'],
            max: [7, 'Cannot exceed 7 seats']
        },
        available: {
            type: Number,
            required: true
        }
    },
    price: {
        type: Number,
        required: [true, 'Please add a price'],
        min: [1, 'Price must be greater than 0']
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    description: {
        type: String
    },
    route: {
        startCoords: {
             lat: Number,
             lng: Number
        },
        endCoords: {
             lat: Number,
             lng: Number
        }
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringDays: {
        type: [String]
    }
}, {
    timestamps: true
});

// Prevent a driver from having multiple 'active' rides simultaneously
rideSchema.index(
    { driver: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('Ride', rideSchema);
