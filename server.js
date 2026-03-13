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
