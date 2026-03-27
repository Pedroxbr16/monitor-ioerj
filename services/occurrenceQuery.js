const { buscar } = require('./scraper');
const { buscarEdicaoExecutiva } = require('./dailyEditionService');
const { searchArchivedOccurrences } = require('./doerjArchiveService');
const { normalizeSectionIds, getSectionById } = require('../src/sections');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseInputDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
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

  return `${year}-${month}-${day}`;
}

function parsePublicationDate(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function resolveDirectEditionDates(dataInicio, dataFim) {
  const startDate = parseInputDate(dataInicio);
  const endDate = parseInputDate(dataFim);
  const today = getBrazilDateKey();

  if (startDate && endDate) {
    if (startDate === endDate) {
      return [startDate];
    }

    if (today && startDate <= today && today <= endDate) {
      return [today];
    }

    return [];
  }

  if (startDate) {
    return [startDate];
  }

  if (endDate) {
    return [endDate];
  }

  return today ? [today] : [];
}

function isWithinDateRange(occurrence, dataInicio, dataFim) {
  const publicationDate = parsePublicationDate(occurrence.dataPublicacao);
  const startDate = parseInputDate(dataInicio);
  const endDate = parseInputDate(dataFim);

  if (!startDate && !endDate) {
    return true;
  }

  if (!publicationDate) {
    return false;
  }

  if (startDate && publicationDate < startDate) {
    return false;
  }

  if (endDate && publicationDate > endDate) {
    return false;
  }

  return true;
}

function buildOccurrenceKey(occurrence) {
  if (occurrence.idMateria) {
    return String(occurrence.idMateria);
  }

  return [
    occurrence.dataPublicacao || '',
    occurrence.pagina || '',
    occurrence.jornal || '',
    occurrence.tipo || '',
    occurrence.resumo || ''
  ].join('|');
}

function buildOccurrenceSearchText(occurrence) {
  return normalizeText([
    occurrence.resumo || '',
    occurrence.jornal || '',
    occurrence.tipo || '',
    occurrence.idMateria || ''
  ].join(' '));
}

function matchesKeyword(occurrence, keywordText) {
  const normalizedKeyword = normalizeText(keywordText);
  if (!normalizedKeyword) {
    return true;
  }

  return buildOccurrenceSearchText(occurrence).includes(normalizedKeyword);
}

function matchesSection(occurrence, section) {
  const normalizedSection = normalizeText(section && section.label);
  if (!normalizedSection) {
    return true;
  }

  return normalizeText(occurrence.resumo).startsWith(normalizedSection);
}

function mergeOccurrences(occurrences) {
  const merged = new Map();

  for (const occurrence of occurrences) {
    const key = buildOccurrenceKey(occurrence);
    const existing = merged.get(key);

    if (!existing) {
      const matchedSectionIds = Array.isArray(occurrence.matchedSectionIds)
        ? [...new Set(occurrence.matchedSectionIds)]
        : [];

      merged.set(key, { ...occurrence, matchedSectionIds });
      continue;
    }

    const combinedSections = [
      ...(existing.matchedSectionIds || []),
      ...(occurrence.matchedSectionIds || [])
    ];

    existing.matchedSectionIds = [...new Set(combinedSections)];

    if (String(occurrence.resumo || '').length > String(existing.resumo || '').length) {
      existing.resumo = occurrence.resumo;
    }

    if (String(occurrence.tipo || '').length > String(existing.tipo || '').length) {
      existing.tipo = occurrence.tipo;
    }

    if (String(occurrence.jornal || '').length > String(existing.jornal || '').length) {
      existing.jornal = occurrence.jornal;
    }

    if (!existing.pagina && occurrence.pagina) existing.pagina = occurrence.pagina;
    if (!existing.sourceUrl && occurrence.sourceUrl) existing.sourceUrl = occurrence.sourceUrl;
    if (!existing.coletadoEm && occurrence.coletadoEm) existing.coletadoEm = occurrence.coletadoEm;
    if (!existing.dataPublicacao && occurrence.dataPublicacao) {
      existing.dataPublicacao = occurrence.dataPublicacao;
    }
  }

  return [...merged.values()];
}

async function searchOccurrences({ text, sections, dataInicio = null, dataFim = null }) {
  const keywordText = String(text || '').trim();
  const sectionIds = normalizeSectionIds(sections);
  const requestedSectionIds = new Set(sectionIds);
  const directEditionDates = resolveDirectEditionDates(dataInicio, dataFim);

  if (!keywordText && !sectionIds.length) {
    throw new Error('informe-palavra-ou-secao');
  }

  const archiveQueryLimit = Number(process.env.ARCHIVE_SEARCH_LIMIT || 3000);
  try {
    const archived = await searchArchivedOccurrences({
      text: keywordText,
      sections: sectionIds,
      dataInicio,
      dataFim,
      limit: archiveQueryLimit
    });

    if (archived.length) {
      return {
        results: mergeOccurrences(archived),
        totalRaw: archived.length,
        sectionIds
      };
    }
  } catch (err) {
    console.error('[archive-search] Falha ao consultar acervo:', err.message);
  }

  if (!sectionIds.length) {
    const rawResults = await buscar(keywordText, dataInicio, dataFim);
    const filteredResults = rawResults.filter(occurrence => {
      return matchesKeyword(occurrence, keywordText)
        && isWithinDateRange(occurrence, dataInicio, dataFim);
    });

    return {
      results: mergeOccurrences(filteredResults),
      totalRaw: rawResults.length,
      sectionIds
    };
  }

  const sectionSearches = sectionIds
    .map(id => getSectionById(id))
    .filter(Boolean);

  const resultSets = await Promise.all(sectionSearches.map(async section => {
    const results = await buscar(section.searchTerm, dataInicio, dataFim);
    return results
      .filter(occurrence => matchesSection(occurrence, section))
      .map(occurrence => ({
        ...occurrence,
        matchedSectionIds: [section.id]
      }));
  }));

  const directEditionResults = [];

  for (const dateKey of directEditionDates) {
    try {
      const occurrences = await buscarEdicaoExecutiva(dateKey);
      directEditionResults.push(
        ...occurrences.filter(occurrence => {
          return (occurrence.matchedSectionIds || []).some(id => requestedSectionIds.has(id));
        })
      );
    } catch (err) {
      console.error(`[daily-edition] Falha ao ler a edicao ${dateKey}:`, err.message);
    }
  }

  const mergedResults = mergeOccurrences([
    ...resultSets.flat(),
    ...directEditionResults
  ]);
  const filteredResults = mergedResults.filter(occurrence => {
    return matchesKeyword(occurrence, keywordText)
      && isWithinDateRange(occurrence, dataInicio, dataFim);
  });

  return {
    results: filteredResults,
    totalRaw: mergedResults.length,
    sectionIds
  };
}

module.exports = {
  normalizeText,
  matchesKeyword,
  isWithinDateRange,
  mergeOccurrences,
  searchOccurrences
};
