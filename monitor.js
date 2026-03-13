const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL_BUSCA =
  "https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca";

const PALAVRA_CHAVE = "gestores do contrato";
const ARQUIVO_DADOS = path.join(__dirname, "dados", "ocorrencias.json");
const PASTA_DEBUG = path.join(__dirname, "debug");

function garantirEstrutura() {
  fs.mkdirSync(path.join(__dirname, "dados"), { recursive: true });
  fs.mkdirSync(PASTA_DEBUG, { recursive: true });

  if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(
      ARQUIVO_DADOS,
      JSON.stringify(
        {
          palavraChave: PALAVRA_CHAVE,
          ultimaAtualizacao: null,
          ocorrencias: [],
        },
        null,
        2
      ),
      "utf-8"
    );
  }
}

function carregarDados() {
  garantirEstrutura();
  return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, "utf-8"));
}

function salvarDados(dados) {
  fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), "utf-8");
}

function extrairCamposDeLinhas(cabecalho, linhaMeta, resumo) {
  const dataMatch = cabecalho.match(/(\d{2}\/\d{2}\/\d{4})/);
  const paginaMatch = cabecalho.match(/p[aá]gina\s+(\d+)/i);
  const idMatch = cabecalho.match(/Mat[ée]ria Id:\s*(\d+)/i);

  const jornalMatch = linhaMeta.match(/Jornal:\s*(.*?)\s+Tipo:/i);
  const tipoMatch = linhaMeta.match(/Tipo:\s*(.*)$/i);

  return {
    dataPublicacao: dataMatch ? dataMatch[1] : "",
    pagina: paginaMatch ? paginaMatch[1] : "",
    idMateria: idMatch ? idMatch[1] : "",
    jornal: jornalMatch ? jornalMatch[1].trim() : "",
    tipo: tipoMatch ? tipoMatch[1].trim() : "",
    resumo: (resumo || "").trim(),
  };
}
async function coletarOcorrencias() {
  const browser = await chromium.launch({
    headless: true,
    // para depurar visualmente, troque para false
    // headless: false,
    // slowMo: 400,
  });

  const page = await browser.newPage();

  try {
    await page.goto(URL_BUSCA, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const campoBusca = page.locator('input[name="textobusca"]');
    await campoBusca.waitFor();
    await campoBusca.click();
    await campoBusca.fill(PALAVRA_CHAVE);

    const valorPreenchido = await campoBusca.inputValue();
    console.log("Campo preenchido com:", valorPreenchido);

    if (!valorPreenchido.trim()) {
      throw new Error("O campo de busca não foi preenchido.");
    }

    await page.locator('input[type="submit"][name="buscar"]').click();

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const htmlFinal = await page.content();
    const textoFinal = await page.locator("body").innerText();

    fs.writeFileSync(path.join(PASTA_DEBUG, "resultado.html"), htmlFinal, "utf-8");
    fs.writeFileSync(path.join(PASTA_DEBUG, "resultado.txt"), textoFinal, "utf-8");
    await page.screenshot({
      path: path.join(PASTA_DEBUG, "resultado.png"),
      fullPage: true,
    });

    console.log("===== AMOSTRA DO TEXTO =====");
    console.log(textoFinal.slice(0, 3000));
    console.log("===== FIM DA AMOSTRA =====");

    const linhas = textoFinal
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);

    const ocorrencias = [];

    for (let i = 0; i < linhas.length; i++) {
    const cabecalho = linhas[i];

    if (!/\d{2}\/\d{2}\/\d{4}\s+p[aá]gina\s+\d+\s+-\s+Mat[ée]ria Id:\s*\d+/i.test(cabecalho)) {
        continue;
    }

    const linhaMeta = linhas[i + 1] || "";
    const resumo = linhas[i + 2] || "";

    const item = extrairCamposDeLinhas(cabecalho, linhaMeta, resumo);

    if (!item.idMateria) {
        continue;
    }

    ocorrencias.push({
        ...item,
        detectadoEm: new Date().toISOString(),
    });
    }

    return ocorrencias;
  } finally {
    await browser.close();
  }
}

async function executarMonitoramento() {
  const dadosAtuais = carregarDados();
  const idsJaConhecidos = new Set(
    dadosAtuais.ocorrencias.map((item) => String(item.idMateria))
  );

  const ocorrenciasEncontradas = await coletarOcorrencias();
  const novasOcorrencias = [];

  for (const ocorrencia of ocorrenciasEncontradas) {
    if (!idsJaConhecidos.has(String(ocorrencia.idMateria))) {
      novasOcorrencias.push(ocorrencia);

      console.log("========================================");
      console.log("NOVA OCORRÊNCIA ENCONTRADA");
      console.log("Data:", ocorrencia.dataPublicacao || "-");
      console.log("ID da matéria:", ocorrencia.idMateria || "-");
      console.log("Página:", ocorrencia.pagina || "-");
      console.log("Jornal:", ocorrencia.jornal || "-");
      console.log("Tipo:", ocorrencia.tipo || "-");
      console.log("========================================");
    }
  }

  const mapaFinal = new Map();

  for (const item of [...ocorrenciasEncontradas, ...dadosAtuais.ocorrencias]) {
    mapaFinal.set(String(item.idMateria), item);
  }

  const ocorrenciasOrdenadas = Array.from(mapaFinal.values()).sort((a, b) => {
    const normalizar = (data) => (data ? data.split("/").reverse().join("") : "");
    return normalizar(b.dataPublicacao).localeCompare(normalizar(a.dataPublicacao));
  });

  salvarDados({
    palavraChave: PALAVRA_CHAVE,
    ultimaAtualizacao: new Date().toISOString(),
    totalEncontradoNaUltimaBusca: ocorrenciasEncontradas.length,
    novasNaUltimaBusca: novasOcorrencias.length,
    ocorrencias: ocorrenciasOrdenadas,
  });

  console.log(
    `Busca finalizada. ${ocorrenciasEncontradas.length} encontradas. ${novasOcorrencias.length} novas.`
  );
}

executarMonitoramento().catch((erro) => {
  console.error("Erro no monitoramento:", erro);
  process.exit(1);
});