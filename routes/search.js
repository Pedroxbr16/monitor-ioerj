const express = require('express');
const router = express.Router();
const { buscar } = require('../services/scraper');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

function normalizar(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filtrarExato(resultados, keyword) {
  const termo = normalizar(keyword);
  if (!termo) return resultados;

  return resultados.filter(item => {
    const resumo = normalizar(item.resumo);
    return resumo.includes(termo);
  });
}

router.get('/', (req, res) => {
  res.render('search', { resultados: null, params: {}, totalBruto: 0 });
});

router.post('/', async (req, res) => {
  const { keyword, dataInicio, dataFim } = req.body;
  try {
    const todos = await buscar(keyword, dataInicio || null, dataFim || null);
    const totalBruto = todos.length;
    const resultados = filtrarExato(todos, keyword);
    res.render('search', { resultados, params: { keyword, dataInicio, dataFim }, totalBruto });
  } catch (err) {
    res.render('search', { resultados: [], params: { keyword, dataInicio, dataFim }, totalBruto: 0, erro: err.message });
  }
});

module.exports = router;
