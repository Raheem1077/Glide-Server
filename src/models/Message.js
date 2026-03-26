const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }],
    ride: {
        type: mongoose.Schema.ObjectId,
        ref: 'Ride'
    },
    lastMessage: {
        text: String,
        sender: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        isRead: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'audio', 'image', 'document', 'location'],
        default: 'text'
    },
    text: {
        type: String,
        required: false
    },
    audioUrl: {
        type: String,
        required: false
    },
    imageUrl: {
        type: String,
        required: false
    },
    documentUrl: {
        type: String,
        required: false
    },
    documentName: {
        type: String,
        required: false
    },
    location: {
        latitude: Number,
        longitude: Number
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedFor: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };
