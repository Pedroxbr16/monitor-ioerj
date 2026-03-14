const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const alerts = await Alert.find({ userId: req.session.user.id })
    .sort({ sentAt: -1 })
    .limit(100);
  res.render('alerts', { alerts });
});

router.delete('/:id', async (req, res) => {
  try {
    await Alert.deleteOne({ _id: req.params.id, userId: req.session.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
