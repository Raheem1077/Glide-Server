const { Expo } = require('expo-server-sdk');
const Notification = require('../models/Notification');
const User = require('../models/User');

let expo = new Expo();

/**
 * Send a notification to a specific user via DB, Socket, and Push
 * @param {string} userId - ID of the receiving user
 * @param {object} notificationData - { type, title, body, data }
 */
const sendNotification = async (userId, { type, title, body, data = {} }) => {
    try {
        console.log(`[NotificationService] Sending "${type}" to user ${userId}`);

        // 1. Save to Database
        const notification = await Notification.create({
            userId,
            type,
            title,
            body,
            data
        });

        // 2. Send via Socket.io (Real-time)
        if (global.onlineUsers && global.onlineUsers.has(userId.toString())) {
            const socketId = global.onlineUsers.get(userId.toString());
            if (global.io) {
                global.io.to(socketId).emit('notification', notification);
                console.log(`[NotificationService] Socket notification emitted to ${userId}`);
            }
        }

        // 3. Send via Expo Push Notifications
        const user = await User.findById(userId).select('pushToken');
        if (user && user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
            const messages = [{
                to: user.pushToken,
                sound: 'default',
                title,
                body,
                data: { ...data, type },
            }];

            try {
                let chunks = expo.chunkPushNotifications(messages);
                for (let chunk of chunks) {
                    await expo.sendPushNotificationsAsync(chunk);
                }
                console.log(`[NotificationService] Push notification sent to ${userId}`);
            } catch (error) {
                console.error('[NotificationService] Error sending push:', error);
            }
        } else {
            console.log(`[NotificationService] No valid push token for ${userId}`);
        }

        return notification;
    } catch (error) {
        console.error('[NotificationService] Error:', error);
    }
};

module.exports = { sendNotification };
