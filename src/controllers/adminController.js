const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const totalRides = await Ride.countDocuments();
        const activeRides = await Ride.countDocuments({ status: 'active' });
        const totalBookings = await Booking.countDocuments();

        // Get recent activity (last 5 items across users, rides, bookings)
        const recentUsers = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).limit(5).select('name role createdAt');
        const recentRides = await Ride.find().sort({ createdAt: -1 }).limit(5).populate('driver', 'name');
        
        // Assemble activity log
        const activity = [
            ...recentUsers.map(u => ({ type: 'user', text: `New user: ${u.name}`, date: u.createdAt })),
            ...recentRides.map(r => ({ type: 'ride', text: `New ride: ${r.from.split(',')[0]} to ${r.to.split(',')[0]}`, date: r.createdAt }))
        ].sort((a, b) => b.date - a.date).slice(0, 5);

        // Get growth data (last 7 days)
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0,0,0,0);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const rideCount = await Ride.countDocuments({ createdAt: { $gte: date, $lt: nextDate } });
            const bookingCount = await Booking.countDocuments({ createdAt: { $gte: date, $lt: nextDate } });
            
            days.push({
                name: date.toLocaleDateString('en-US', { weekday: 'short' }),
                rides: rideCount,
                bookings: bookingCount
            });
        }

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalDrivers,
                totalRides,
                activeRides,
                totalBookings,
                activity,
                growth: days
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        const { role, isBlocked, search, page = 1, limit = 10 } = req.query;
        const query = { role: { $ne: 'admin' } };

        if (role) query.role = role;
        if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user status (block/unblock)
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = async (req, res) => {
    try {
        const { isBlocked } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Cannot block an admin' });
        }

        user.isBlocked = isBlocked;
        await user.save();

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all rides
// @route   GET /api/admin/rides
// @access  Private/Admin
exports.getAllRides = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) query.status = status;

        const skip = (page - 1) * limit;
        const rides = await Ride.find(query)
            .populate('driver', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Ride.countDocuments(query);

        res.json({
            success: true,
            rides,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all bookings
// @route   GET /api/admin/bookings
// @access  Private/Admin
exports.getAllBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) query.status = status;

        const skip = (page - 1) * limit;
        const bookings = await Booking.find(query)
            .populate('passenger', 'name email')
            .populate('ride', 'from to date time')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Booking.countDocuments(query);

        res.json({
            success: true,
            bookings,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete an admin' });

        await user.deleteOne();
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete ride
// @route   DELETE /api/admin/rides/:id
// @access  Private/Admin
exports.deleteRide = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        await ride.deleteOne();
        res.json({ success: true, message: 'Ride deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel booking
// @route   DELETE /api/admin/bookings/:id
// @access  Private/Admin
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        booking.status = 'cancelled';
        await booking.save();
        res.json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
