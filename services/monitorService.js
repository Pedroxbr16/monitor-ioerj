const Keyword = require('../models/Keyword');
const Alert = require('../models/Alert');
const User = require('../models/User');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');
const { searchOccurrences } = require('./occurrenceQuery');
const { describeMonitorRule } = require('../src/sections');

let monitorRunPromise = null;

function formatDateKeyFromParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toBrazilDateKey(date) {
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

function parsePublicationDateKey(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return formatDateKeyFromParts(year, month, day);
}

function getArmedFromDateKey(keyword) {
  return toBrazilDateKey(keyword.armedFromAt || keyword.createdAt || new Date());
}

function isOccurrenceEligibleOnFirstScan(keyword, occurrence) {
  const occurrenceDateKey = parsePublicationDateKey(occurrence.dataPublicacao);
  const armedFromDateKey = getArmedFromDateKey(keyword);

  if (!occurrenceDateKey || !armedFromDateKey) {
    return false;
  }

  return occurrenceDateKey >= armedFromDateKey;
}

async function registrarAlertas(keyword, user, monitorLabel, ocorrencia) {
  let hasAlert = false;

  if (keyword.emailEnabled && user.email) {
    hasAlert = true;

    try {
      await emailService.enviarAlerta({
        destinatario: user.email,
        keywordText: monitorLabel,
        ocorrencia
      });
      await Alert.create({
        userId: user._id,
        keywordId: keyword._id,
        keywordText: monitorLabel,
        channel: 'email',
        occurrence: ocorrencia,
        status: 'sent'
      });
    } catch (err) {
      console.error('[monitor] Erro ao enviar email:', err.message);
      await Alert.create({
        userId: user._id,
        keywordId: keyword._id,
        keywordText: monitorLabel,
        channel: 'email',
        occurrence: ocorrencia,
        status: 'failed'
      });
    }
  }

  if (keyword.whatsappEnabled && user.phone && user.callmebotApikey) {
    hasAlert = true;

    try {
      await whatsappService.enviarAlerta({
        phone: user.phone,
        apikey: user.callmebotApikey,
        keywordText: monitorLabel,
        ocorrencia
      });
      await Alert.create({
        userId: user._id,
        keywordId: keyword._id,
        keywordText: monitorLabel,
        channel: 'whatsapp',
        occurrence: ocorrencia,
        status: 'sent'
      });
    } catch (err) {
      console.error('[monitor] Erro ao enviar WhatsApp:', err.message);
      await Alert.create({
        userId: user._id,
        keywordId: keyword._id,
        keywordText: monitorLabel,
        channel: 'whatsapp',
        occurrence: ocorrencia,
        status: 'failed'
      });
    }
  }

  if (hasAlert) {
    console.log(`[monitor] Nova ocorrencia: "${monitorLabel}" | ID ${ocorrencia.idMateria}`);
  }
}

async function processarKeyword(keyword) {
  const user = await User.findById(keyword.userId);
  if (!user) return;

  const monitorLabel = describeMonitorRule(keyword, { compact: true });

  let ocorrencias;
  try {
    const result = await searchOccurrences({
      text: keyword.text,
      sections: keyword.sections
    });
    ocorrencias = result.results;
  } catch (err) {
    console.error(`[monitor] Erro ao buscar "${monitorLabel}":`, err.message);
    return;
  }

  const seenSet = new Set(keyword.seenIds);

  if (!keyword.firstScanDone) {
    const ids = ocorrencias.map(o => o.idMateria).filter(Boolean);
    const novasNoPrimeiroScan = ocorrencias.filter(o => {
      return o.idMateria
        && !seenSet.has(o.idMateria)
        && isOccurrenceEligibleOnFirstScan(keyword, o);
    });

    for (const ocorrencia of novasNoPrimeiroScan) {
      await registrarAlertas(keyword, user, monitorLabel, ocorrencia);
    }

    ids.forEach(id => seenSet.add(id));

    keyword.seenIds = [...seenSet];
    keyword.firstScanDone = true;
    keyword.lastChecked = new Date();
    await keyword.save();

    console.log(
      `[monitor] Scan inicial de "${monitorLabel}": ${ids.length} IDs marcados como vistos e ${novasNoPrimeiroScan.length} alertas desde ${getArmedFromDateKey(keyword)}.`
    );
    return;
  }

  const novas = ocorrencias.filter(o => o.idMateria && !seenSet.has(o.idMateria));

  for (const ocorrencia of novas) {
    seenSet.add(ocorrencia.idMateria);
    await registrarAlertas(keyword, user, monitorLabel, ocorrencia);
  }

  keyword.seenIds = [...seenSet];
  keyword.lastChecked = new Date();
  await keyword.save();

  console.log(`[monitor] "${monitorLabel}": ${novas.length} novas de ${ocorrencias.length} encontradas.`);
}

async function executarMonitoramento(source = 'manual') {
  if (monitorRunPromise) {
    console.log(`[monitor] Ciclo ja em andamento. Reaproveitando execucao atual (${source}).`);
    return monitorRunPromise;
  }

  monitorRunPromise = (async () => {
    console.log(`[monitor] Iniciando ciclo de monitoramento (${source})...`);
    const keywords = await Keyword.find({ active: true });
    for (const keyword of keywords) {
      await processarKeyword(keyword);
    }
    console.log('[monitor] Ciclo finalizado.');
  })();

  try {
    await monitorRunPromise;
  } finally {
    monitorRunPromise = null;
  }
}

module.exports = { executarMonitoramento };
