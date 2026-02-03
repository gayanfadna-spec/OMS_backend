const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { createOrder, getOrders, getOrderById, updateOrder, deleteOrder, bulkDeleteOrders, getDashboardStats, bulkUpdateStatus, exportOrders, getExportHistory, getMyReport, bulkImportOrders, requestEditOrder, getPendingEditRequestsCount, getOrderMatrix } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getOrders).post(protect, createOrder);
router.route('/bulk-import').post(protect, upload.single('file'), bulkImportOrders);
router.route('/export').put(protect, exportOrders);
router.route('/export-history').get(protect, getExportHistory);
router.route('/my-report').get(protect, getMyReport); // New route
router.route('/bulk-status').put(protect, bulkUpdateStatus);
router.route('/bulk-delete').delete(protect, bulkDeleteOrders);
router.route('/stats').get(protect, getDashboardStats);
router.route('/matrix').get(protect, getOrderMatrix);
router.route('/:id/request-edit').post(protect, requestEditOrder);
router.route('/pending-edits-count').get(protect, getPendingEditRequestsCount);
router.route('/:id').get(protect, getOrderById).put(protect, updateOrder).delete(protect, deleteOrder);

module.exports = router;
//rtr
