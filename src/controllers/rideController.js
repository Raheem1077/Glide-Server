const Ride = require('../models/Ride');

// @desc    Create a new ride
// @route   POST /api/rides
// @access  Private
const createRide = async (req, res) => {
    const { from, to, date, time, seats, price, description, route, isRecurring, recurringDays } = req.body;

    try {
        const validCities = ['Sargodha', 'Lahore', 'Islamabad', 'Sialkot', 'Multan'];
        if (!validCities.includes(from)) return res.status(400).json({ message: 'Invalid pickup location' });
        if (!validCities.includes(to)) return res.status(400).json({ message: 'Invalid destination' });
        if (from === to) return res.status(400).json({ message: 'Pickup and destination cannot be the same' });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(date) < today) return res.status(400).json({ message: 'Ride date cannot be in the past' });

        if (seats < 1 || seats > 7) return res.status(400).json({ message: 'Seats must be between 1 and 7' });
        if (price <= 0) return res.status(400).json({ message: 'Price must be strictly positive' });

        const user = await require('../models/User').findById(req.user._id);
        if (!user.car || !user.car.brand || !user.car.model || !user.car.plateNumber || !user.car.carPicture) {
            return res.status(400).json({ message: 'Please complete your car details (including a car photo) in your profile before offering a ride' });
        }

        // Check if the driver already has an active ride
        const activeRide = await Ride.findOne({ driver: req.user._id, status: 'active' });
        if (activeRide) {
            return res.status(400).json({ message: 'You already have an active ride. Complete or cancel it before creating a new one.' });
        }

        const ride = await Ride.create({
            driver: req.user._id,
            from,
            to,
            date,
            time,
            seats: {
                total: seats,
                available: seats
            },
            price,
            description,
            route,
            isRecurring,
            recurringDays
        });

        res.status(201).json(ride);
    } catch (error) {
        // Handle MongoDB unique index violation gracefully (race condition fallback)
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You already have an active ride. Complete or cancel it before creating a new one.' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all rides (with filters)
// @route   GET /api/rides
// @access  Public
const getRides = async (req, res) => {
    const { from, to, date } = req.query;
    let query = { status: 'active' };

    if (from) {
        query.from = { $regex: from, $options: 'i' };
    }
    if (to) {
        query.to = { $regex: to, $options: 'i' };
    }
    if (date) {
        const searchDate = new Date(date);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        query.date = {
            $gte: searchDate,
            $lt: nextDate
        };
    }

    try {
        const rides = await Ride.find(query)
            .populate('driver', 'name university profilePicture rating')
            .sort({ date: 1, time: 1 });

        res.json(rides);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get ride by ID
// @route   GET /api/rides/:id
// @access  Public
const getRideById = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('driver', 'name university phone profilePicture rating car');

        if (ride) {
            res.json(ride);
        } else {
            res.status(404).json({ message: 'Ride not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my rides (as driver)
// @route   GET /api/rides/my
// @access  Private
const getMyRides = async (req, res) => {
    try {
        const rides = await Ride.find({ driver: req.user._id })
            .sort({ date: -1 });

        res.json(rides);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a ride (Cancel/Edit)
// @route   PUT /api/rides/:id
// @access  Private
const updateRide = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        if (ride.driver.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        // e.g. req.body.status = 'cancelled'
        const updatedRide = await Ride.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json(updatedRide);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get driver dashboard statistics
// @route   GET /api/rides/stats
// @access  Private
const getDriverStats = async (req, res) => {
    try {
        const Booking = require('../models/Booking');

        // 1. Get the current active ride
        const activeRide = await Ride.findOne({
            driver: req.user._id,
            status: 'active'
        });

        // 2. Get all rides for this driver to calculate total earnings
        const allRides = await Ride.find({ driver: req.user._id });
        const rideIds = allRides.map(r => r._id);

        // 3. Get all accepted bookings to calculate total earnings
        const acceptedBookings = await Booking.find({
            ride: { $in: rideIds },
            status: 'accepted'
        });
        const totalEarnings = acceptedBookings.reduce((sum, b) => sum + b.totalPrice, 0);

        // 4. Get pending requests count
        const pendingRequests = await Booking.countDocuments({
            ride: { $in: rideIds },
            status: 'pending'
        });

        // 5. Calculate seats filled for the active ride
        const seatsFilled = activeRide ? (activeRide.seats.total - activeRide.seats.available) : 0;

        res.json({
            activeRide: activeRide ? {
                id: activeRide._id,
                from: activeRide.from,
                to: activeRide.to,
                date: activeRide.date,
                time: activeRide.time,
                seatsFilled,
                totalSeats: activeRide.seats.total
            } : null,
            totalEarnings,
            pendingRequests,
            activeRideCount: activeRide ? 1 : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createRide,
    getRides,
    getRideById,
    getMyRides,
    updateRide,
    getDriverStats
};
