const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

const requireAuth = require('../middleware/requireAuth');
const DoerjEdition = require('../models/DoerjEdition');

const router = express.Router();

const ARCHIVE_ROOT_DIR = path.resolve(
  process.cwd(),
  process.env.DOERJ_ARCHIVE_DIR || './dados/doerj'
);

router.use(requireAuth);

function sanitizeFileName(value) {
  return String(value || 'doerj-marcado')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function parsePositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEditionAbsolutePath(edition) {
  const absolutePath = path.resolve(process.cwd(), String(edition.localPdfPath || ''));
  const rootWithSep = `${ARCHIVE_ROOT_DIR}${path.sep}`;

  if (absolutePath !== ARCHIVE_ROOT_DIR && !absolutePath.startsWith(rootWithSep)) {
    throw new Error('arquivo-fora-do-acervo');
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error('arquivo-nao-encontrado');
  }

  return absolutePath;
}

function normalizeExportMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'full'
    ? 'full'
    : 'selected';
}

function normalizeHighlights(rawHighlights, totalPages) {
  if (!Array.isArray(rawHighlights) || !rawHighlights.length) {
    throw new Error('destaques-vazios');
  }

  if (rawHighlights.length > 2500) {
    throw new Error('destaques-demais');
  }

  const normalized = [];

  for (const rawHighlight of rawHighlights) {
    const page = parsePositiveInt(rawHighlight.page, 0);
    if (!page || page > totalPages) {
      continue;
    }

    const rects = Array.isArray(rawHighlight.rects) ? rawHighlight.rects : [];
    const normalizedRects = [];

    for (const rect of rects) {
      const x1 = Number(rect?.x1);
      const y1 = Number(rect?.y1);
      const x2 = Number(rect?.x2);
      const y2 = Number(rect?.y2);

      if (![x1, y1, x2, y2].every(Number.isFinite)) {
        continue;
      }

      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      if (width < 0.5 || height < 0.5) {
        continue;
      }

      normalizedRects.push({ x1, y1, x2, y2 });
    }

    if (!normalizedRects.length) {
      continue;
    }

    normalized.push({
      page,
      rects: normalizedRects
    });
  }

  if (!normalized.length) {
    throw new Error('destaques-invalidos');
  }

  return normalized;
}

function groupHighlightsByPage(highlights) {
  const grouped = new Map();

  for (const highlight of highlights) {
    if (!grouped.has(highlight.page)) {
      grouped.set(highlight.page, []);
    }

    grouped.get(highlight.page).push(...highlight.rects);
  }

  return grouped;
}

function drawHighlightRects(page, rects) {
  for (const rect of rects) {
    const x = Math.min(rect.x1, rect.x2);
    const y = Math.min(rect.y1, rect.y2);
    const width = Math.max(1, Math.abs(rect.x2 - rect.x1));
    const height = Math.max(1, Math.abs(rect.y2 - rect.y1));

    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(1, 1, 0),
      opacity: 0.35,
      borderColor: rgb(0.95, 0.77, 0.06),
      borderWidth: 0.35
    });
  }
}

router.get('/editions/:id/viewer', async (req, res) => {
  const edition = await DoerjEdition.findById(req.params.id).lean();
  if (!edition) {
    return res.status(404).send('Edicao nao encontrada.');
  }

  try {
    normalizeEditionAbsolutePath(edition);
  } catch (err) {
    return res.status(404).send('Arquivo local desta edicao nao encontrado.');
  }

  const totalPages = parsePositiveInt(edition.totalPages, 1);
  const requestedPage = parsePositiveInt(req.query.page, 1);
  const initialPage = Math.min(Math.max(requestedPage, 1), totalPages);

  return res.render('pdf-viewer', {
    edition,
    initialPage
  });
});

router.get('/editions/:id/file', async (req, res) => {
  const edition = await DoerjEdition.findById(req.params.id).lean();
  if (!edition) {
    return res.status(404).send('Edicao nao encontrada.');
  }

  let absolutePath;
  try {
    absolutePath = normalizeEditionAbsolutePath(edition);
  } catch (err) {
    return res.status(404).send('Arquivo local desta edicao nao encontrado.');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${sanitizeFileName(edition.fileName || `doerj-${edition.dateKey}`)}"`
  );

  return res.sendFile(absolutePath);
});

router.post('/editions/:id/export-highlighted', async (req, res) => {
  const edition = await DoerjEdition.findById(req.params.id).lean();
  if (!edition) {
    return res.status(404).json({ ok: false, error: 'Edicao nao encontrada.' });
  }

  let absolutePath;
  try {
    absolutePath = normalizeEditionAbsolutePath(edition);
  } catch (err) {
    return res.status(404).json({ ok: false, error: 'Arquivo local da edicao nao encontrado.' });
  }

  try {
    const sourcePdfBytes = fs.readFileSync(absolutePath);
    const sourcePdf = await PDFDocument.load(sourcePdfBytes);
    const sourceTotalPages = sourcePdf.getPageCount();

    const mode = normalizeExportMode(req.body?.mode);
    const highlights = normalizeHighlights(req.body?.highlights, sourceTotalPages);
    const groupedByPage = groupHighlightsByPage(highlights);
    const sortedPages = [...groupedByPage.keys()].sort((a, b) => a - b);

    let outputPdf;
    const outputPageBySourcePage = new Map();

    if (mode === 'selected') {
      outputPdf = await PDFDocument.create();
      const copiedPages = await outputPdf.copyPages(
        sourcePdf,
        sortedPages.map(page => page - 1)
      );

      copiedPages.forEach((copiedPage, index) => {
        outputPdf.addPage(copiedPage);
        outputPageBySourcePage.set(sortedPages[index], copiedPage);
      });
    } else {
      outputPdf = await PDFDocument.load(sourcePdfBytes);
      sortedPages.forEach(pageNumber => {
        outputPageBySourcePage.set(pageNumber, outputPdf.getPage(pageNumber - 1));
      });
    }

    for (const pageNumber of sortedPages) {
      const page = outputPageBySourcePage.get(pageNumber);
      if (!page) {
        continue;
      }

      drawHighlightRects(page, groupedByPage.get(pageNumber) || []);
    }

    const outputBytes = await outputPdf.save({
      useObjectStreams: false
    });

    const baseName = sanitizeFileName(path.parse(edition.fileName || `doerj-${edition.dateKey}`).name);
    const modeLabel = mode === 'selected' ? 'trechos' : 'completo';
    const exportName = `${baseName}-marcado-${modeLabel}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exportName}"`);

    return res.send(Buffer.from(outputBytes));
  } catch (err) {
    console.error('[pdf-export] Erro ao gerar PDF marcado:', err.message);

    const status = [
      'destaques-vazios',
      'destaques-demais',
      'destaques-invalidos'
    ].includes(err.message)
      ? 400
      : 500;

    const errorMessage = err.message === 'destaques-vazios'
      ? 'Nenhum destaque foi informado.'
      : err.message === 'destaques-demais'
        ? 'Quantidade de destaques excede o limite permitido.'
        : err.message === 'destaques-invalidos'
          ? 'Destaques informados sao invalidos.'
          : 'Falha ao gerar o PDF marcado.';

    return res.status(status).json({
      ok: false,
      error: errorMessage
    });
  }
});

module.exports = router;
