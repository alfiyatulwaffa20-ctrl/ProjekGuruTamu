const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rental.controller');

// Rute Transaksi Persewaan & Cek Sewaan
router.get('/', rentalController.getAllRentals);
router.get('/new', rentalController.getCreateRental);
router.post('/', rentalController.createRental);
router.get('/:id', rentalController.getRentalDetail);
router.post('/:id/status', rentalController.updateRentalStatus);

module.exports = router;
