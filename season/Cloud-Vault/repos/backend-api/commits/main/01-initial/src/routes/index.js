const express = require('express');
const router = express.Router();

// API root
router.get('/', (req, res) => {
  res.json({
    service: 'TechVault Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
