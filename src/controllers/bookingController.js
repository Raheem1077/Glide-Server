const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const { sendNotification } = require('../services/notificationService');

// @desc    Request a seat on a ride
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
    const { rideId, seats } = req.body;

    // Validate seats input
    const seatCount = parseInt(seats, 10);
    if (!seatCount || seatCount < 1) {
        return res.status(400).json({ message: 'You must book at least 1 seat' });
    }

    try {
        const ride = await Ride.findById(rideId).populate('driver', 'name');

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        if (ride.status !== 'active') {
            return res.status(400).json({ message: 'This ride is no longer active' });
        }

        // Prevent booking own ride
        if (ride.driver._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot book your own ride' });
        }

        if (seatCount > ride.seats.available) {
            return res.status(400).json({ message: `Only ${ride.seats.available} seat(s) available` });
        }

        // Check if user already has a pending/accepted booking for this ride
        const existingBooking = await Booking.findOne({
            ride: rideId,
            passenger: req.user._id,
            status: { $in: ['pending', 'accepted'] }
        });

        if (existingBooking) {
            return res.status(400).json({ message: 'You already have a booking for this ride' });
        }

        // Calculate total price
        const totalPrice = seatCount * ride.price;

        const booking = await Booking.create({
            ride: rideId,
            passenger: req.user._id,
            seats: seatCount,
            totalPrice
        });

        // Trigger Notification for Driver
        await sendNotification(ride.driver._id, {
            type: 'booking',
            title: 'New Booking Request',
            body: `${req.user.name} wants to book ${seatCount} seat(s) for your ride from ${ride.from} to ${ride.to}`,
            data: { bookingId: booking._id, rideId: ride._id }
        });

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my bookings (as passenger)
// @route   GET /api/bookings/my
// @access  Private
const getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ passenger: req.user._id })
            .populate({
                path: 'ride',
                populate: { path: 'driver', select: 'name phone university profilePicture' }
            })
            .sort({ createdAt: -1 });

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get bookings for a specific ride (as driver)
// @route   GET /api/bookings/ride/:rideId
// @access  Private
const getRideBookings = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId);

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        if (ride.driver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not the driver of this ride' });
        }

        const bookings = await Booking.find({ ride: req.params.rideId })
            .populate('passenger', 'name phone university profilePicture');

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single booking details
// @route   GET /api/bookings/:id
// @access  Private
const getBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({
                path: 'ride',
                populate: { path: 'driver', select: 'name phone university profilePicture car' }
            });

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Check ownership (passenger or driver of the ride)
        const isPassenger = booking.passenger.toString() === req.user._id.toString();
        const isDriver = booking.ride.driver._id.toString() === req.user._id.toString();

        if (!isPassenger && !isDriver) {
            return res.status(403).json({ message: 'Not authorized to view this booking' });
        }

        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update booking status (Accept/Reject)
// @route   PUT /api/bookings/:id
// @access  Private
const updateBookingStatus = async (req, res) => {
    const { status, reason } = req.body;

    if (!['accepted', 'rejected', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const booking = await Booking.findById(req.params.id).populate('ride');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const isPassenger = booking.passenger.toString() === req.user._id.toString();
        const isDriver = booking.ride.driver.toString() === req.user._id.toString();

        if (status === 'cancelled') {
            if (!isPassenger && !isDriver) {
                return res.status(403).json({ message: 'Not authorized to cancel this booking' });
            }
            if (!reason || reason.trim() === '') {
                return res.status(400).json({ message: 'A reason MUST be provided when cancelling a booking' });
            }
            booking.cancellationReason = reason;
        } else {
            // If accepting/rejecting, driver must be the owner of the ride
            if (!isDriver) {
                return res.status(403).json({ message: 'Not authorized to update this booking' });
            }
        }

        // Handle seat availability if accepting
        if (status === 'accepted' && booking.status !== 'accepted') {
            if (booking.ride.seats.available < booking.seats) {
                return res.status(400).json({ message: 'Not enough seats available' });
            }

            // Deduct seats
            await Ride.findByIdAndUpdate(booking.ride._id, {
                $inc: { 'seats.available': -booking.seats }
            });

            // Trigger Notification for Passenger
            await sendNotification(booking.passenger, {
                type: 'accept',
                title: 'Booking Accepted! 🎉',
                body: `Your booking for the ride to ${booking.ride.to} has been accepted.`,
                data: { bookingId: booking._id, rideId: booking.ride._id, status: 'accepted' }
            });
        }

        // Handle seat availability if cancelling an already accepted booking
        if (status === 'cancelled' && booking.status === 'accepted') {
            await Ride.findByIdAndUpdate(booking.ride._id, {
                $inc: { 'seats.available': booking.seats }
            });
        }

        if (status === 'rejected') {
            // Trigger Notification for Passenger
            await sendNotification(booking.passenger, {
                type: 'rejected',
                title: 'Booking Update',
                body: `Your booking for the ride to ${booking.ride.to} was not accepted.`,
                data: { bookingId: booking._id, rideId: booking.ride._id, status: 'rejected' }
            });
        }

        if (status === 'cancelled') {
            if (isPassenger) {
                // Notify Driver
                await sendNotification(booking.ride.driver, {
                    type: 'cancelled',
                    title: 'Booking Cancelled',
                    body: `The booking for your ride to ${booking.ride.to} has been cancelled by the passenger. Reason: ${reason}`,
                    data: { bookingId: booking._id, rideId: booking.ride._id, status: 'cancelled' }
                });
            } else if (isDriver) {
                // Notify Passenger
                await sendNotification(booking.passenger, {
                    type: 'cancelled',
                    title: 'Booking Cancelled by Driver',
                    body: `Your booking for the ride to ${booking.ride.to} has been cancelled by the driver. Reason: ${reason}`,
                    data: { bookingId: booking._id, rideId: booking.ride._id, status: 'cancelled' }
                });
            }
        }

        booking.status = status;
        await booking.save();

        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all bookings for all rides owned by the driver
// @route   GET /api/bookings/driver
// @access  Private
const getDriverBookings = async (req, res) => {
    try {
        // First find all rides by this driver
        const rides = await Ride.find({ driver: req.user._id });
        const rideIds = rides.map(r => r._id);

        const bookings = await Booking.find({ ride: { $in: rideIds } })
            .populate('passenger', 'name phone university profilePicture')
            .populate('ride', 'from to date time');

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a booking (passenger only)
// @route   DELETE /api/bookings/:id
// @access  Private
const deleteBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Only passenger can delete their booking from history
        if (booking.passenger.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this booking' });
        }

        // Can only delete if status is cancelled or rejected (optional, but good for safety)
        if (!['cancelled', 'rejected'].includes(booking.status)) {
            return res.status(400).json({ message: 'Can only delete cancelled or rejected bookings' });
        }

        await Booking.deleteOne({ _id: booking._id });

        res.json({ message: 'Booking removed from history' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update seats in a booking
// @route   PUT /api/bookings/:id/seats
// @access  Private
const updateBookingSeats = async (req, res) => {
    const { seats } = req.body;
    const newSeatCount = parseInt(seats, 10);

    if (!newSeatCount || newSeatCount < 1) {
        return res.status(400).json({ message: 'You must book at least 1 seat' });
    }

    try {
        const booking = await Booking.findById(req.params.id).populate('ride');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Only passenger can update their own booking seats
        if (booking.passenger.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this booking' });
        }

        // Can only update if pending or accepted
        if (!['pending', 'accepted'].includes(booking.status)) {
            return res.status(400).json({ message: 'Cannot update seats for this booking status' });
        }

        const oldStatus = booking.status;
        const oldSeats = booking.seats;
        const diff = newSeatCount - oldSeats;

        // If increasing seats, check ride availability
        // Note: if it was accepted, we check if the EXTRA seats needed are available
        // If it was pending, we check if the TOTAL seats needed are available
        const availabilityCheck = oldStatus === 'accepted' ? diff : newSeatCount;
        if (availabilityCheck > 0 && booking.ride.seats.available < availabilityCheck) {
            return res.status(400).json({ message: `The ride doesn't have enough availability for this change.` });
        }

        // If previously accepted, we release the old seats FIRST
        if (oldStatus === 'accepted') {
            await Ride.findByIdAndUpdate(booking.ride._id, {
                $inc: { 'seats.available': oldSeats }
            });
        }

        // Revert to pending as requested (requires driver re-approval)
        booking.status = 'pending';
        booking.seats = newSeatCount;
        booking.totalPrice = newSeatCount * booking.ride.price;
        await booking.save();

        // Notify Driver
        await sendNotification(booking.ride.driver, {
            type: 'booking_update',
            title: 'Booking Revised',
            body: `${req.user.name} changed their booking to ${newSeatCount} seat(s) and is now awaiting your re-approval.`,
            data: { bookingId: booking._id, rideId: booking.ride._id }
        });

        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBooking,
    getMyBookings,
    getRideBookings,
    getDriverBookings,
    getBooking,
    updateBookingStatus,
    updateBookingSeats,
    deleteBooking
};
