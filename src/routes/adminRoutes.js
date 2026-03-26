const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/admin');
const {
    getDashboardStats,
    getAllUsers,
    updateUserStatus,
    deleteUser,
    getAllRides,
    deleteRide,
    getAllBookings,
    cancelBooking
} = require('../controllers/adminController');

// All routes are protected and require admin role
router.use(protect);
router.use(verifyAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/rides', getAllRides);
router.delete('/rides/:id', deleteRide);
router.get('/bookings', getAllBookings);
router.delete('/bookings/:id', cancelBooking);

module.exports = router;
