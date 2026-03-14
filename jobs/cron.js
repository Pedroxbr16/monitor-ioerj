const cron = require('node-cron');
const { executarMonitoramento } = require('../services/monitorService');

cron.schedule('0 8 * * 1-5', async () => {
  console.log('[cron] Executando monitoramento agendado (08:00)...');
  await executarMonitoramento().catch(err => console.error('[cron] Erro:', err.message));
});

console.log('[cron] Agendado: segunda a sexta às 08:00');
