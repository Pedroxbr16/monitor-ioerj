const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/requireAuth');
const { searchOccurrences } = require('../services/occurrenceQuery');
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
    erro: null
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

  try {
    const { results, totalRaw } = await searchOccurrences({
      text: keyword,
      sections,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null
    });

    renderSearch(res, {
      resultados: results,
      totalBruto: totalRaw,
      params: { keyword, dataInicio, dataFim, sections }
    });
  } catch (err) {
    const erro = err.message === 'informe-palavra-ou-secao'
      ? 'Informe uma palavra-chave ou selecione ao menos uma seção específica.'
      : err.message;

    renderSearch(res, {
      resultados: [],
      totalBruto: 0,
      erro,
      params: { keyword, dataInicio, dataFim, sections }
    });
  }
});

module.exports = router;
