const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/send-otp', sendOTP);
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile);
router.post('/profile-picture', protect, upload.single('image'), uploadProfilePicture);
router.post('/car-picture', protect, upload.single('image'), uploadCarPicture);
router.post('/push-token', protect, savePushToken);
router.put('/settings', protect, updateSettings);
router.put('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
