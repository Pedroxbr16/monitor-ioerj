const Keyword = require('../models/Keyword');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { buscar } = require('./scraper');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');

async function processarKeyword(keyword) {
  const user = await User.findById(keyword.userId);
  if (!user) return;

  let ocorrencias;
  try {
    ocorrencias = await buscar(keyword.text);
  } catch (err) {
    console.error(`[monitor] Erro ao buscar "${keyword.text}":`, err.message);
    return;
  }

  if (!keyword.firstScanDone) {
    const ids = ocorrencias.map(o => o.idMateria).filter(Boolean);
    keyword.seenIds = [...new Set([...keyword.seenIds, ...ids])];
    keyword.firstScanDone = true;
    keyword.lastChecked = new Date();
    await keyword.save();
    console.log(`[monitor] Scan inicial de "${keyword.text}": ${ids.length} IDs marcados como vistos.`);
    return;
  }

  const seenSet = new Set(keyword.seenIds);
  const novas = ocorrencias.filter(o => o.idMateria && !seenSet.has(o.idMateria));

  for (const ocorrencia of novas) {
    seenSet.add(ocorrencia.idMateria);

    if (keyword.emailEnabled && user.email) {
      try {
        await emailService.enviarAlerta({
          destinatario: user.email,
          keywordText: keyword.text,
          ocorrencia
        });
        await Alert.create({ userId: user._id, keywordId: keyword._id, keywordText: keyword.text, channel: 'email', occurrence: ocorrencia, status: 'sent' });
      } catch (err) {
        console.error(`[monitor] Erro ao enviar email:`, err.message);
        await Alert.create({ userId: user._id, keywordId: keyword._id, keywordText: keyword.text, channel: 'email', occurrence: ocorrencia, status: 'failed' });
      }
    }

    if (keyword.whatsappEnabled && user.phone && user.callmebotApikey) {
      try {
        await whatsappService.enviarAlerta({
          phone: user.phone,
          apikey: user.callmebotApikey,
          keywordText: keyword.text,
          ocorrencia
        });
        await Alert.create({ userId: user._id, keywordId: keyword._id, keywordText: keyword.text, channel: 'whatsapp', occurrence: ocorrencia, status: 'sent' });
      } catch (err) {
        console.error(`[monitor] Erro ao enviar WhatsApp:`, err.message);
        await Alert.create({ userId: user._id, keywordId: keyword._id, keywordText: keyword.text, channel: 'whatsapp', occurrence: ocorrencia, status: 'failed' });
      }
    }

    console.log(`[monitor] Nova ocorrência: "${keyword.text}" | ID ${ocorrencia.idMateria}`);
  }

  keyword.seenIds = [...seenSet];
  keyword.lastChecked = new Date();
  await keyword.save();

  console.log(`[monitor] "${keyword.text}": ${novas.length} novas de ${ocorrencias.length} encontradas.`);
}

async function executarMonitoramento() {
  console.log('[monitor] Iniciando ciclo de monitoramento...');
  const keywords = await Keyword.find({ active: true });
  for (const kw of keywords) {
    await processarKeyword(kw);
  }
  console.log('[monitor] Ciclo finalizado.');
}

module.exports = { executarMonitoramento };
