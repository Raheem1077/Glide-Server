const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
        unique: true
    },
    university: {
        type: String,
        required: false
    },
    profilePicture: {
        type: String,
        default: 'https://via.placeholder.com/150'
    },
    role: {
        type: String,
        enum: ['driver', 'passenger', 'both', 'admin'],
        default: 'both'
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    car: {
        brand: String,
        model: String,
        plateNumber: String,
        color: String,
        carPicture: String
    },
    pushToken: {
        type: String,
        default: null
    },
    settings: {
        notifications: { type: Boolean, default: true },
        darkMode: { type: Boolean, default: false },
        language: { type: String, default: 'English' }
    }
}, {
    timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
