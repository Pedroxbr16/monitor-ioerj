const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIRETORIO_DADOS = path.join(__dirname, "..", "dados");
const ARQUIVO_ASSINATURAS = path.join(DIRETORIO_DADOS, "assinaturas.json");
const ARQUIVO_OCORRENCIAS = path.join(DIRETORIO_DADOS, "ocorrencias.json");

function normalizarPalavraChave(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function garantirEstrutura() {
  fs.mkdirSync(DIRETORIO_DADOS, { recursive: true });

  if (!fs.existsSync(ARQUIVO_ASSINATURAS)) {
    fs.writeFileSync(
      ARQUIVO_ASSINATURAS,
      JSON.stringify({ assinaturas: [] }, null, 2),
      "utf-8"
    );
  }

  if (!fs.existsSync(ARQUIVO_OCORRENCIAS)) {
    fs.writeFileSync(
      ARQUIVO_OCORRENCIAS,
      JSON.stringify({ ultimaAtualizacao: null, palavrasChave: [] }, null, 2),
      "utf-8"
    );
  }
}

function lerJson(arquivo, fallback) {
  garantirEstrutura();

  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8"));
  } catch (erro) {
    return fallback;
  }
}

function salvarJson(arquivo, dados) {
  garantirEstrutura();
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), "utf-8");
}

function lerAssinaturas() {
  const dados = lerJson(ARQUIVO_ASSINATURAS, { assinaturas: [] });
  return {
    assinaturas: Array.isArray(dados.assinaturas) ? dados.assinaturas : [],
  };
}

function salvarAssinaturas(dados) {
  salvarJson(ARQUIVO_ASSINATURAS, {
    assinaturas: Array.isArray(dados.assinaturas) ? dados.assinaturas : [],
  });
}

function lerOcorrencias() {
  const dados = lerJson(ARQUIVO_OCORRENCIAS, {
    ultimaAtualizacao: null,
    palavrasChave: [],
  });

  if (
    !Array.isArray(dados.palavrasChave) &&
    Array.isArray(dados.ocorrencias) &&
    dados.palavraChave
  ) {
    return {
      ultimaAtualizacao: dados.ultimaAtualizacao || null,
      palavrasChave: [
        {
          palavraChave: dados.palavraChave,
          palavraNormalizada: normalizarPalavraChave(dados.palavraChave),
          ultimaBuscaEm: dados.ultimaAtualizacao || null,
          totalEncontradoNaUltimaBusca: Number(
            dados.totalEncontradoNaUltimaBusca || dados.ocorrencias.length || 0
          ),
          ocorrencias: dados.ocorrencias.map((ocorrencia) => ({
            ...ocorrencia,
            palavraChave: dados.palavraChave,
            palavraNormalizada: normalizarPalavraChave(dados.palavraChave),
            primeiraDeteccaoEm:
              ocorrencia.primeiraDeteccaoEm ||
              ocorrencia.detectadoEm ||
              dados.ultimaAtualizacao ||
              null,
          })),
        },
      ],
    };
  }

  return {
    ultimaAtualizacao: dados.ultimaAtualizacao || null,
    palavrasChave: Array.isArray(dados.palavrasChave) ? dados.palavrasChave : [],
  };
}

function salvarOcorrencias(dados) {
  salvarJson(ARQUIVO_OCORRENCIAS, {
    ultimaAtualizacao: dados.ultimaAtualizacao || null,
    palavrasChave: Array.isArray(dados.palavrasChave) ? dados.palavrasChave : [],
  });
}

function obterRegistroDaPalavra(dadosOcorrencias, palavraNormalizada) {
  return dadosOcorrencias.palavrasChave.find(
    (item) => item.palavraNormalizada === palavraNormalizada
  );
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function adicionarAssinatura({ palavraChave, email }) {
  const palavraLimpa = String(palavraChave || "").replace(/\s+/g, " ").trim();
  const emailLimpo = String(email || "").trim().toLowerCase();

  if (!palavraLimpa) {
    throw new Error("palavra-chave-invalida");
  }

  if (!validarEmail(emailLimpo)) {
    throw new Error("email-invalido");
  }

  const dadosAssinaturas = lerAssinaturas();
  const dadosOcorrencias = lerOcorrencias();
  const palavraNormalizada = normalizarPalavraChave(palavraLimpa);

  const existente = dadosAssinaturas.assinaturas.find(
    (assinatura) =>
      assinatura.email === emailLimpo &&
      normalizarPalavraChave(assinatura.palavraChave) === palavraNormalizada &&
      assinatura.ativa !== false
  );

  if (existente) {
    return {
      status: "existing",
      assinatura: existente,
    };
  }

  const registroPalavra = obterRegistroDaPalavra(dadosOcorrencias, palavraNormalizada);
  const idsConhecidos = (registroPalavra?.ocorrencias || [])
    .map((ocorrencia) => String(ocorrencia.idMateria || ""))
    .filter(Boolean);

  const agora = new Date().toISOString();
  const assinatura = {
    id: crypto.randomUUID(),
    email: emailLimpo,
    palavraChave: palavraLimpa,
    palavraNormalizada,
    ativa: true,
    inicializada: idsConhecidos.length > 0,
    idsConhecidos,
    criadaEm: agora,
    ultimoMonitoramentoEm: null,
    ultimoAlertaEm: null,
  };

  dadosAssinaturas.assinaturas.push(assinatura);
  salvarAssinaturas(dadosAssinaturas);

  return {
    status: "created",
    assinatura,
  };
}

function mesclarOcorrenciasPorId(anteriores, atuais, agora) {
  const mapa = new Map();

  for (const item of anteriores) {
    mapa.set(String(item.idMateria), item);
  }

  for (const item of atuais) {
    const chave = String(item.idMateria);
    const existente = mapa.get(chave);

    mapa.set(chave, {
      ...item,
      primeiraDeteccaoEm: existente?.primeiraDeteccaoEm || item.primeiraDeteccaoEm || agora,
    });
  }

  return Array.from(mapa.values()).sort((a, b) =>
    String(b.primeiraDeteccaoEm || "").localeCompare(
      String(a.primeiraDeteccaoEm || ""),
      "pt-BR"
    )
  );
}

module.exports = {
  garantirEstrutura,
  lerAssinaturas,
  salvarAssinaturas,
  lerOcorrencias,
  salvarOcorrencias,
  normalizarPalavraChave,
  obterRegistroDaPalavra,
  adicionarAssinatura,
  mesclarOcorrenciasPorId,
};
