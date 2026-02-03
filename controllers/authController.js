const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
//rgrgrtgrgffgf
// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check for user by email OR username
    // We treat the 'email' field from body as the identifier
    const user = await User.findOne({
        $or: [{ email: email }, { username: email }]
    });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
});

// @desc    Register new user (Admin/Super Admin only normally, but public for seeding/initial setup if needed)
// @route   POST /api/auth/register
// @access  Private/Admin
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role, username, phone, address } = req.body;

    if (!req.user || req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Only Super Admin can create agents.');
    }

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'Agent',
        username,
        phone,
        address
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    res.status(200).json(req.user);
});

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Get all agents
// @route   GET /api/auth/agents
// @access  Private/Admin
const getAgents = asyncHandler(async (req, res) => {
    let query = { role: 'Agent' };

    // Allow Super Admin to see Admins as well
    if (req.user.role === 'Super Admin') {
        query = { role: { $in: ['Agent', 'Admin'] } };
    }

    const agents = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(agents);
});

// @desc    Update user (Super Admin only)
// @route   PUT /api/auth/:id
// @access  Private/Super Admin
const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Checking for Super Admin role should ideally be in middleware or here
    // For now assuming the route protection handles it or we check req.user
    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized to update users');
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.username = req.body.username || user.username;
    user.phone = req.body.phone || user.phone;
    user.address = req.body.address || user.address;

    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        username: updatedUser.username,
        phone: updatedUser.phone,
        address: updatedUser.address
    });
});

// @desc    Delete user (Super Admin only)
// @route   DELETE /api/auth/:id
// @access  Private/Super Admin
const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized to delete users');
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error('Cannot delete yourself');
    }

    await user.deleteOne();

    res.json({ id: req.params.id });
});

module.exports = {
    loginUser,
    registerUser,
    getMe,
    getAgents,
    updateUser,
    deleteUser
};
//fdrrr