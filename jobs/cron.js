const cron = require('node-cron');
const { executarMonitoramento } = require('../services/monitorService');
const { syncArchiveToday } = require('../services/doerjArchiveService');

const ARCHIVE_ENABLED = process.env.DOERJ_ARCHIVE_ENABLED !== 'false';
const ARCHIVE_CRON = process.env.DOERJ_ARCHIVE_CRON || '0 7 * * 1-5';
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'America/Sao_Paulo';

cron.schedule('0 8 * * 1-5', async () => {
  console.log('[cron] Executando monitoramento agendado (08:00)...');
  await executarMonitoramento('cron').catch(err => console.error('[cron] Erro:', err.message));
}, { timezone: CRON_TIMEZONE });

console.log(`[cron] Agendado: segunda a sexta as 08:00 (monitoramento) [tz=${CRON_TIMEZONE}]`);

if (ARCHIVE_ENABLED) {
  cron.schedule(ARCHIVE_CRON, async () => {
    console.log('[cron] Executando sincronizacao do acervo DOERJ...');
    await syncArchiveToday({
      source: 'cron',
      skipExisting: true
    }).catch(err => console.error('[cron][acervo] Erro:', err.message));
  }, { timezone: CRON_TIMEZONE });

  console.log(`[cron] Agendado acervo DOERJ: "${ARCHIVE_CRON}" [tz=${CRON_TIMEZONE}]`);
} else {
  console.log('[cron] Acervo DOERJ desativado via DOERJ_ARCHIVE_ENABLED=false');
}
