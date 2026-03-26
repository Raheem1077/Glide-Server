const User = require('../models/User');
const OTP = require('../models/OTP');
const generateToken = require('../utils/generateToken');
const { sendSMS } = require('../utils/smsService');
const { sendEmail } = require('../utils/emailService');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, phone, role, otpCode } = req.body;
    console.log(`[Server] Registration attempt for: ${email} as ${role}`);

    if (!otpCode) {
        return res.status(400).json({ message: 'OTP is required for registration' });
    }

    try {
        const otpRecord = await OTP.findOne({ identifier: email, code: otpCode });
        if (!otpRecord) {
            return res.status(401).json({ message: 'Invalid or expired OTP' });
        }

        // Delete OTP after use
        await OTP.deleteOne({ _id: otpRecord._id });
        // Password complexity validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            });
        }

        const userExists = await User.findOne({ $or: [{ email }, { phone }] });

        if (userExists) {
            console.log(`[Server] Registration failed: User already exists (${email} or ${phone})`);
            return res.status(400).json({ message: 'User with this email or phone already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            phone,
            role
        });

        if (user) {
            console.log(`[Server] ✅ Registration successful: ${email}`);
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                car: user.car,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { identifier, password } = req.body;
    console.log(`[Server] Login attempt for: ${identifier}`);

    try {
        // Find user by email or phone
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { phone: identifier }
            ]
        }).select('+password');

        if (user && (await user.matchPassword(password))) {
            // Check for OTP if provided, otherwise fail (forcing OTP for login)
            const { otpCode } = req.body;
            if (!otpCode) {
                return res.status(200).json({
                    requiresOTP: true,
                    message: 'Password correct, please verify OTP'
                });
            }

            const otpRecord = await OTP.findOne({ identifier, code: otpCode });
            if (!otpRecord) {
                return res.status(401).json({ message: 'Invalid or expired OTP' });
            }

            // Delete OTP after use
            await OTP.deleteOne({ _id: otpRecord._id });

            console.log(`[Server] Login successful: ${identifier}`);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                car: user.car,
                token: generateToken(user._id)
            });
        } else {
            console.log(`[Server] ❌ Login failed: Invalid credentials for ${identifier}`);
            res.status(401).json({ message: 'Invalid identifier or password' });
        }
    } catch (error) {
        console.error(`[Server] Login error: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                car: user.car
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('+password');

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.phone = req.body.phone || user.phone;
            user.role = req.body.role || user.role;
            user.profilePicture = req.body.profilePicture || user.profilePicture;

            if (req.body.car) {
                user.car = {
                    brand: req.body.car.brand || user.car?.brand,
                    model: req.body.car.model || user.car?.model,
                    plateNumber: req.body.car.plateNumber || user.car?.plateNumber,
                    color: req.body.car.color || user.car?.color,
                    carPicture: req.body.car.carPicture || user.car?.carPicture
                };
            }

            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                car: updatedUser.car,
                profilePicture: updatedUser.profilePicture,
                token: generateToken(updatedUser._id)
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload profile picture
// @route   POST /api/auth/profile-picture
// @access  Private
const uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image' });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate full URL
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        user.profilePicture = imageUrl;
        await user.save();

        res.json({
            message: 'Profile picture uploaded successfully',
            profilePicture: imageUrl
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload car picture
// @route   POST /api/auth/car-picture
// @access  Private
const uploadCarPicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image' });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate full URL
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        if (!user.car) user.car = {};
        user.car.carPicture = imageUrl;
        await user.save();

        res.json({
            message: 'Car picture uploaded successfully',
            carPicture: imageUrl
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user settings
// @route   PUT /api/auth/settings
// @access  Private
const updateSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.settings) user.settings = {};

        user.settings = {
            notifications: req.body.notifications !== undefined ? req.body.notifications : user.settings.notifications,
            darkMode: req.body.darkMode !== undefined ? req.body.darkMode : user.settings.darkMode,
            language: req.body.language || user.settings.language
        };

        if (req.body.notifications === false) {
            user.pushToken = null;
        }

        await user.save();
        res.json({ success: true, settings: user.settings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Change Password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await user.matchPassword(oldPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid old password' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Save Expo push token
// @route   POST /api/auth/push-token
// @access  Private
const savePushToken = async (req, res) => {
    const { pushToken } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.pushToken = pushToken;
        await user.save();

        res.json({ message: 'Push token saved successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send OTP to email/phone
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
    const { identifier, type } = req.body; // type: 'login' or 'register'
    console.log(`[Server] Generating OTP for ${identifier} (${type})`);

    try {
        if (type === 'register') {
            const userExists = await User.findOne({
                $or: [{ email: identifier }, { phone: identifier }]
            });
            if (userExists) {
                return res.status(400).json({ message: 'User already exists' });
            }
        } else if (type === 'login') {
            const user = await User.findOne({
                $or: [{ email: identifier }, { phone: identifier }]
            });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to DB (Update if exists, or create new)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await OTP.findOneAndUpdate(
            { identifier },
            { code: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        // Send via SMS or Email based on identifier
        if (!identifier.includes('@')) {
            await sendSMS(identifier, `Your UniPool verification code is: ${otpCode}. Valid for 5 minutes.`);
        } else {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #3F51B5;">Glide Verification</h2>
                    <p>Your 6-digit verification code is:</p>
                    <div style="font-size: 32px; font-weight: bold; color: #3F51B5; background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        ${otpCode}
                    </div>
                    <p>This code will expire in 5 minutes.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #777;">If you didn't request this, please ignore this email.</p>
                </div>
            `;
            await sendEmail(identifier, 'Glide - Verification Code', `Your code is: ${otpCode}`, htmlContent);
        }

        res.json({ message: `OTP sent to ${identifier}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forgot Password - sends OTP to email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'No account found with that email' });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await OTP.findOneAndUpdate(
            { identifier: email },
            { code: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4F46E5;">Glide Password Reset</h2>
                <p>You requested a password reset. Use the code below:</p>
                <div style="font-size: 32px; font-weight: bold; color: #4F46E5; background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    ${otpCode}
                </div>
                <p>This code expires in 10 minutes.</p>
                <p style="font-size: 12px; color: #777;">If you didn't request this, please ignore this email.</p>
            </div>
        `;
        await sendEmail(email, 'Glide - Password Reset Code', `Your reset code is: ${otpCode}`, htmlContent);

        res.json({ message: 'Password reset code sent to your email' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset Password - verify OTP and set new password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    const { email, otpCode, newPassword } = req.body;
    if (!email || !otpCode || !newPassword) {
        return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    try {
        const otpRecord = await OTP.findOne({ identifier: email, code: otpCode });
        if (!otpRecord) return res.status(401).json({ message: 'Invalid or expired OTP' });

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                message: 'Password must be 8+ characters with uppercase, lowercase, number, and special character'
            });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.password = newPassword;
        await user.save();
        await OTP.deleteOne({ _id: otpRecord._id });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    uploadProfilePicture,
    uploadCarPicture,
    savePushToken,
    updateSettings,
    changePassword,
    sendOTP,
    forgotPassword,
    resetPassword
};
