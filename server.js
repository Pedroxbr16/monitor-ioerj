const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORTA = 3000;
const ARQUIVO_DADOS = path.join(__dirname, "dados", "ocorrencias.json");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

function lerDados() {
  if (!fs.existsSync(ARQUIVO_DADOS)) {
    return {
      palavraChave: "processo instaurado",
      ultimaAtualizacao: null,
      ocorrencias: [],
    };
  }

  return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, "utf-8"));
}

app.get("/", (req, res) => {
  const dados = lerDados();

  res.render("index", {
    titulo: "Monitor IOERJ",
    palavraChave: dados.palavraChave,
    ultimaAtualizacao: dados.ultimaAtualizacao,
    total: dados.ocorrencias.length,
    ocorrencias: dados.ocorrencias,
  });
});

app.get("/api/ocorrencias", (req, res) => {
  const dados = lerDados();
  res.json(dados);
});

app.listen(PORTA, () => {
  console.log(`Tela disponível em http://localhost:${PORTA}`);
});