const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

let client;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

/**
 * Send SMS using Twilio
 * @param {string} to - Recipient phone number
 * @param {string} message - Message body
 */
const sendSMS = async (to, message) => {
    // If no credentials, log to console as fallback
    if (!client || !fromNumber) {
        console.log(`[SMS MOCK] To: ${to} | Message: ${message}`);
        console.warn('[SMS] Twilio credentials missing in .env. Falling back to console.');
        return { success: true, mock: true };
    }

    try {
        const response = await client.messages.create({
            body: message,
            from: fromNumber,
            to: to
        });
        console.log(`[SMS] Sent to ${to}. SID: ${response.sid}`);
        return { success: true, sid: response.sid };
    } catch (error) {
        console.error(`[SMS] Error sending to ${to}:`, error.message);
        throw new Error(`SMS delivery failed: ${error.message}`);
    }
};

module.exports = { sendSMS };
