const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ active: true });
    res.json(products);
});

// @desc    Create product
// @route   POST /api/products
// @access  Private/Super Admin
const createProduct = asyncHandler(async (req, res) => {
    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Super Admin only.');
    }

    const { name, price, weight, unit, description, active } = req.body;

    const product = await Product.create({
        name,
        price,
        weight,
        unit,
        description,
        active: active !== undefined ? active : true
    });

    res.status(201).json(product);
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Super Admin
const updateProduct = asyncHandler(async (req, res) => {
    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Super Admin only.');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    });

    res.json(updatedProduct);
});

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private/Super Admin
const deleteProduct = asyncHandler(async (req, res) => {
    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Super Admin only.');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    product.active = false;
    await product.save();

    res.json({ id: req.params.id });
});

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
};
