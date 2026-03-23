const nodemailer = require('nodemailer');

let testTransporter = null;

async function criarTransporter() {
  if (process.env.EMAIL_USER) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }

  if (!testTransporter) {
    const conta = await nodemailer.createTestAccount();
    testTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: conta.user, pass: conta.pass }
    });

    console.log('[email] Modo TESTE ativo (Ethereal). Emails ficam visiveis em: https://ethereal.email');
    console.log('[email] Login Ethereal:', conta.user, '|', conta.pass);
  }

  return testTransporter;
}

async function enviarAlerta({ destinatario, keywordText, ocorrencia }) {
  const transporter = await criarTransporter();

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:white;margin:0;font-size:18px">Nova publicacao encontrada no DOERJ</h2>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#475569;margin-top:0">O monitoramento <strong style="color:#0f172a">"${keywordText}"</strong> encontrou uma nova publicacao.</p>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <tr style="background:#f1f5f9"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;width:140px">Data</td><td style="padding:10px 16px;color:#1e293b">${ocorrencia.dataPublicacao || '-'}</td></tr>
          <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">ID Materia</td><td style="padding:10px 16px;color:#1e293b">${ocorrencia.idMateria || '-'}</td></tr>
          <tr style="background:#f1f5f9"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Jornal</td><td style="padding:10px 16px;color:#1e293b">${ocorrencia.jornal || '-'}</td></tr>
          <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Tipo</td><td style="padding:10px 16px;color:#1e293b">${ocorrencia.tipo || '-'}</td></tr>
          <tr style="background:#f1f5f9"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Pagina</td><td style="padding:10px 16px;color:#1e293b">${ocorrencia.pagina || '-'}</td></tr>
          <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Resumo</td><td style="padding:10px 16px;color:#1e293b;font-size:14px">${ocorrencia.resumo || '-'}</td></tr>
        </table>
        ${ocorrencia.sourceUrl ? `
          <p style="margin:20px 0 0">
            <a href="${ocorrencia.sourceUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">
              Abrir publicacao no DOERJ
            </a>
          </p>
        ` : ''}
        <p style="margin-bottom:0;margin-top:20px;font-size:12px;color:#94a3b8">Enviado automaticamente pelo Monitor DOERJ</p>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Monitor DOERJ <noreply@monitor-doerj>',
    to: destinatario,
    subject: `DOERJ: nova publicacao em "${keywordText}"`,
    html
  });

  if (!process.env.EMAIL_USER) {
    console.log('[email] Preview do email:', nodemailer.getTestMessageUrl(info));
  }
}

module.exports = { enviarAlerta };
