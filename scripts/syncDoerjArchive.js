require('dotenv').config();

const mongoose = require('mongoose');
const { syncArchiveByDate, syncArchiveToday } = require('../services/doerjArchiveService');

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

async function run() {
  const date = getArg('date');
  const force = process.argv.includes('--force');
  const skipExisting = !force;

  await connectToDatabase();

  const result = date
    ? await syncArchiveByDate(date, { source: 'cli-sync', skipExisting })
    : await syncArchiveToday({ source: 'cli-sync', skipExisting });

  const label = date || 'hoje';
  console.log(`[archive] Sincronizacao concluida (${label})`);
  console.log(`[archive] status=${result.status} partsFound=${result.partsFound} partsProcessed=${result.partsProcessed} partsSkipped=${result.partsSkipped} ocorrencias=${result.savedOccurrences}`);
}

run()
  .catch(err => {
    console.error('[archive] Falha:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
