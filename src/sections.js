const ALL_DOERJ_OPTION = {
  id: 'all',
  label: 'Todo o DOERJ',
  shortLabel: 'Todo o DOERJ'
};

const SECTION_OPTIONS = [
  {
    id: 'casa-civil',
    label: 'Secretaria de Estado da Casa Civil',
    shortLabel: 'Casa Civil',
    searchTerm: 'Secretaria de Estado da Casa Civil'
  },
  {
    id: 'governo',
    label: 'Secretaria de Estado de Governo',
    shortLabel: 'Governo',
    searchTerm: 'Secretaria de Estado de Governo'
  },
  {
    id: 'planejamento-gestao',
    label: 'Secretaria de Estado de Planejamento e Gestao',
    shortLabel: 'Planejamento e Gestao',
    searchTerm: 'Secretaria de Estado de Planejamento e Gestao'
  },
  {
    id: 'fazenda',
    label: 'Secretaria de Estado de Fazenda',
    shortLabel: 'Fazenda',
    searchTerm: 'Secretaria de Estado de Fazenda'
  },
  {
    id: 'desenvolvimento-economico',
    label: 'Secretaria de Estado de Desenvolvimento Economico, Industria, Comercio e Servicos',
    shortLabel: 'Desenvolvimento Economico',
    searchTerm: 'Secretaria de Estado de Desenvolvimento Economico, Industria, Comercio e Servicos'
  },
  {
    id: 'policia-militar',
    label: 'Secretaria de Estado de Policia Militar',
    shortLabel: 'Policia Militar',
    searchTerm: 'Secretaria de Estado de Policia Militar'
  },
  {
    id: 'policia-civil',
    label: 'Secretaria de Estado de Policia Civil',
    shortLabel: 'Policia Civil',
    searchTerm: 'Secretaria de Estado de Policia Civil'
  },
  {
    id: 'administracao-penitenciaria',
    label: 'Secretaria de Estado de Administracao Penitenciaria',
    shortLabel: 'Administracao Penitenciaria',
    searchTerm: 'Secretaria de Estado de Administracao Penitenciaria'
  },
  {
    id: 'defesa-civil',
    label: 'Secretaria de Estado de Defesa Civil',
    shortLabel: 'Defesa Civil',
    searchTerm: 'Secretaria de Estado de Defesa Civil'
  },
  {
    id: 'saude',
    label: 'Secretaria de Estado de Saude',
    shortLabel: 'Saude',
    searchTerm: 'Secretaria de Estado de Saude'
  },
  {
    id: 'educacao',
    label: 'Secretaria de Estado de Educacao',
    shortLabel: 'Educacao',
    searchTerm: 'Secretaria de Estado de Educacao'
  },
  {
    id: 'ciencia-tecnologia-inovacao',
    label: 'Secretaria de Estado de Ciencia, Tecnologia e Inovacao',
    shortLabel: 'Ciencia e Inovacao',
    searchTerm: 'Secretaria de Estado de Ciencia, Tecnologia e Inovacao'
  },
  {
    id: 'transporte-mobilidade',
    label: 'Secretaria de Estado de Transporte e Mobilidade Urbana',
    shortLabel: 'Transporte e Mobilidade',
    searchTerm: 'Secretaria de Estado de Transporte e Mobilidade Urbana'
  },
  {
    id: 'ambiente-sustentabilidade',
    label: 'Secretaria de Estado do Ambiente e Sustentabilidade',
    shortLabel: 'Ambiente e Sustentabilidade',
    searchTerm: 'Secretaria de Estado do Ambiente e Sustentabilidade'
  },
  {
    id: 'agricultura-abastecimento',
    label: 'Secretaria de Estado de Agricultura, Pecuaria e Abastecimento',
    shortLabel: 'Agricultura e Abastecimento',
    searchTerm: 'Secretaria de Estado de Agricultura, Pecuaria e Abastecimento'
  },
  {
    id: 'desenvolvimento-regional',
    label: 'Secretaria de Estado de Desenvolvimento Regional do Interior, Pesca e Agricultura Familiar',
    shortLabel: 'Desenvolvimento Regional',
    searchTerm: 'Secretaria de Estado de Desenvolvimento Regional do Interior, Pesca e Agricultura Familiar'
  },
  {
    id: 'cultura-economia-criativa',
    label: 'Secretaria de Estado de Cultura e Economia Criativa',
    shortLabel: 'Cultura e Economia Criativa',
    searchTerm: 'Secretaria de Estado de Cultura e Economia Criativa'
  },
  {
    id: 'desenvolvimento-social',
    label: 'Secretaria de Estado de Desenvolvimento Social e Direitos Humanos',
    shortLabel: 'Desenvolvimento Social',
    searchTerm: 'Secretaria de Estado de Desenvolvimento Social e Direitos Humanos'
  },
  {
    id: 'esporte-lazer',
    label: 'Secretaria de Estado de Esporte e Lazer',
    shortLabel: 'Esporte e Lazer',
    searchTerm: 'Secretaria de Estado de Esporte e Lazer'
  },
  {
    id: 'turismo',
    label: 'Secretaria de Estado de Turismo',
    shortLabel: 'Turismo',
    searchTerm: 'Secretaria de Estado de Turismo'
  },
  {
    id: 'cge',
    label: 'Controladoria Geral do Estado',
    shortLabel: 'CGE',
    searchTerm: 'Controladoria Geral do Estado'
  },
  {
    id: 'trabalho-renda',
    label: 'Secretaria de Estado de Trabalho e Renda',
    shortLabel: 'Trabalho e Renda',
    searchTerm: 'Secretaria de Estado de Trabalho e Renda'
  },
  {
    id: 'gsi',
    label: 'Gabinete de Seguranca Institucional do Governo do Estado do Rio de Janeiro',
    shortLabel: 'Gabinete de Seguranca Institucional',
    searchTerm: 'Gabinete de Seguranca Institucional do Governo do Estado do Rio de Janeiro'
  },
  {
    id: 'transformacao-digital',
    label: 'Secretaria de Estado de Transformacao Digital',
    shortLabel: 'Transformacao Digital',
    searchTerm: 'Secretaria de Estado de Transformacao Digital'
  },
  {
    id: 'infraestrutura-obras',
    label: 'Secretaria de Estado de Infraestrutura e Obras Publicas',
    shortLabel: 'Infraestrutura e Obras',
    searchTerm: 'Secretaria de Estado de Infraestrutura e Obras Publicas'
  },
  {
    id: 'intergeracional',
    label: 'Secretaria de Estado Intergeracional de Juventude e Envelhecimento Saudavel',
    shortLabel: 'Intergeracional',
    searchTerm: 'Secretaria de Estado Intergeracional de Juventude e Envelhecimento Saudavel'
  },
  {
    id: 'cidades',
    label: 'Secretaria de Estado das Cidades',
    shortLabel: 'Cidades',
    searchTerm: 'Secretaria de Estado das Cidades'
  },
  {
    id: 'defesa-consumidor',
    label: 'Secretaria de Estado de Defesa do Consumidor',
    shortLabel: 'Defesa do Consumidor',
    searchTerm: 'Secretaria de Estado de Defesa do Consumidor'
  },
  {
    id: 'seguranca-publica',
    label: 'Secretaria de Estado de Seguranca Publica',
    shortLabel: 'Seguranca Publica',
    searchTerm: 'Secretaria de Estado de Seguranca Publica'
  },
  {
    id: 'pge',
    label: 'Procuradoria Geral do Estado',
    shortLabel: 'PGE',
    searchTerm: 'Procuradoria Geral do Estado'
  },
  {
    id: 'avisos-editais-contratos',
    label: 'Avisos, Editais e Termos de Contrato',
    shortLabel: 'Avisos, Editais e Contratos',
    searchTerm: 'Avisos, Editais e Termos de Contrato'
  },
  {
    id: 'representacao-brasilia',
    label: 'Secretaria Extraordinaria de Representacao do Governo em Brasilia',
    shortLabel: 'Representacao em Brasilia',
    searchTerm: 'Secretaria Extraordinaria de Representacao do Governo em Brasilia'
  },
  {
    id: 'habitacao-interesse-social',
    label: 'Secretaria de Estado de Habitacao de Interesse Social',
    shortLabel: 'Habitacao de Interesse Social',
    searchTerm: 'Secretaria de Estado de Habitacao de Interesse Social'
  }
];

const SECTION_INDEX = new Map(SECTION_OPTIONS.map(section => [section.id, section]));

function normalizeSectionIds(input) {
  const values = Array.isArray(input)
    ? input
    : input
      ? [input]
      : [];

  const uniqueIds = [];
  for (const rawValue of values) {
    const value = String(rawValue || '').trim();
    if (!value || value === ALL_DOERJ_OPTION.id) {
      continue;
    }

    if (SECTION_INDEX.has(value) && !uniqueIds.includes(value)) {
      uniqueIds.push(value);
    }
  }

  return uniqueIds;
}

function getSectionById(id) {
  return SECTION_INDEX.get(id) || null;
}

function getSectionLabels(sectionIds, { compact = false } = {}) {
  const ids = normalizeSectionIds(sectionIds);
  if (!ids.length) {
    return [ALL_DOERJ_OPTION.label];
  }

  return ids
    .map(id => getSectionById(id))
    .filter(Boolean)
    .map(section => compact ? section.shortLabel : section.label);
}

function describeSectionScope(sectionIds, { compact = false } = {}) {
  const labels = getSectionLabels(sectionIds, { compact });
  if (labels.length === 1) {
    return labels[0];
  }

  if (compact && labels.length > 2) {
    return `${labels[0]} +${labels.length - 1}`;
  }

  return labels.join(', ');
}

function describeMonitorRule(rule, { compact = false } = {}) {
  const text = String(rule && rule.text ? rule.text : '').trim();
  const sectionIds = normalizeSectionIds(rule && rule.sections);
  const scope = describeSectionScope(sectionIds, { compact });

  if (text && !sectionIds.length) {
    return text;
  }

  if (!text && sectionIds.length) {
    return compact ? `${scope} | tudo` : `Todas as publicacoes em ${scope}`;
  }

  if (text && sectionIds.length) {
    return compact ? `${scope} | ${text}` : `${text} em ${scope}`;
  }

  return 'Monitoramento';
}

module.exports = {
  ALL_DOERJ_OPTION,
  SECTION_OPTIONS,
  normalizeSectionIds,
  getSectionById,
  getSectionLabels,
  describeSectionScope,
  describeMonitorRule
};
