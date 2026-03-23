const express = require('express');
const router = express.Router();

const Keyword = require('../models/Keyword');
const requireAuth = require('../middleware/requireAuth');
const {
  SECTION_OPTIONS,
  normalizeSectionIds,
  describeSectionScope,
  describeMonitorRule
} = require('../src/sections');

router.use(requireAuth);

function parseKeywordPayload(body) {
  const text = String(body.text || '').trim();
  const sections = normalizeSectionIds(body.sections);

  if (!text && !sections.length) {
    throw new Error('Informe uma palavra-chave ou selecione ao menos uma seção específica.');
  }

  return {
    text,
    sections,
    emailEnabled: body.emailEnabled === 'true' || body.emailEnabled === true,
    whatsappEnabled: body.whatsappEnabled === 'true' || body.whatsappEnabled === true
  };
}

router.get('/', async (req, res) => {
  const keywords = await Keyword.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
  res.render('keywords', {
    keywords,
    sectionOptions: SECTION_OPTIONS,
    describeSectionScope,
    describeMonitorRule
  });
});

router.post('/', async (req, res) => {
  try {
    const payload = parseKeywordPayload(req.body);
    await Keyword.create({
      userId: req.session.user.id,
      ...payload
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const payload = parseKeywordPayload(req.body);
    const keyword = await Keyword.findOne({ _id: req.params.id, userId: req.session.user.id });
    if (!keyword) return res.status(404).json({ ok: false, erro: 'Nao encontrada.' });

    keyword.text = payload.text;
    keyword.sections = payload.sections;
    keyword.emailEnabled = payload.emailEnabled;
    keyword.whatsappEnabled = payload.whatsappEnabled;
    keyword.firstScanDone = false;
    keyword.seenIds = [];
    keyword.armedFromAt = new Date();
    await keyword.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const keyword = await Keyword.findOne({ _id: req.params.id, userId: req.session.user.id });
    if (!keyword) return res.status(404).json({ ok: false, erro: 'Nao encontrada.' });

    keyword.active = !keyword.active;
    await keyword.save();

    res.json({ ok: true, active: keyword.active });
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
