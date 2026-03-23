const axios = require('axios');

async function enviarAlerta({ phone, apikey, keywordText, ocorrencia }) {
  const texto = [
    `DOERJ: nova publicacao em "${keywordText}"`,
    `${ocorrencia.dataPublicacao || '-'} | Pag. ${ocorrencia.pagina || '-'}`,
    `${ocorrencia.jornal || '-'}`,
    `${ocorrencia.tipo || '-'}`,
    `${(ocorrencia.resumo || '-').substring(0, 200)}`
  ].join('\n');

  await axios.get('https://api.callmebot.com/whatsapp.php', {
    params: { phone, text: texto, apikey }
  });
}

module.exports = { enviarAlerta };
