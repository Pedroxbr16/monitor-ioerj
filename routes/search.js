const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/requireAuth');
const { searchOccurrences } = require('../services/occurrenceQuery');
const { buildHighlightConfig, highlightText } = require('../src/highlight');
const {
  SECTION_OPTIONS,
  normalizeSectionIds,
  describeSectionScope
} = require('../src/sections');

router.use(requireAuth);

function renderSearch(res, payload = {}) {
  const defaults = {
    resultados: null,
    params: {
      keyword: '',
      dataInicio: '',
      dataFim: '',
      sections: []
    },
    totalBruto: 0,
    erro: null,
    highlightTerms: [],
    ignoredShortKeyword: ''
  };

  const mergedPayload = {
    ...defaults,
    ...payload
  };

  mergedPayload.params = {
    ...defaults.params,
    ...(payload.params || {})
  };

  res.render('search', {
    ...mergedPayload,
    sectionOptions: SECTION_OPTIONS,
    describeSectionScope
  });
}

router.get('/', (req, res) => {
  renderSearch(res);
});

router.post('/', async (req, res) => {
  const { keyword, dataInicio, dataFim } = req.body;
  const sections = normalizeSectionIds(req.body.sections);
  const highlightConfig = buildHighlightConfig({ text: keyword, sections });

  try {
    const { results, totalRaw } = await searchOccurrences({
      text: keyword,
      sections,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null
    });

    const resultados = results.map(item => ({
      ...item,
      highlightedResumo: highlightText(item.resumo || '', highlightConfig.terms)
    }));

    renderSearch(res, {
      resultados,
      totalBruto: totalRaw,
      params: { keyword, dataInicio, dataFim, sections },
      highlightTerms: highlightConfig.terms,
      ignoredShortKeyword: highlightConfig.ignoredShortKeyword
    });
  } catch (err) {
    const erro = err.message === 'informe-palavra-ou-secao'
      ? 'Informe uma palavra-chave ou selecione ao menos uma seção específica.'
      : err.message;

    renderSearch(res, {
      resultados: [],
      totalBruto: 0,
      erro,
      params: { keyword, dataInicio, dataFim, sections },
      highlightTerms: highlightConfig.terms,
      ignoredShortKeyword: highlightConfig.ignoredShortKeyword
    });
  }
});

module.exports = router;
