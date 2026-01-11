const express = require('express');
const router = express.Router();
const {challenge, evaluate, stats} = require('./controllers/aiChatController');

router.get('/challenge', challenge);
router.post('/evaluate', evaluate);
router.get('/stats', stats);

module.exports = router;
