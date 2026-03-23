const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Keyword = require('../models/Keyword');
const requireAuth = require('../middleware/requireAuth');
const { describeMonitorRule, getSectionLabels } = require('../src/sections');
const { buildHighlightConfig, highlightText } = require('../src/highlight');

router.use(requireAuth);

async function hydrateAlerts(rawAlerts) {
  const keywordIds = [...new Set(
    rawAlerts
      .map(alert => String(alert.keywordId || ''))
      .filter(Boolean)
  )];

  const keywords = await Keyword.find({ _id: { $in: keywordIds } }).lean();
  const keywordsById = new Map(
    keywords.map(keyword => [String(keyword._id), keyword])
  );

  return rawAlerts.map(alert => {
    const keyword = keywordsById.get(String(alert.keywordId || '')) || null;
    const highlightConfig = buildHighlightConfig(keyword || {});

    return {
      ...alert,
      keyword,
      sectionLabels: keyword ? getSectionLabels(keyword.sections) : [],
      viewUrl: `/alerts/${alert._id}/view`,
      highlightedResumo: highlightText(
        alert.occurrence && alert.occurrence.resumo ? alert.occurrence.resumo : '',
        highlightConfig.terms
      ),
      highlightTerms: highlightConfig.terms,
      ignoredShortKeyword: highlightConfig.ignoredShortKeyword,
      monitorLabel: keyword ? describeMonitorRule(keyword, { compact: true }) : alert.keywordText
    };
  });
}

router.get('/', async (req, res) => {
  const rawAlerts = await Alert.find({ userId: req.session.user.id })
    .sort({ sentAt: -1 })
    .limit(100)
    .lean();

  const alerts = await hydrateAlerts(rawAlerts);
  res.render('alerts', { alerts });
});

router.get('/:id/view', async (req, res) => {
  const rawAlert = await Alert.findOne({
    _id: req.params.id,
    userId: req.session.user.id
  }).lean();

  if (!rawAlert) {
    return res.status(404).render('alerts', { alerts: [] });
  }

  const [alert] = await hydrateAlerts([rawAlert]);

  return res.render('alert-detail', {
    alert,
    highlightedResumoLongo: highlightText(
      alert.occurrence && alert.occurrence.resumo ? alert.occurrence.resumo : '',
      alert.highlightTerms
    )
  });
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
