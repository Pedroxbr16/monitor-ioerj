const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const {
  garantirEstrutura,
  lerAssinaturas,
  salvarAssinaturas,
  lerOcorrencias,
  salvarOcorrencias,
  normalizarPalavraChave,
  obterRegistroDaPalavra,
  mesclarOcorrenciasPorId,
} = require("./src/storage");
const { enviarAlertaNovasOcorrencias, emailEstaConfigurado } = require("./src/mailer");

const URL_BUSCA =
  "https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca";
const DIRETORIO_DEBUG = path.join(__dirname, "debug");
const REGEX_CABECALHO =
  /\d{2}\/\d{2}\/\d{4}\s+p[aá]gina\s+\d+\s+-\s+Mat[ée]ria Id:\s*\d+/i;

let monitoramentoEmExecucao = false;

function normalizarLinha(linha) {
  return linha.replace(/\s+/g, " ").trim();
}

function nomeSeguroParaArquivo(valor) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

function parsearOcorrenciasPorLinhas(textoFinal) {
  const linhas = textoFinal
    .split("\n")
    .map(normalizarLinha)
    .filter(Boolean);

  const ocorrencias = [];
  let indice = 0;

  while (indice < linhas.length) {
    const cabecalho = linhas[indice];

    if (!REGEX_CABECALHO.test(cabecalho)) {
      indice += 1;
      continue;
    }

    const linhaMeta = linhas[indice + 1] || "";
    const resumo = linhas[indice + 2] || "";
    const campos = extrairCamposDeLinhas(cabecalho, linhaMeta, resumo);

    if (campos.idMateria) {
      ocorrencias.push(campos);
    }

    indice += 3;
  }

  return ocorrencias;
}

async function salvarArquivosDeDebug({ html, texto, page, palavraChave }) {
  fs.mkdirSync(DIRETORIO_DEBUG, { recursive: true });

  const sufixo = nomeSeguroParaArquivo(palavraChave) || "busca";

  fs.writeFileSync(path.join(DIRETORIO_DEBUG, "resultado.html"), html, "utf-8");
  fs.writeFileSync(path.join(DIRETORIO_DEBUG, "resultado.txt"), texto, "utf-8");
  fs.writeFileSync(
    path.join(DIRETORIO_DEBUG, `resultado-${sufixo}.html`),
    html,
    "utf-8"
  );
  fs.writeFileSync(
    path.join(DIRETORIO_DEBUG, `resultado-${sufixo}.txt`),
    texto,
    "utf-8"
  );

  await page.screenshot({
    path: path.join(DIRETORIO_DEBUG, "resultado.png"),
    fullPage: true,
  });

  await page.screenshot({
    path: path.join(DIRETORIO_DEBUG, `resultado-${sufixo}.png`),
    fullPage: true,
  });
}

async function buscarOcorrenciasPorPalavraChave(browser, palavraChave) {
  const page = await browser.newPage();

  try {
    await page.goto(URL_BUSCA, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const campoBusca = page.locator('input[name="textobusca"]');
    await campoBusca.waitFor({ state: "visible", timeout: 30000 });
    await campoBusca.fill(palavraChave);

    const valorPreenchido = await campoBusca.inputValue();
    if (valorPreenchido.trim() !== palavraChave) {
      throw new Error(`Falha ao preencher a busca por "${palavraChave}".`);
    }

    await page.locator('input[type="submit"][name="buscar"]').click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const htmlFinal = await page.content();
    const textoFinal = await page.locator("body").innerText();

    await salvarArquivosDeDebug({
      html: htmlFinal,
      texto: textoFinal,
      page,
      palavraChave,
    });

    return parsearOcorrenciasPorLinhas(textoFinal);
  } finally {
    await page.close();
  }
}

function adicionarIdsConhecidos(assinatura, ocorrencias) {
  const conjunto = new Set(assinatura.idsConhecidos || []);

  for (const ocorrencia of ocorrencias) {
    if (ocorrencia.idMateria) {
      conjunto.add(String(ocorrencia.idMateria));
    }
  }

  assinatura.idsConhecidos = Array.from(conjunto);
}

function registrarNovidadesNoConsole(assinatura, novasOcorrencias) {
  for (const ocorrencia of novasOcorrencias) {
    console.log("========================================");
    console.log("NOVA OCORRENCIA ENCONTRADA");
    console.log("Email:", assinatura.email);
    console.log("Palavra-chave:", assinatura.palavraChave);
    console.log("Data:", ocorrencia.dataPublicacao || "-");
    console.log("ID da materia:", ocorrencia.idMateria || "-");
    console.log("Pagina:", ocorrencia.pagina || "-");
    console.log("Jornal:", ocorrencia.jornal || "-");
    console.log("Tipo:", ocorrencia.tipo || "-");
    console.log("Resumo:", ocorrencia.resumo || "-");
    console.log("========================================");
  }
}

function agruparAssinaturasAtivasPorPalavra(assinaturas) {
  const mapa = new Map();

  for (const assinatura of assinaturas) {
    if (!assinatura.ativa) {
      continue;
    }

    const chave = normalizarPalavraChave(assinatura.palavraChave);
    if (!mapa.has(chave)) {
      mapa.set(chave, []);
    }

    mapa.get(chave).push(assinatura);
  }

  return mapa;
}

async function executarCicloMonitoramento() {
  if (monitoramentoEmExecucao) {
    return {
      ignorado: true,
      motivo: "monitoramento_em_execucao",
    };
  }

  monitoramentoEmExecucao = true;
  garantirEstrutura();

  try {
    const dadosAssinaturas = lerAssinaturas();
    const dadosOcorrencias = lerOcorrencias();
    const grupos = agruparAssinaturasAtivasPorPalavra(dadosAssinaturas.assinaturas);

    if (grupos.size === 0) {
      return {
        ignorado: false,
        totalAssinaturasAtivas: 0,
        totalPalavrasMonitoradas: 0,
        totalNovasOcorrencias: 0,
        totalEmailsEnviados: 0,
      };
    }

    const browser = await chromium.launch({ headless: true });
    const agora = new Date().toISOString();
    let totalNovasOcorrencias = 0;
    let totalEmailsEnviados = 0;

    try {
      for (const [palavraNormalizada, assinaturas] of grupos.entries()) {
        const palavraOriginal = assinaturas[0].palavraChave;
        const ocorrenciasAtuais = await buscarOcorrenciasPorPalavraChave(
          browser,
          palavraOriginal
        );

        const ocorrenciasComData = ocorrenciasAtuais.map((ocorrencia) => ({
          ...ocorrencia,
          palavraChave: palavraOriginal,
          palavraNormalizada,
          primeiraDeteccaoEm: agora,
        }));

        const registroExistente = obterRegistroDaPalavra(dadosOcorrencias, palavraNormalizada);
        const ocorrenciasMescladas = mesclarOcorrenciasPorId(
          registroExistente?.ocorrencias || [],
          ocorrenciasComData,
          agora
        );

        dadosOcorrencias.palavrasChave = dadosOcorrencias.palavrasChave.filter(
          (item) => item.palavraNormalizada !== palavraNormalizada
        );
        dadosOcorrencias.palavrasChave.push({
          palavraChave: palavraOriginal,
          palavraNormalizada,
          ultimaBuscaEm: agora,
          totalEncontradoNaUltimaBusca: ocorrenciasAtuais.length,
          ocorrencias: ocorrenciasMescladas,
        });

        for (const assinatura of assinaturas) {
          const idsConhecidos = new Set((assinatura.idsConhecidos || []).map(String));
          const novasOcorrencias = ocorrenciasAtuais.filter(
            (ocorrencia) => !idsConhecidos.has(String(ocorrencia.idMateria))
          );

          assinatura.ultimoMonitoramentoEm = agora;

          if (!assinatura.inicializada) {
            adicionarIdsConhecidos(assinatura, ocorrenciasAtuais);
            assinatura.inicializada = true;
            continue;
          }

          if (novasOcorrencias.length === 0) {
            continue;
          }

          totalNovasOcorrencias += novasOcorrencias.length;
          registrarNovidadesNoConsole(assinatura, novasOcorrencias);

          const envio = await enviarAlertaNovasOcorrencias(assinatura, novasOcorrencias);
          if (envio.enviado) {
            totalEmailsEnviados += 1;
            assinatura.ultimoAlertaEm = agora;
            adicionarIdsConhecidos(assinatura, novasOcorrencias);
          } else {
            console.warn(
              `Nao foi possivel enviar email para ${assinatura.email}: ${envio.motivo}`
            );
          }
        }
      }
    } finally {
      await browser.close();
    }

    dadosOcorrencias.ultimaAtualizacao = agora;
    salvarOcorrencias(dadosOcorrencias);
    salvarAssinaturas(dadosAssinaturas);

    console.log(
      `Monitoramento concluido. ${grupos.size} palavra(s) monitorada(s), ${totalNovasOcorrencias} nova(s) ocorrencia(s), ${totalEmailsEnviados} email(s) enviado(s).`
    );

    if (!emailEstaConfigurado()) {
      console.warn(
        "SMTP nao configurado. Os alertas por email foram ignorados ate que as variaveis de ambiente sejam definidas."
      );
    }

    return {
      ignorado: false,
      totalAssinaturasAtivas: Array.from(grupos.values()).reduce(
        (total, grupo) => total + grupo.length,
        0
      ),
      totalPalavrasMonitoradas: grupos.size,
      totalNovasOcorrencias,
      totalEmailsEnviados,
    };
  } finally {
    monitoramentoEmExecucao = false;
  }
}

function iniciarAgendadorMonitoramento(intervaloEmMinutos) {
  const intervaloMs = Math.max(1, Number(intervaloEmMinutos || 30)) * 60 * 1000;

  const executarComLog = async () => {
    try {
      await executarCicloMonitoramento();
    } catch (erro) {
      console.error("Erro no ciclo automatico de monitoramento:", erro);
    }
  };

  setTimeout(executarComLog, 3000);
  return setInterval(executarComLog, intervaloMs);
}

module.exports = {
  extrairCamposDeLinhas,
  parsearOcorrenciasPorLinhas,
  executarCicloMonitoramento,
  iniciarAgendadorMonitoramento,
};

if (require.main === module) {
  executarCicloMonitoramento().catch((erro) => {
    console.error("Erro no monitoramento:", erro);
    process.exit(1);
  });
}
