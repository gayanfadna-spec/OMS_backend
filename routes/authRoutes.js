const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getMe, getAgents, updateUser, deleteUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/register', protect, registerUser); // Protected in production, maybe open for initial seed
router.get('/me', protect, getMe);
router.get('/agents', protect, getAgents);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, deleteUser);

module.exports = router;
