const { getSectionById, normalizeSectionIds } = require('./sections');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHighlightConfig(rule) {
  const terms = [];
  const rawKeyword = String(rule && rule.text ? rule.text : '').trim();
  const sectionIds = normalizeSectionIds(rule && rule.sections);

  let ignoredShortKeyword = '';

  if (rawKeyword) {
    if (rawKeyword.length >= 2) {
      terms.push(rawKeyword);
    } else {
      ignoredShortKeyword = rawKeyword;
    }
  }

  for (const sectionId of sectionIds) {
    const section = getSectionById(sectionId);
    if (!section) {
      continue;
    }

    terms.push(section.label);

    if (section.shortLabel && section.shortLabel.length >= 3) {
      terms.push(section.shortLabel);
    }
  }

  const uniqueTerms = [...new Set(
    terms
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )].sort((first, second) => second.length - first.length);

  return {
    terms: uniqueTerms,
    ignoredShortKeyword
  };
}

function highlightText(text, terms) {
  const source = String(text || '');
  const safeTerms = [...new Set(
    (terms || [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )].sort((first, second) => second.length - first.length);

  if (!source) {
    return '';
  }

  if (!safeTerms.length) {
    return escapeHtml(source);
  }

  const pattern = new RegExp(`(${safeTerms.map(escapeRegex).join('|')})`, 'gi');
  let lastIndex = 0;
  let highlighted = '';

  for (const match of source.matchAll(pattern)) {
    const index = typeof match.index === 'number' ? match.index : -1;
    if (index < 0) {
      continue;
    }

    highlighted += escapeHtml(source.slice(lastIndex, index));
    highlighted += `<mark class="term-highlight">${escapeHtml(match[0])}</mark>`;
    lastIndex = index + match[0].length;
  }

  highlighted += escapeHtml(source.slice(lastIndex));
  return highlighted;
}

module.exports = {
  buildHighlightConfig,
  highlightText,
  normalizeText
};
