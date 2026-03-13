let nodemailer;

try {
  nodemailer = require("nodemailer");
} catch (erro) {
  nodemailer = null;
}

function emailEstaConfigurado() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM &&
      nodemailer
  );
}

function criarTransport() {
  if (!emailEstaConfigurado()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function montarTexto(assinatura, ocorrencias) {
  const linhas = [
    `Novas ocorrencias para a palavra-chave "${assinatura.palavraChave}" no IOERJ:`,
    "",
  ];

  for (const ocorrencia of ocorrencias) {
    linhas.push(`Data: ${ocorrencia.dataPublicacao || "-"}`);
    linhas.push(`ID da materia: ${ocorrencia.idMateria || "-"}`);
    linhas.push(`Pagina: ${ocorrencia.pagina || "-"}`);
    linhas.push(`Jornal: ${ocorrencia.jornal || "-"}`);
    linhas.push(`Tipo: ${ocorrencia.tipo || "-"}`);
    linhas.push(`Resumo: ${ocorrencia.resumo || "-"}`);
    linhas.push("");
  }

  return linhas.join("\n");
}

function montarHtml(assinatura, ocorrencias) {
  const itens = ocorrencias
    .map(
      (ocorrencia) => `
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">${ocorrencia.dataPublicacao || "-"}</td>
          <td style="padding:10px;border:1px solid #ddd;">${ocorrencia.idMateria || "-"}</td>
          <td style="padding:10px;border:1px solid #ddd;">${ocorrencia.pagina || "-"}</td>
          <td style="padding:10px;border:1px solid #ddd;">${ocorrencia.jornal || "-"}</td>
          <td style="padding:10px;border:1px solid #ddd;">${ocorrencia.tipo || "-"}</td>
          <td style="padding:10px;border:1px solid #ddd;">${ocorrencia.resumo || "-"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;">
      <h2>Novas ocorrencias no IOERJ</h2>
      <p>
        Encontramos <strong>${ocorrencias.length}</strong> nova(s) ocorrencia(s)
        para a palavra-chave <strong>${assinatura.palavraChave}</strong>.
      </p>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Data</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">ID</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Pagina</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Jornal</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Tipo</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Resumo</th>
          </tr>
        </thead>
        <tbody>${itens}</tbody>
      </table>
    </div>
  `;
}

async function enviarAlertaNovasOcorrencias(assinatura, ocorrencias) {
  if (!nodemailer) {
    return {
      enviado: false,
      motivo: "dependencia-nodemailer-ausente",
    };
  }

  if (!emailEstaConfigurado()) {
    return {
      enviado: false,
      motivo: "smtp-nao-configurado",
    };
  }

  const transport = criarTransport();

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: assinatura.email,
    subject: `[IOERJ] ${ocorrencias.length} nova(s) ocorrencia(s) para "${assinatura.palavraChave}"`,
    text: montarTexto(assinatura, ocorrencias),
    html: montarHtml(assinatura, ocorrencias),
  });

  return {
    enviado: true,
  };
}

module.exports = {
  emailEstaConfigurado,
  enviarAlertaNovasOcorrencias,
};
