require('dotenv').config();

const mongoose = require('mongoose');
const { syncArchiveRange } = require('../services/doerjArchiveService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/monitor-doerj';
const DB_CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES || 8);
const DB_CONNECT_RETRY_DELAY_MS = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2000);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToDatabase() {
  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      return;
    } catch (err) {
      await mongoose.disconnect().catch(() => {});

      if (attempt === DB_CONNECT_RETRIES) {
        throw err;
      }

      await sleep(DB_CONNECT_RETRY_DELAY_MS);
    }
  }
}

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : '';
}

function printUsageAndExit() {
  console.error('Uso: node scripts/backfillDoerjArchive.js --start=YYYY-MM-DD --end=YYYY-MM-DD [--force]');
  process.exit(1);
}

async function run() {
  const startDate = getArg('start');
  const endDate = getArg('end');
  const force = process.argv.includes('--force');
  const skipExisting = !force;

  if (!startDate || !endDate) {
    printUsageAndExit();
  }

  await connectToDatabase();

  const result = await syncArchiveRange({
    startDate,
    endDate,
    skipExisting,
    source: 'cli-backfill'
  });

  console.log(`[archive] Backfill concluido: ${startDate} -> ${endDate}`);
  console.log(
    `[archive] dias=${result.totalDays} partes_processadas=${result.totalProcessedParts} partes_puladas=${result.totalSkippedParts} ocorrencias=${result.totalSavedOccurrences} erros=${result.totalErrors}`
  );

  if (result.stoppedByDiskFull) {
    console.error('[archive] Processo interrompido por falta de espaco em disco.');
    process.exitCode = 2;
  }
}

run()
  .catch(err => {
    console.error('[archive] Falha no backfill:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
