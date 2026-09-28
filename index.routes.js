const express = require('express');
const router = express.Router();
const controller = require('../controllers/tefa.controller');
const { requireAuth, allowRoles, asyncHandler } = require('../middlewares/auth');

router.get('/login', controller.loginPage);
router.post('/login', asyncHandler(controller.login));
router.post('/logout', controller.logout);
router.get('/', requireAuth, asyncHandler(controller.dashboard));
router.post('/services', allowRoles('ADMIN'), asyncHandler(controller.createService));
router.post('/services/:id/update', allowRoles('ADMIN'), asyncHandler(controller.updateService));
router.post('/services/:id/toggle', allowRoles('ADMIN'), asyncHandler(controller.toggleService));
router.post('/settings', allowRoles('ADMIN'), asyncHandler(controller.updateSettings));
router.post('/honor/:id/pay', allowRoles('ADMIN'), asyncHandler(controller.payHonor));
router.post('/orders', allowRoles('PROJECT_MANAGER'), asyncHandler(controller.createOrder));
router.post('/orders/:id/verify', allowRoles('PROJECT_MANAGER'), asyncHandler(controller.verifyOrder));
router.post('/tasks/:id/update', allowRoles('SISWA_TEKNISI'), asyncHandler(controller.updateTask));
router.post('/tasks/:id/approve', allowRoles('PROJECT_MANAGER'), asyncHandler(controller.approveTask));
router.get('/orders/:id/:type(invoice|ba)', allowRoles('PROJECT_MANAGER'), asyncHandler(controller.orderDocument));

module.exports = router;
