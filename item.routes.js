const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item.controller');

// Rute Katalog Busana
router.get('/', itemController.getAllItems);
router.get('/new', itemController.getCreateItem);
router.post('/', itemController.createItem);
router.get('/edit/:id', itemController.getEditItem);
router.post('/edit/:id', itemController.updateItem);
router.get('/delete/:id', itemController.deleteItem);
router.get('/toggle-status/:id', itemController.toggleStatus);

module.exports = router;
