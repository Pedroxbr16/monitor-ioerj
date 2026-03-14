const axios = require('axios');

async function enviarAlerta({ phone, apikey, keywordText, ocorrencia }) {
  const texto = `🔔 DOERJ: "${keywordText}" encontrada!\n📅 ${ocorrencia.dataPublicacao || '-'} | Pág. ${ocorrencia.pagina || '-'}\n📰 ${ocorrencia.jornal || '-'}\n📋 ${ocorrencia.tipo || '-'}\n📝 ${(ocorrencia.resumo || '-').substring(0, 200)}`;

  const url = `https://api.callmebot.com/whatsapp.php`;
  await axios.get(url, {
    params: { phone, text: texto, apikey }
  });
}

module.exports = { enviarAlerta };
