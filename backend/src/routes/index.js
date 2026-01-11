const express = require('express');
const router = express.Router();

const aiChatRoutes = require('../modules/aiChat/routes');

router.use('/', aiChatRoutes);

module.exports = router;
