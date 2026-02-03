const express = require('express');
const router = express.Router();
const { createCustomer, getCustomers, getCustomerByPhone, updateCustomer, deleteCustomer, bulkDeleteCustomers } = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getCustomers).post(protect, createCustomer);
router.route('/bulk-delete').delete(protect, bulkDeleteCustomers);
router.route('/lookup/:phone').get(protect, getCustomerByPhone);
router.route('/:id').put(protect, updateCustomer).delete(protect, deleteCustomer);

module.exports = router;
