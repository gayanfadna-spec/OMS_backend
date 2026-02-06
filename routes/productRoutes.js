const express = require('express');
const router = express.Router();
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, admin, superAdmin } = require('../middleware/authMiddleware');

router.route('/').get(protect, getProducts).post(protect, superAdmin, createProduct);
router.route('/:id').put(protect, superAdmin, updateProduct).delete(protect, superAdmin, deleteProduct);

module.exports = router;
