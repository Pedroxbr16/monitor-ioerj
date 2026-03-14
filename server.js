<<<<<<< HEAD
const express = require("express");

const {
  garantirEstrutura,
  lerAssinaturas,
  lerOcorrencias,
  adicionarAssinatura,
} = require("./src/storage");
const { emailEstaConfigurado } = require("./src/mailer");
const {
  executarCicloMonitoramento,
  iniciarAgendadorMonitoramento,
} = require("./monitor");

const app = express();
const PORTA = Number(process.env.PORT || 3000);
const INTERVALO_MONITORAMENTO_MINUTOS = Number(
  process.env.MONITOR_INTERVAL_MINUTES || 30
);

garantirEstrutura();

app.set("view engine", "ejs");
app.set("views", `${__dirname}/views`);
app.use(express.static(`${__dirname}/public`));
app.use(express.urlencoded({ extended: true }));

function montarResumoOcorrencias(dadosOcorrencias) {
  return [...dadosOcorrencias.palavrasChave]
    .sort((a, b) =>
      String(b.ultimaBuscaEm || "").localeCompare(String(a.ultimaBuscaEm || ""), "pt-BR")
    )
    .map((registro) => ({
      palavraChave: registro.palavraChave,
      total: registro.ocorrencias.length,
      ultimaBuscaEm: registro.ultimaBuscaEm,
      ocorrencias: [...registro.ocorrencias]
        .sort((a, b) =>
          String(b.primeiraDeteccaoEm || "").localeCompare(
            String(a.primeiraDeteccaoEm || ""),
            "pt-BR"
          )
        )
        .slice(0, 20),
    }));
}

app.get("/", (req, res) => {
  const dadosAssinaturas = lerAssinaturas();
  const dadosOcorrencias = lerOcorrencias();
  const status = req.query.status || "";

  res.render("index", {
    titulo: "IOERJ Self Service",
    status,
    emailConfigurado: emailEstaConfigurado(),
    intervaloMonitoramentoMinutos: INTERVALO_MONITORAMENTO_MINUTOS,
    totalAssinaturas: dadosAssinaturas.assinaturas.length,
    assinaturas: [...dadosAssinaturas.assinaturas].sort((a, b) =>
      String(b.criadaEm || "").localeCompare(String(a.criadaEm || ""), "pt-BR")
    ),
    totalPalavrasMonitoradas: dadosOcorrencias.palavrasChave.length,
    ultimaAtualizacao: dadosOcorrencias.ultimaAtualizacao,
    palavrasMonitoradas: montarResumoOcorrencias(dadosOcorrencias),
  });
});

app.post("/assinaturas", (req, res) => {
  const { palavraChave, email } = req.body;

  try {
    const resultado = adicionarAssinatura({ palavraChave, email });
    const status = resultado.status === "created" ? "assinatura-criada" : "assinatura-existente";
    res.redirect(`/?status=${status}`);
  } catch (erro) {
    res.redirect(`/?status=erro-${encodeURIComponent(erro.message)}`);
  }
});

app.post("/monitorar-agora", async (req, res) => {
  try {
    await executarCicloMonitoramento();
    res.redirect("/?status=monitoramento-executado");
  } catch (erro) {
    res.redirect(`/?status=erro-${encodeURIComponent(erro.message)}`);
  }
});

app.get("/api/assinaturas", (req, res) => {
  res.json(lerAssinaturas());
});

app.get("/api/ocorrencias", (req, res) => {
  res.json(lerOcorrencias());
});

app.listen(PORTA, () => {
  console.log(`Aplicacao disponivel em http://localhost:${PORTA}`);
  console.log(
    `Monitoramento automatico configurado para rodar a cada ${INTERVALO_MONITORAMENTO_MINUTOS} minuto(s).`
  );
});

iniciarAgendadorMonitoramento(INTERVALO_MONITORAMENTO_MINUTOS);
=======
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');

const requireAuth = require('./middleware/requireAuth');
const Keyword = require('./models/Keyword');
const Alert = require('./models/Alert');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/monitor-doerj';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('[db] MongoDB conectado'))
  .catch(err => console.error('[db] Erro ao conectar:', err.message));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-troque',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/auth', require('./routes/auth'));
app.use('/keywords', require('./routes/keywords'));
app.use('/search', require('./routes/search'));
app.use('/alerts', require('./routes/alerts'));
app.use('/profile', require('./routes/profile'));

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/auth/login');
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
  executarMonitoramento().catch(err => console.error('[manual]', err.message));
  res.json({ ok: true, msg: 'Monitoramento iniciado em background.' });
});

require('./jobs/cron');

app.listen(PORT, () => console.log(`[server] Rodando em http://localhost:${PORT}`));
>>>>>>> dbc7637 (layout+funcionalidades de envio e busca d.o teoricamente ta funcionando nao testei)
