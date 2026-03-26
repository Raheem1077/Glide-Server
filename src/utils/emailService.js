const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.FROM_EMAIL || 'Glide <noreply@glide-app.com>';

let transporter;
if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort == 465, // true for 465, false for other ports
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
}

/**
 * Send Email using Nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text)
 * @param {string} html - Email body (HTML)
 */
const sendEmail = async (to, subject, text, html) => {
    // If no credentials, log to console as fallback
    if (!transporter) {
        console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject} | Message: ${text}`);
        console.warn('[EMAIL] SMTP credentials missing in .env. Falling back to console.');
        return { success: true, mock: true };
    }

    try {
        const info = await transporter.sendMail({
            from: fromEmail,
            to: to,
            subject: subject,
            text: text,
            html: html,
        });
        console.log(`[Email] Sent to ${to}. MessageID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Error sending to ${to}:`, error.message);
        throw new Error(`Email delivery failed: ${error.message}`);
    }
};

module.exports = { sendEmail };
