const { Conversation, Message } = require('../models/Message');
const User = require('../models/User');

// @desc    Get or create conversation with a user
// @route   POST /api/chat
// @access  Private
const accessConversation = async (req, res) => {
    const { userId, rideId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "UserId param not sent with request" });
    }

    if (userId === req.user._id.toString()) {
        return res.status(400).json({ message: "You cannot chat with yourself" });
    }

    try {
        let isChat = await Conversation.find({
            $and: [
                { participants: { $elemMatch: { $eq: req.user._id } } },
                { participants: { $elemMatch: { $eq: userId } } }
            ]
        })
        .populate('participants', 'name profilePicture')
        .populate('lastMessage.sender', 'name profilePicture');

        if (isChat.length > 0) {
            if (rideId && !isChat[0].ride) {
                isChat[0].ride = rideId;
                await isChat[0].save();
            }
            res.json(isChat[0]);
        } else {
            var chatData = {
                participants: [req.user._id, userId],
                ride: rideId || null
            };

            const createdChat = await Conversation.create(chatData);
            const FullChat = await Conversation.findOne({ _id: createdChat._id }).populate(
                "participants",
                "name profilePicture"
            );
            res.status(200).json(FullChat);
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Fetch all conversations for a user
// @route   GET /api/chat
// @access  Private
const fetchConversations = async (req, res) => {
    try {
        const results = await Conversation.find({ 
            participants: { $elemMatch: { $eq: req.user._id } }
        })
            .populate("participants", "name profilePicture")
            .populate("lastMessage.sender", "name profilePicture")
            .sort({ updatedAt: -1 });
            
        const activeConversations = results.filter(c => c.lastMessage != null);
        res.status(200).send(activeConversations);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Create New Message
// @route   POST /api/chat/:id/messages
// @access  Private
const sendMessage = async (req, res) => {
    const { text } = req.body;
    const conversationId = req.params.id;

    if (!text || !conversationId) {
        return res.status(400).json({ message: "Invalid data passed into request" });
    }

    var newMessage = {
        sender: req.user._id,
        text: text,
        conversation: conversationId,
    };

    try {
        var message = await Message.create(newMessage);

        message = await message.populate("sender", "name profilePicture");
        message = await message.populate("conversation");

            await Conversation.findByIdAndUpdate(req.params.id, {
                lastMessage: {
                    text: text,
                    sender: req.user._id,
                    createdAt: Date.now(),
                    isRead: false
                },
            });

        res.json(message);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all Messages
// @route   GET /api/chat/:id/messages
// @access  Private
const allMessages = async (req, res) => {
    try {
        const messages = await Message.find({ conversation: req.params.id })
            .populate("sender", "name profilePicture email")
            .populate("conversation");
        res.json(messages);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get unread message counts per conversation
// @route   GET /api/chat/unread
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const counts = await Message.aggregate([
            {
                $match: {
                    sender: { $ne: req.user._id },
                    isRead: false
                }
            },
            {
                $group: {
                    _id: '$conversation',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Filter to only conversations the user is part of
        const userConversations = await Conversation.find({
            participants: { $elemMatch: { $eq: req.user._id } }
        }).select('_id');
        const userConvIds = userConversations.map(c => c._id.toString());

        const result = {};
        counts.forEach(c => {
            if (userConvIds.includes(c._id.toString())) {
                result[c._id.toString()] = c.count;
            }
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get total unread message count for all conversations
// @route   GET /api/chat/unread-total
// @access  Private
const getTotalUnreadCount = async (req, res) => {
    try {
        const count = await Message.countDocuments({
            sender: { $ne: req.user._id },
            isRead: false,
            conversation: { 
                $in: await Conversation.find({ 
                    participants: { $elemMatch: { $eq: req.user._id } } 
                }).distinct('_id')
            }
        });
        res.json({ count });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    accessConversation,
    fetchConversations,
    sendMessage,
    allMessages,
    getUnreadCount,
    getTotalUnreadCount
};
