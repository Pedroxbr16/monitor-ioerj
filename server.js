require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');

const requireAuth = require('./middleware/requireAuth');
const Keyword = require('./models/Keyword');
const Alert = require('./models/Alert');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/monitor-doerj';
const DB_CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES || 15);
const DB_CONNECT_RETRY_DELAY_MS = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2000);
const RUN_MONITOR_ON_STARTUP = process.env.RUN_MONITOR_ON_STARTUP !== 'false';
const RUN_ARCHIVE_SYNC_ON_STARTUP = process.env.RUN_ARCHIVE_SYNC_ON_STARTUP !== 'false';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToDatabase() {
  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('[db] MongoDB conectado');
      return;
    } catch (err) {
      console.error(`[db] Tentativa ${attempt}/${DB_CONNECT_RETRIES} falhou: ${err.message}`);
      await mongoose.disconnect().catch(() => {});

      if (attempt === DB_CONNECT_RETRIES) {
        throw err;
      }

      await sleep(DB_CONNECT_RETRY_DELAY_MS);
    }
  }
}

async function startServer() {
  await connectToDatabase();

  const app = express();
  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient()
  });

  sessionStore.on('error', err => {
    console.error('[session] Erro no store:', err.message);
  });

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true, limit: '3mb' }));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-troque',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  }));

  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

  app.use('/auth', require('./routes/auth'));
  app.use('/keywords', require('./routes/keywords'));
  app.use('/search', require('./routes/search'));
  app.use('/doerj', require('./routes/doerj'));
  app.use('/alerts', require('./routes/alerts'));
  app.use('/profile', require('./routes/profile'));

  app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    return res.redirect('/auth/login');
  });

  app.get('/dashboard', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const [totalKeywords, activeKeywords, totalAlerts, recentAlerts] = await Promise.all([
      Keyword.countDocuments({ userId }),
      Keyword.countDocuments({ userId, active: true }),
      Alert.countDocuments({ userId }),
      Alert.find({ userId }).sort({ sentAt: -1 }).limit(10)
    ]);

    res.render('dashboard', { totalKeywords, activeKeywords, totalAlerts, recentAlerts });
  });

  app.post('/monitor/executar', requireAuth, async (req, res) => {
    const { executarMonitoramento } = require('./services/monitorService');
    executarMonitoramento('manual').catch(err => console.error('[manual]', err.message));
    res.json({ ok: true, msg: 'Monitoramento iniciado em background.' });
  });

  app.post('/doerj/sync', requireAuth, async (req, res) => {
    const { syncArchiveToday, syncArchiveByDate } = require('./services/doerjArchiveService');
    const requestedDate = String(req.body.date || '').trim();

    if (requestedDate) {
      syncArchiveByDate(requestedDate, {
        source: 'manual-route',
        skipExisting: false
      }).catch(err => console.error('[manual][acervo]', err.message));

      return res.json({
        ok: true,
        msg: `Sincronizacao do acervo iniciada para ${requestedDate}.`
      });
    }

    syncArchiveToday({
      source: 'manual-route',
      skipExisting: false
    }).catch(err => console.error('[manual][acervo]', err.message));

    return res.json({ ok: true, msg: 'Sincronizacao do acervo iniciada para hoje.' });
  });

  require('./jobs/cron');

  app.listen(PORT, () => {
    console.log(`[server] Rodando em http://localhost:${PORT}`);

    if (RUN_MONITOR_ON_STARTUP) {
      const { executarMonitoramento } = require('./services/monitorService');

      setTimeout(() => {
        executarMonitoramento('startup').catch(err => {
          console.error('[startup] Erro no monitoramento inicial:', err.message);
        });
      }, 1500);
    }

    if (RUN_ARCHIVE_SYNC_ON_STARTUP) {
      const { syncArchiveToday } = require('./services/doerjArchiveService');

      setTimeout(() => {
        syncArchiveToday({
          source: 'startup',
          skipExisting: true
        }).catch(err => {
          console.error('[startup] Erro na sincronizacao do acervo:', err.message);
        });
      }, 2500);
    }
  });
}

startServer().catch(err => {
  console.error('[server] Falha ao iniciar:', err.message);
  process.exit(1);
});
