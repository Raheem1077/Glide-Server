const express = require('express');
const router = express.Router();
const {
    createRide,
    getRides,
    getRideById,
    getMyRides,
    updateRide,
    getDriverStats
} = require('../controllers/rideController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .post(protect, authorize('driver', 'both'), createRide)
    .get(getRides);

router.get('/my', protect, getMyRides);
router.get('/stats', protect, authorize('driver', 'both'), getDriverStats);
router.route('/:id')
    .get(getRideById)
    .put(protect, authorize('driver', 'both'), updateRide);

module.exports = router;
