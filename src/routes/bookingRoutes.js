const express = require('express');
const router = express.Router();
const {
    createBooking,
    getMyBookings,
    getRideBookings,
    getDriverBookings,
    getBooking,
    updateBookingStatus,
    updateBookingSeats,
    deleteBooking
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .post(protect, authorize('passenger', 'both'), createBooking);

router.get('/my', protect, getMyBookings);
router.get('/driver', protect, authorize('driver', 'both'), getDriverBookings);
router.get('/ride/:rideId', protect, getRideBookings);
router.get('/:id', protect, getBooking);
router.put('/:id', protect, updateBookingStatus);
router.put('/:id/seats', protect, updateBookingSeats);
router.delete('/:id', protect, deleteBooking);

module.exports = router;
