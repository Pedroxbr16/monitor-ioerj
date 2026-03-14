const express = require('express');
const router = express.Router();
const Keyword = require('../models/Keyword');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const keywords = await Keyword.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
  res.render('keywords', { keywords });
});

router.post('/', async (req, res) => {
  const { text, emailEnabled, whatsappEnabled } = req.body;
  try {
    await Keyword.create({
      userId: req.session.user.id,
      text: text.trim(),
      emailEnabled: emailEnabled === 'true' || emailEnabled === true,
      whatsappEnabled: whatsappEnabled === 'true' || whatsappEnabled === true
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { text, emailEnabled, whatsappEnabled } = req.body;
  try {
    const kw = await Keyword.findOne({ _id: req.params.id, userId: req.session.user.id });
    if (!kw) return res.status(404).json({ ok: false, erro: 'Não encontrada.' });
    kw.text = text.trim();
    kw.emailEnabled = emailEnabled === 'true' || emailEnabled === true;
    kw.whatsappEnabled = whatsappEnabled === 'true' || whatsappEnabled === true;
    kw.firstScanDone = false;
    kw.seenIds = [];
    await kw.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const kw = await Keyword.findOne({ _id: req.params.id, userId: req.session.user.id });
    if (!kw) return res.status(404).json({ ok: false, erro: 'Não encontrada.' });
    kw.active = !kw.active;
    await kw.save();
    res.json({ ok: true, active: kw.active });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Keyword.deleteOne({ _id: req.params.id, userId: req.session.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
