const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { chromium } = require('playwright');

const DoerjEdition = require('../models/DoerjEdition');
const DoerjOccurrence = require('../models/DoerjOccurrence');
const { SECTION_OPTIONS } = require('../src/sections');

const DOERJ_BASE_URL = 'https://www.ioerj.com.br/portal/modules/conteudoonline';
const DEFAULT_ARCHIVE_DIR = path.join(__dirname, '..', 'dados', 'doerj');

const sectionLabelById = new Map(
  SECTION_OPTIONS.map(section => [section.id, normalizeText(section.label)])
);

const syncByDatePromise = new Map();
let syncLatestPromise = null;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day)
  };
}

function formatDateKeyFromParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplayDate(dateKey) {
  const parts = parseDateKey(dateKey);
  if (!parts) {
    return '';
  }

  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

function getBrazilDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return formatDateKeyFromParts(year, month, day);
}

function addDays(dateKey, days) {
  const parts = parseDateKey(dateKey);
  if (!parts) {
    return null;
  }

  const current = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  current.setUTCDate(current.getUTCDate() + Number(days || 0));
  return formatDateKeyFromParts(
    current.getUTCFullYear(),
    current.getUTCMonth() + 1,
    current.getUTCDate()
  );
}

function cleanExtractedText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/([A-Za-z\u00c0-\u00ff])-\s+([A-Za-z\u00c0-\u00ff])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTopLevelOption(label) {
  return !!String(label || '').trim() && !String(label || '').trim().startsWith('-');
}

function findValidLabelIndex(text, label) {
  const target = String(label || '').trim();
  if (!target) {
    return -1;
  }

  const ids = [...String(text || '').matchAll(/Id:\s*\d+/gi)].map(match => match.index);
  const labelRegex = new RegExp(escapeRegex(target), 'gi');

  for (const match of String(text || '').matchAll(labelRegex)) {
    const index = match.index;
    if (typeof index !== 'number') {
      continue;
    }

    if (index === 0 || ids.some(idIndex => idIndex < index)) {
      return index;
    }
  }

  return -1;
}

function cropSectionPageText(text, { startLabel = null, endLabel = null } = {}) {
  let cropped = String(text || '');

  if (startLabel) {
    const startIndex = findValidLabelIndex(cropped, startLabel);
    if (startIndex >= 0) {
      cropped = cropped.slice(startIndex);
    }
  }

  if (endLabel) {
    const endIndex = findValidLabelIndex(cropped, endLabel);
    if (endIndex > 0) {
      cropped = cropped.slice(0, endIndex);
    }
  }

  return cropped.trim();
}

function extractOccurrenceType(blockText, sectionLabel) {
  const withoutId = String(blockText || '')
    .replace(/\s*Id:\s*\d+\s*$/i, '')
    .trim();

  let remainder = withoutId;
  const labelRegex = new RegExp(`^${escapeRegex(sectionLabel)}\\s*`, 'i');
  remainder = remainder.replace(labelRegex, '').trim();

  const typedMatch = remainder.match(/^(.*?)(?=\s+DE\s+\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b)/i);
  if (typedMatch && typedMatch[1]) {
    return typedMatch[1].trim().slice(0, 180);
  }

  return remainder.split(/\s+/).slice(0, 12).join(' ').trim();
}

function truncateText(value, maxLength = 1600) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function buildSelectionUrl(dateKey) {
  const encodedDate = Buffer.from(String(dateKey || '').replace(/-/g, ''), 'utf8').toString('base64');
  return `${DOERJ_BASE_URL}/do_seleciona_edicao.php?data=${encodedDate}`;
}

function buildArchivePathInfo(dateKey, partSlug, archiveRootDir = DEFAULT_ARCHIVE_DIR) {
  const parts = parseDateKey(dateKey);
  if (!parts) {
    throw new Error(`dateKey invalido: "${dateKey}"`);
  }

  const yyyy = String(parts.year).padStart(4, '0');
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  const dayDir = path.join(archiveRootDir, yyyy, mm, dd);
  const fileName = `${dd}-${partSlug}.pdf`;
  const absolutePath = path.join(dayDir, fileName);

  return {
    ...parts,
    dayDir,
    fileName,
    absolutePath,
    relativePath: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/')
  };
}

function buildSectionRanges(summaryOptions, totalPages, fallbackLabel) {
  const topLevelOptions = summaryOptions
    .filter(option => isTopLevelOption(option.label) && option.page > 0)
    .map(option => ({ ...option }));

  if (!topLevelOptions.length && totalPages > 0) {
    return [{
      label: fallbackLabel || 'Documento',
      page: 1,
      startPage: 1,
      endPage: totalPages,
      nextTopLevel: null
    }];
  }

  const ranges = [];

  for (let index = 0; index < topLevelOptions.length; index += 1) {
    const option = topLevelOptions[index];
    const nextTopLevel = topLevelOptions
      .slice(index + 1)
      .find(candidate => candidate.page >= option.page) || null;

    const endPage = nextTopLevel
      ? Math.max(option.page, nextTopLevel.page - 1)
      : totalPages;

    ranges.push({
      label: option.label,
      page: option.page,
      startPage: option.page,
      endPage,
      nextTopLevel
    });
  }

  return ranges;
}

function getMatchedSectionIds(blockText, sectionLabel) {
  const normalizedBlock = normalizeText(`${sectionLabel || ''} ${blockText || ''}`);
  const matched = [];

  for (const [sectionId, normalizedLabel] of sectionLabelById.entries()) {
    if (!normalizedLabel) {
      continue;
    }

    if (normalizedBlock.startsWith(normalizedLabel) || normalizedBlock.includes(normalizedLabel)) {
      matched.push(sectionId);
    }
  }

  return matched;
}

function buildSearchTextNormalized(payload) {
  return normalizeText([
    payload.idMateria || '',
    payload.sectionLabel || '',
    payload.tipo || '',
    payload.resumo || '',
    payload.jornal || ''
  ].join(' '));
}

async function downloadPdfToFile(pdfUrl, absolutePath) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  const response = await axios.get(pdfUrl, {
    responseType: 'stream',
    timeout: 120000
  });

  const tmpPath = `${absolutePath}.tmp`;
  try {
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tmpPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    fs.renameSync(tmpPath, absolutePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }

    if (err && err.code === 'ENOSPC') {
      throw new Error('Espaco em disco insuficiente (ENOSPC) durante download do PDF.');
    }

    throw err;
  }

  const stat = fs.statSync(absolutePath);
  return stat.size;
}

async function extractPartData(browser, partLink, dateKey, partSlug) {
  const viewerPage = await browser.newPage();

  try {
    await viewerPage.goto(partLink.href, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await viewerPage.waitForFunction(() => {
      return Boolean(window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument);
    }, null, { timeout: 60000 });

    const metadata = await viewerPage.evaluate(() => {
      const app = window.PDFViewerApplication;
      const summaryNodes = [...document.querySelectorAll('#sumario option')];

      return {
        viewerUrl: window.location.href,
        pdfUrl: app?.url || '',
        totalPages: Number(app?.pagesCount || app?.pdfDocument?.numPages || 0),
        pdfFingerprint: app?.pdfDocument?.fingerprint || '',
        summaryOptions: summaryNodes.map(node => ({
          label: (node.textContent || '').trim(),
          page: Number(node.value || 0)
        }))
      };
    });

    if (!metadata.pdfUrl) {
      throw new Error(`Nao foi possivel identificar a URL do PDF para "${partLink.label}".`);
    }

    const sectionRanges = buildSectionRanges(
      metadata.summaryOptions,
      metadata.totalPages,
      partLink.label
    );

    const pageNumbers = [...new Set(sectionRanges.flatMap(range => {
      const pages = [];
      for (let pageNumber = range.startPage; pageNumber <= range.endPage; pageNumber += 1) {
        pages.push(pageNumber);
      }
      return pages;
    }))];

    const rawPageTexts = await viewerPage.evaluate(async numbers => {
      const pdf = window.PDFViewerApplication.pdfDocument;
      const output = [];

      for (const pageNumber of numbers) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        output.push({
          page: pageNumber,
          text: textContent.items.map(item => item.str).join(' ')
        });
      }

      return output;
    }, pageNumbers);

    const pageTextsByPage = new Map(
      rawPageTexts.map(item => [item.page, cleanExtractedText(item.text)])
    );

    const dedupedOccurrences = new Map();
    const formattedDate = formatDisplayDate(dateKey);

    for (const range of sectionRanges) {
      const pageTexts = [];

      for (let pageNumber = range.startPage; pageNumber <= range.endPage; pageNumber += 1) {
        const pageText = pageTextsByPage.get(pageNumber);
        if (!pageText) {
          continue;
        }

        const boundaryConfig = {};
        if (pageNumber === range.startPage) {
          boundaryConfig.startLabel = range.label;
        }
        if (range.nextTopLevel && range.nextTopLevel.page === pageNumber) {
          boundaryConfig.endLabel = range.nextTopLevel.label;
        }

        const boundedText = cropSectionPageText(pageText, boundaryConfig);
        if (!boundedText) {
          continue;
        }

        pageTexts.push(`<<PAGE:${pageNumber}>> ${boundedText}`);
      }

      if (!pageTexts.length) {
        continue;
      }

      const joinedText = pageTexts.join(' ');
      const occurrencePattern = /([\s\S]*?Id:\s*(\d+))/gi;
      let match;

      while ((match = occurrencePattern.exec(joinedText)) !== null) {
        const pageMatch = match[1].match(/<<PAGE:(\d+)>>/);
        const pageNumber = pageMatch ? pageMatch[1] : String(range.startPage || '');
        const blockText = cleanExtractedText(match[1].replace(/<<PAGE:\d+>>/g, ' '));
        const idMateria = String(match[2] || '').trim();
        const sectionLabel = String(range.label || '').trim();
        const sectionLabelNormalized = normalizeText(sectionLabel);

        if (!idMateria) {
          continue;
        }

        const occurrence = {
          idMateria,
          dataPublicacao: formattedDate,
          pagina: String(pageNumber || ''),
          jornal: partLink.label,
          tipo: extractOccurrenceType(blockText, sectionLabel),
          resumo: truncateText(blockText),
          sourceUrl: `${metadata.viewerUrl}#page=${pageNumber}`,
          sectionLabel,
          sectionLabelNormalized,
          matchedSectionIds: getMatchedSectionIds(blockText, sectionLabel),
          partSlug,
          partLabel: partLink.label,
          dateKey,
          coletadoEm: new Date()
        };

        occurrence.searchTextNormalized = buildSearchTextNormalized(occurrence);

        const dedupeKey = [
          occurrence.idMateria,
          occurrence.pagina,
          occurrence.sectionLabelNormalized
        ].join('|');

        if (!dedupedOccurrences.has(dedupeKey)) {
          dedupedOccurrences.set(dedupeKey, occurrence);
        }
      }
    }

    return {
      ...metadata,
      sectionRanges,
      occurrences: [...dedupedOccurrences.values()]
    };
  } finally {
    await viewerPage.close();
  }
}

async function listPartLinks(selectionPage, selectionUrl) {
  const links = await selectionPage.locator('a[href*="mostra_edicao.php"]').evaluateAll(nodes => {
    return nodes.map(node => ({
      label: (node.textContent || '').trim(),
      href: node.getAttribute('href') || ''
    }));
  });

  return links
    .map(link => ({
      label: String(link.label || '').trim(),
      href: new URL(link.href, selectionUrl).toString()
    }))
    .filter(link => link.label && link.href);
}

function canSkipExisting(existingEdition, skipExisting) {
  if (!skipExisting || !existingEdition) {
    return false;
  }

  const localPath = path.resolve(process.cwd(), String(existingEdition.localPdfPath || ''));
  return !!existingEdition.localPdfPath && fs.existsSync(localPath);
}

async function syncPartArchive({
  browser,
  dateKey,
  selectionUrl,
  partLink,
  archiveRootDir,
  skipExisting,
  source
}) {
  const partSlug = slugifyLabel(partLink.label) || 'parte';
  const existingEdition = await DoerjEdition.findOne({ dateKey, partSlug }).lean();

  if (canSkipExisting(existingEdition, skipExisting)) {
    const existingCount = await DoerjOccurrence.countDocuments({ editionId: existingEdition._id });
    return {
      dateKey,
      partLabel: partLink.label,
      partSlug,
      status: 'skipped',
      savedOccurrences: existingCount
    };
  }

  const partData = await extractPartData(browser, partLink, dateKey, partSlug);
  const pathInfo = buildArchivePathInfo(dateKey, partSlug, archiveRootDir);
  const fileSizeBytes = await downloadPdfToFile(partData.pdfUrl, pathInfo.absolutePath);

  const edition = await DoerjEdition.findOneAndUpdate(
    { dateKey, partSlug },
    {
      $set: {
        dateKey,
        year: pathInfo.year,
        month: pathInfo.month,
        day: pathInfo.day,
        partLabel: partLink.label,
        partSlug,
        selectionUrl,
        viewerUrl: partData.viewerUrl,
        pdfUrl: partData.pdfUrl,
        pdfFingerprint: partData.pdfFingerprint,
        localPdfPath: pathInfo.relativePath,
        fileName: pathInfo.fileName,
        fileSizeBytes,
        totalPages: partData.totalPages,
        sectionRanges: partData.sectionRanges.map(range => ({
          label: range.label,
          page: range.page,
          startPage: range.startPage,
          endPage: range.endPage
        })),
        status: partData.occurrences.length ? 'ok' : 'empty',
        source,
        downloadedAt: new Date(),
        processedAt: new Date(),
        updatedAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  await DoerjOccurrence.deleteMany({ editionId: edition._id });

  if (partData.occurrences.length) {
    await DoerjOccurrence.insertMany(
      partData.occurrences.map(item => ({
        editionId: edition._id,
        dateKey,
        year: pathInfo.year,
        month: pathInfo.month,
        day: pathInfo.day,
        partLabel: partLink.label,
        partSlug,
        sectionLabel: item.sectionLabel,
        sectionLabelNormalized: item.sectionLabelNormalized,
        matchedSectionIds: item.matchedSectionIds || [],
        idMateria: item.idMateria,
        dataPublicacao: item.dataPublicacao,
        pagina: item.pagina,
        jornal: item.jornal,
        tipo: item.tipo,
        resumo: item.resumo,
        sourceUrl: item.sourceUrl,
        searchTextNormalized: item.searchTextNormalized,
        coletadoEm: item.coletadoEm || new Date()
      })),
      { ordered: false }
    );
  }

  return {
    dateKey,
    partLabel: partLink.label,
    partSlug,
    status: 'ok',
    filePath: pathInfo.relativePath,
    fileSizeBytes,
    totalPages: partData.totalPages,
    savedOccurrences: partData.occurrences.length
  };
}

function filterPartLinks(partLinks, options = {}) {
  const includeLabels = Array.isArray(options.includeLabels)
    ? options.includeLabels.map(value => normalizeText(value)).filter(Boolean)
    : [];

  const includeSlugs = Array.isArray(options.includeSlugs)
    ? options.includeSlugs.map(value => slugifyLabel(value)).filter(Boolean)
    : [];

  if (!includeLabels.length && !includeSlugs.length) {
    return partLinks;
  }

  return partLinks.filter(link => {
    const normalizedLabel = normalizeText(link.label);
    const slug = slugifyLabel(link.label);

    const byLabel = includeLabels.some(pattern => normalizedLabel.includes(pattern));
    const bySlug = includeSlugs.includes(slug);
    return byLabel || bySlug;
  });
}

async function executeSyncArchiveByDate(dateKey, options = {}) {
  const parsedDate = parseDateKey(dateKey);
  if (!parsedDate) {
    throw new Error(`Data invalida para sincronizacao: "${dateKey}"`);
  }

  const archiveRootDir = options.archiveRootDir || process.env.DOERJ_ARCHIVE_DIR || DEFAULT_ARCHIVE_DIR;
  const source = String(options.source || 'manual');
  const skipExisting = options.skipExisting !== false;
  const selectionUrl = buildSelectionUrl(dateKey);

  const browser = await chromium.launch({ headless: true });

  try {
    const selectionPage = await browser.newPage();
    await selectionPage.goto(selectionUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const allPartLinks = await listPartLinks(selectionPage, selectionUrl);
    await selectionPage.close();

    const partLinks = filterPartLinks(allPartLinks, options);

    if (!partLinks.length) {
      return {
        dateKey,
        selectionUrl,
        status: 'no-edition',
        partsFound: allPartLinks.length,
        partsProcessed: 0,
        partsSkipped: 0,
        savedOccurrences: 0,
        results: []
      };
    }

    const results = [];
    let partsProcessed = 0;
    let partsSkipped = 0;
    let savedOccurrences = 0;

    for (const partLink of partLinks) {
      const result = await syncPartArchive({
        browser,
        dateKey,
        selectionUrl,
        partLink,
        archiveRootDir,
        skipExisting,
        source
      });

      results.push(result);

      if (result.status === 'skipped') {
        partsSkipped += 1;
      } else {
        partsProcessed += 1;
      }

      savedOccurrences += Number(result.savedOccurrences || 0);
    }

    return {
      dateKey,
      selectionUrl,
      status: 'ok',
      partsFound: allPartLinks.length,
      partsProcessed,
      partsSkipped,
      savedOccurrences,
      results
    };
  } finally {
    await browser.close();
  }
}

async function syncArchiveByDate(dateKey, options = {}) {
  const key = String(dateKey || '').trim();
  if (!key) {
    throw new Error('Informe um dateKey valido (YYYY-MM-DD).');
  }

  const existingPromise = syncByDatePromise.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = executeSyncArchiveByDate(key, options).finally(() => {
    syncByDatePromise.delete(key);
  });

  syncByDatePromise.set(key, promise);
  return promise;
}

async function syncArchiveToday(options = {}) {
  if (syncLatestPromise) {
    return syncLatestPromise;
  }

  const dateKey = options.dateKey || getBrazilDateKey();
  if (!dateKey) {
    throw new Error('Nao foi possivel calcular a data de hoje para sincronizacao.');
  }

  syncLatestPromise = syncArchiveByDate(dateKey, options).finally(() => {
    syncLatestPromise = null;
  });

  return syncLatestPromise;
}

async function syncArchiveRange({ startDate, endDate, skipExisting = true, source = 'backfill', ...options }) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);

  if (!start || !end) {
    throw new Error('Informe startDate e endDate validos no formato YYYY-MM-DD.');
  }

  let cursor = formatDateKeyFromParts(start.year, start.month, start.day);
  const limit = formatDateKeyFromParts(end.year, end.month, end.day);

  if (cursor > limit) {
    throw new Error('startDate nao pode ser maior que endDate.');
  }

  const results = [];
  let totalSavedOccurrences = 0;
  let totalProcessedParts = 0;
  let totalSkippedParts = 0;
  let totalErrors = 0;
  let stoppedByDiskFull = false;

  while (cursor <= limit) {
    try {
      const syncResult = await syncArchiveByDate(cursor, {
        ...options,
        skipExisting,
        source
      });

      totalSavedOccurrences += Number(syncResult.savedOccurrences || 0);
      totalProcessedParts += Number(syncResult.partsProcessed || 0);
      totalSkippedParts += Number(syncResult.partsSkipped || 0);
      results.push(syncResult);
    } catch (err) {
      totalErrors += 1;
      const diskFull = /ENOSPC|espaco em disco insuficiente/i.test(String(err && err.message ? err.message : ''));
      results.push({
        dateKey: cursor,
        status: diskFull ? 'error-disk-full' : 'error',
        error: err.message
      });

      if (diskFull) {
        stoppedByDiskFull = true;
        break;
      }
    }

    cursor = addDays(cursor, 1);
  }

  return {
    startDate: startDate,
    endDate: endDate,
    totalDays: results.length,
    totalSavedOccurrences,
    totalProcessedParts,
    totalSkippedParts,
    totalErrors,
    stoppedByDiskFull,
    results
  };
}

function buildArchiveDateRangeQuery(dataInicio, dataFim) {
  const start = parseDateKey(dataInicio);
  const end = parseDateKey(dataFim);

  if (!start && !end) {
    return null;
  }

  const query = {};
  if (start) {
    query.$gte = formatDateKeyFromParts(start.year, start.month, start.day);
  }
  if (end) {
    query.$lte = formatDateKeyFromParts(end.year, end.month, end.day);
  }

  return query;
}

async function searchArchivedOccurrences({ text, sections, dataInicio, dataFim, limit = 3000 }) {
  const query = {};
  const dateQuery = buildArchiveDateRangeQuery(dataInicio, dataFim);
  const normalizedText = normalizeText(text);
  const sectionIds = Array.isArray(sections) ? sections.filter(Boolean) : [];

  if (dateQuery) {
    query.dateKey = dateQuery;
  }

  if (sectionIds.length) {
    query.matchedSectionIds = { $in: sectionIds };
  }

  if (normalizedText) {
    query.searchTextNormalized = {
      $regex: escapeRegex(normalizedText),
      $options: 'i'
    };
  }

  const safeLimit = Math.max(1, Math.min(Number(limit || 3000), 10000));

  const docs = await DoerjOccurrence.find(query)
    .sort({ dateKey: -1, partSlug: 1, pagina: 1, idMateria: 1 })
    .limit(safeLimit)
    .select({
      editionId: 1,
      idMateria: 1,
      dataPublicacao: 1,
      pagina: 1,
      jornal: 1,
      tipo: 1,
      resumo: 1,
      sourceUrl: 1,
      matchedSectionIds: 1,
      coletadoEm: 1
    })
    .lean();

  return docs.map(item => ({
    archiveEditionId: item.editionId ? String(item.editionId) : '',
    archivePage: Number.parseInt(String(item.pagina || ''), 10) || null,
    archived: true,
    idMateria: item.idMateria,
    dataPublicacao: item.dataPublicacao,
    pagina: item.pagina,
    jornal: item.jornal || item.partLabel,
    tipo: item.tipo,
    resumo: item.resumo,
    sourceUrl: item.sourceUrl,
    matchedSectionIds: item.matchedSectionIds || [],
    coletadoEm: item.coletadoEm
  }));
}

module.exports = {
  DEFAULT_ARCHIVE_DIR,
  buildSelectionUrl,
  getBrazilDateKey,
  parseDateKey,
  syncArchiveByDate,
  syncArchiveToday,
  syncArchiveRange,
  searchArchivedOccurrences
};
