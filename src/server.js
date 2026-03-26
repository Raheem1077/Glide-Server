require('dotenv').config();
console.log('[Server] JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // For development, allow all origins
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

// Attach io to global for access in services
global.io = io;


// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rides', require('./routes/rideRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Initial Route
app.get('/', (req, res) => {
    res.send('UniPool API is running...');
});

const { Conversation, Message } = require('./models/Message');
const { sendNotification } = require('./services/notificationService');

// Global memory to track online users (userId -> socketId)
global.onlineUsers = new Map();

// Socket.io initialization
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Track user presence
    socket.on('user_connected', async (userId) => {
        if (!userId) return;
        global.onlineUsers.set(userId, socket.id);
        io.emit('presence_update', Array.from(global.onlineUsers.keys()));

        try {
            // When user connects, any 'sent' messages to them should become 'delivered'
            const conversations = await Conversation.find({ participants: userId });
            const conversationIds = conversations.map(c => c._id);

            const undeliveredMessages = await Message.find({
                conversation: { $in: conversationIds },
                sender: { $ne: userId },
                status: 'sent'
            });

            if (undeliveredMessages.length > 0) {
                const messageIds = undeliveredMessages.map(m => m._id);
                await Message.updateMany(
                    { _id: { $in: messageIds } },
                    { $set: { status: 'delivered' } }
                );

                const convGroups = {};
                undeliveredMessages.forEach(m => {
                    const cid = m.conversation.toString();
                    if (!convGroups[cid]) convGroups[cid] = [];
                    convGroups[cid].push(m._id);
                });

                Object.keys(convGroups).forEach(cid => {
                    io.to(cid).emit('messageStatusUpdate', { bulk: true, status: 'delivered' });
                });
            }
        } catch (error) {
            console.error('Error updating delivered status on connect:', error);
        }
    });

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`User ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
        socket.leave(conversationId);
        console.log(`User ${socket.id} left conversation ${conversationId}`);
    });

    socket.on('send_message', async (data) => {
        const { conversationId, senderId, text, type = 'text', audioUrl, imageUrl, documentUrl, documentName, location } = data;

        try {
            const conversation = await Conversation.findById(conversationId).populate('participants', 'name profilePicture');

            let receiverId = null;
            let receiverName = 'Unknown';
            if (conversation) {
                const receiver = conversation.participants.find(p => p._id.toString() !== senderId.toString());
                if (receiver) {
                    receiverId = receiver._id.toString();
                    receiverName = receiver.name;
                }
            }

            let status = 'sent';
            let isRead = false;

            // Check if receiver is already in the room
            const roomMembers = io.sockets.adapter.rooms.get(conversationId);
            if (receiverId) {
                const receiverSocketId = global.onlineUsers.get(receiverId);
                if (receiverSocketId && roomMembers && roomMembers.has(receiverSocketId)) {
                    status = 'read';
                    isRead = true;
                }
            }

            let message = await Message.create({
                conversation: conversationId,
                sender: senderId,
                text,
                type,
                audioUrl,
                imageUrl,
                documentUrl,
                documentName,
                location,
                isRead: isRead,
                status: status
            });

            message = await message.populate('sender', 'name profilePicture');

            let logContent = `"${text}"`;
            if (type === 'audio') logContent = '[Audio Message]';
            else if (type === 'image') logContent = '[Image]';
            else if (type === 'document') logContent = `[Document: ${documentName}]`;
            else if (type === 'location') logContent = '[Location]';

            console.log(`\x1b[36m[Chat]\x1b[0m ${message.sender.name} sent: ${logContent}`);

            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    text: type === 'audio' ? '🎤 Voice message' : text,
                    sender: senderId,
                    createdAt: Date.now(),
                    isRead: false
                }
            });

            // Emit message to everyone in the room (including sender)
            io.to(conversationId).emit('receive_message', message);

            // Notify Receiver
            if (receiverId) {
                const receiverSocketId = global.onlineUsers.get(receiverId);

                // 1. Always push unread count update to receiver
                const unreadTotal = await Message.countDocuments({
                    sender: { $ne: receiverId },
                    isRead: false,
                    conversation: {
                        $in: await Conversation.find({
                            participants: { $elemMatch: { $eq: receiverId } }
                        }).distinct('_id')
                    }
                });

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('unread_update', { count: unreadTotal });

                    // 2. Only send "newMessageNotification" if receiver is NOT in this specific room
                    const roomMembers = io.sockets.adapter.rooms.get(conversationId);
                    if (!roomMembers || !roomMembers.has(receiverSocketId)) {
                        io.to(receiverSocketId).emit('newMessageNotification', {
                            conversationId,
                            messageId: message._id,
                            senderName: message.sender.name,
                            text: text.length > 50 ? text.substring(0, 47) + '...' : text
                        });

                        // Also trigger persistent notification (push etc.)
                        await sendNotification(receiverId, {
                            type: 'message',
                            title: `New Message from ${message.sender.name}`,
                            body: text.length > 50 ? text.substring(0, 47) + '...' : text,
                            data: { conversationId, senderName: message.sender.name }
                        });
                    }
                } else {
                    // Receiver offline - just send persistent notification
                    await sendNotification(receiverId, {
                        type: 'message',
                        title: `New Message from ${message.sender.name}`,
                        body: text.length > 50 ? text.substring(0, 47) + '...' : text,
                        data: { conversationId, senderName: message.sender.name }
                    });
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    socket.on('mark_read', async ({ conversationId, userId }) => {
        try {
            await Message.updateMany(
                { conversation: conversationId, sender: { $ne: userId }, isRead: false },
                { $set: { isRead: true, status: 'read' } }
            );

            io.to(conversationId).emit('messages_read', conversationId);
            // Also explicitly notify the sender that these messages were read
            io.to(conversationId).emit('messageStatusUpdate', { bulk: true, status: 'read' });

            // Sync unread count for the user who just read the messages
            const unreadTotal = await Message.countDocuments({
                sender: { $ne: userId },
                isRead: false,
                conversation: {
                    $in: await Conversation.find({
                        participants: { $elemMatch: { $eq: userId } }
                    }).distinct('_id')
                }
            });

            socket.emit('unread_update', { count: unreadTotal });
        } catch (error) {
            console.error('Error marking messages read:', error);
        }
    });

    socket.on('messageDelivered', async (messageId) => {
        try {
            const message = await Message.findById(messageId);
            if (message && message.status === 'sent') {
                message.status = 'delivered';
                await message.save();
                io.to(message.conversation.toString()).emit('messageStatusUpdate', { messageId, status: 'delivered' });
            }
        } catch (e) {
            console.error('Error delivering message:', e);
        }
    });

    socket.on('messageRead', async (data) => {
        try {
            const messageId = typeof data === 'object' ? data.messageId : data;
            if (!messageId) return;
            const message = await Message.findById(messageId);
            if (message && message.status !== 'read') {
                message.status = 'read';
                message.isRead = true;
                await message.save();
                io.to(message.conversation.toString()).emit('messageStatusUpdate', { messageId, status: 'read' });
            }
        } catch (e) {
            console.error('Error reading message:', e);
        }
    });

    socket.on('deleteMessage', async (data) => {
        const { messageId, type, userId, conversationId } = data;
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            if (type === 'everyone' && message.sender.toString() === userId.toString()) {
                message.isDeleted = true;
                message.text = "This message was deleted";
                message.type = "text";
                await message.save();
                io.to(conversationId).emit('messageDeletedUpdate', message);
            } else if (type === 'me') {
                if (!message.deletedFor.includes(userId)) {
                    message.deletedFor.push(userId);
                    await message.save();
                }
                socket.emit('messageDeletedUpdate', message);
            }
        } catch (e) {
            console.error('Error deleting message:', e);
        }
    });


    socket.on('get_unread_total', async (userId) => {
        try {
            const count = await Message.countDocuments({
                sender: { $ne: userId },
                isRead: false,
                conversation: {
                    $in: await Conversation.find({
                        participants: { $elemMatch: { $eq: userId } }
                    }).distinct('_id')
                }
            });
            socket.emit('unread_update', { count });
        } catch (error) {
            console.error('Error fetching unread total:', error);
        }
    });

    socket.on('disconnect', () => {
        let disconnectedUserId = null;
        for (let [userId, socketId] of global.onlineUsers.entries()) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                break;
            }
        }
        if (disconnectedUserId) {
            global.onlineUsers.delete(disconnectedUserId);
            io.emit('presence_update', Array.from(global.onlineUsers.keys()));
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
