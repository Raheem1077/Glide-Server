const express = require('express');
const router = express.Router();
const {
    accessConversation,
    fetchConversations,
    sendMessage,
    allMessages,
    getUnreadCount,
    getTotalUnreadCount
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const uploadAudio = require('../middleware/uploadAudio');
const uploadMedia = require('../middleware/uploadMedia');

router.route('/')
    .post(protect, accessConversation)
    .get(protect, fetchConversations);

// Must be BEFORE /:id routes so "unread" isn't captured as an :id param
router.get('/unread', protect, getUnreadCount);
router.get('/unread-total', protect, getTotalUnreadCount);

router.post('/upload-audio', protect, uploadAudio.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const audioUrl = `/uploads/${req.file.filename}`;
    res.json({ audioUrl });
});

router.post('/upload-image', protect, uploadMedia.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

router.post('/upload-document', protect, uploadMedia.single('document'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No document uploaded' });
    res.json({ 
        documentUrl: `/uploads/${req.file.filename}`,
        documentName: req.file.originalname
    });
});

router.route('/:id/messages')
    .post(protect, sendMessage)
    .get(protect, allMessages);

module.exports = router;
