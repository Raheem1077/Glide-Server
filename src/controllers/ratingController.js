const Rating = require('../models/Rating');
const User = require('../models/User');
const Ride = require('../models/Ride');

// @desc    Submit a rating for a user (driver or passenger)
// @route   POST /api/ratings
// @access  Private
const createRating = async (req, res) => {
    const { rideId, rateeId, score, comment } = req.body;

    try {
        const ride = await Ride.findById(rideId);
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        const rating = await Rating.create({
            ride: rideId,
            rater: req.user._id,
            ratee: rateeId,
            score,
            comment
        });

        // Update the average rating and count for the ratee
        const ratings = await Rating.find({ ratee: rateeId });
        const average = ratings.reduce((acc, item) => item.score + acc, 0) / ratings.length;

        await User.findByIdAndUpdate(rateeId, {
            rating: {
                average: average.toFixed(1),
                count: ratings.length
            }
        });

        res.status(201).json(rating);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get ratings for a user
// @route   GET /api/ratings/user/:userId
// @access  Public
const getUserRatings = async (req, res) => {
    try {
        const ratings = await Rating.find({ ratee: req.params.userId })
            .populate('rater', 'name profilePicture')
            .sort({ createdAt: -1 });

        res.json(ratings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createRating,
    getUserRatings
};
