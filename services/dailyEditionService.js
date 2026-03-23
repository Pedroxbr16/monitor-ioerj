const { chromium } = require('playwright');

const { SECTION_OPTIONS } = require('../src/sections');

const DOERJ_BASE_URL = 'https://www.ioerj.com.br/portal/modules/conteudoonline';
const EXECUTIVE_PART_LABEL = 'Parte I (Poder Executivo)';
const CACHE_TTL_MS = 10 * 60 * 1000;

const editionCache = new Map();

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SECTION_BY_LABEL = new Map(
  SECTION_OPTIONS.map(section => [normalizeText(section.label), section])
);

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSelectionUrl(dateKey) {
  const encodedDate = Buffer.from(String(dateKey || '').replace(/-/g, ''), 'utf8').toString('base64');
  return `${DOERJ_BASE_URL}/do_seleciona_edicao.php?data=${encodedDate}`;
}

function formatDisplayDate(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return '';
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function cleanExtractedText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/([A-Za-zÀ-ÿ])-\s+([A-Za-zÀ-ÿ])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
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

function buildSectionRanges(summaryOptions, totalPages) {
  const topLevelOptions = summaryOptions
    .filter(option => isTopLevelOption(option.label) && option.page > 0)
    .map(option => ({
      ...option,
      normalizedLabel: normalizeText(option.label)
    }));

  const ranges = [];

  for (let index = 0; index < topLevelOptions.length; index += 1) {
    const option = topLevelOptions[index];
    const section = SECTION_BY_LABEL.get(option.normalizedLabel);

    if (!section) {
      continue;
    }

    const nextTopLevel = topLevelOptions
      .slice(index + 1)
      .find(candidate => candidate.page >= option.page) || null;

    const endPage = nextTopLevel
      ? Math.max(option.page, nextTopLevel.page - 1)
      : totalPages;

    ranges.push({
      section,
      sectionOption: option,
      nextTopLevel,
      startPage: option.page,
      endPage
    });
  }

  return ranges;
}

function extractOccurrenceType(blockText, sectionLabel) {
  const withoutId = String(blockText || '')
    .replace(/\s*Id:\s*\d+\s*$/i, '')
    .trim();

  let remainder = withoutId;
  const labelRegex = new RegExp(`^${escapeRegex(sectionLabel)}\\s*`, 'i');
  remainder = remainder.replace(labelRegex, '').trim();

  const typedMatch = remainder.match(/^(.*?)(?=\s+DE\s+\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b)/i);
  if (typedMatch && typedMatch[1]) {
    return typedMatch[1].trim().slice(0, 180);
  }

  return remainder.split(/\s+/).slice(0, 12).join(' ').trim();
}

function truncateText(value, maxLength = 1200) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function extractOccurrencesFromRange(range, pageTextsByPage, viewerUrl, dateKey) {
  const pageTexts = [];

  for (let pageNumber = range.startPage; pageNumber <= range.endPage; pageNumber += 1) {
    const pageText = pageTextsByPage.get(pageNumber);
    if (!pageText) {
      continue;
    }

    const boundaryConfig = {};

    if (pageNumber === range.startPage) {
      boundaryConfig.startLabel = range.sectionOption.label;
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
    return [];
  }

  const joinedText = pageTexts.join(' ');
  const occurrencePattern = /([\s\S]*?Id:\s*(\d+))/gi;
  const occurrences = [];
  let match;

  while ((match = occurrencePattern.exec(joinedText)) !== null) {
    const pageMatch = match[1].match(/<<PAGE:(\d+)>>/);
    const pageNumber = pageMatch ? pageMatch[1] : String(range.startPage);
    const blockText = cleanExtractedText(match[1].replace(/<<PAGE:\d+>>/g, ' '));
    const normalizedBlock = normalizeText(blockText);

    if (!normalizedBlock.includes(normalizeText(range.section.label))) {
      continue;
    }

    occurrences.push({
      idMateria: match[2],
      dataPublicacao: formatDisplayDate(dateKey),
      pagina: String(pageNumber || ''),
      jornal: EXECUTIVE_PART_LABEL,
      tipo: extractOccurrenceType(blockText, range.sectionOption.label),
      resumo: truncateText(blockText),
      sourceUrl: `${viewerUrl}#page=${pageNumber}`,
      matchedSectionIds: [range.section.id],
      coletadoEm: new Date().toISOString()
    });
  }

  return occurrences;
}

async function fetchExecutiveEdition(dateKey) {
  const browser = await chromium.launch({ headless: true });

  try {
    const selectionPage = await browser.newPage();
    await selectionPage.goto(buildSelectionUrl(dateKey), {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const partLinks = await selectionPage.locator('a[href*="mostra_edicao.php"]').evaluateAll(nodes => {
      return nodes.map(node => ({
        label: (node.textContent || '').trim(),
        href: node.href
      }));
    });

    const executiveLink = partLinks.find(link => normalizeText(link.label) === normalizeText(EXECUTIVE_PART_LABEL));
    await selectionPage.close();

    if (!executiveLink || !executiveLink.href) {
      return [];
    }

    const viewerPage = await browser.newPage();
    await viewerPage.goto(executiveLink.href, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await viewerPage.waitForFunction(() => {
      return Boolean(window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument);
    }, null, { timeout: 60000 });

    const summaryOptions = await viewerPage.locator('#sumario option').evaluateAll(nodes => {
      return nodes.map(node => ({
        label: (node.textContent || '').trim(),
        page: Number(node.value || 0)
      }));
    });

    const totalPages = await viewerPage.evaluate(() => {
      return window.PDFViewerApplication?.pagesCount || 0;
    });

    const sectionRanges = buildSectionRanges(summaryOptions, totalPages);
    const pageNumbers = [...new Set(sectionRanges.flatMap(range => {
      const values = [];
      for (let pageNumber = range.startPage; pageNumber <= range.endPage; pageNumber += 1) {
        values.push(pageNumber);
      }
      return values;
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

    for (const range of sectionRanges) {
      const occurrences = extractOccurrencesFromRange(
        range,
        pageTextsByPage,
        executiveLink.href,
        dateKey
      );

      for (const occurrence of occurrences) {
        const existing = dedupedOccurrences.get(occurrence.idMateria);

        if (!existing) {
          dedupedOccurrences.set(occurrence.idMateria, occurrence);
          continue;
        }

        existing.matchedSectionIds = [
          ...(existing.matchedSectionIds || []),
          ...(occurrence.matchedSectionIds || [])
        ].filter((value, index, values) => values.indexOf(value) === index);
      }
    }

    await viewerPage.close();
    return [...dedupedOccurrences.values()];
  } finally {
    await browser.close();
  }
}

async function buscarEdicaoExecutiva(dateKey) {
  const cacheKey = String(dateKey || '').trim();
  const cached = editionCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = fetchExecutiveEdition(cacheKey).catch(err => {
    editionCache.delete(cacheKey);
    throw err;
  });

  editionCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise
  });

  return promise;
}

module.exports = {
  EXECUTIVE_PART_LABEL,
  buscarEdicaoExecutiva
};
