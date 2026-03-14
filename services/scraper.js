const { chromium } = require('playwright');

const URL_BUSCA = 'https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca';

function extrairCamposDeLinhas(cabecalho, linhaMeta, resumo) {
  const dataMatch = cabecalho.match(/(\d{2}\/\d{2}\/\d{4})/);
  const paginaMatch = cabecalho.match(/p[aá]gina\s+(\d+)/i);
  const idMatch = cabecalho.match(/Mat[ée]ria Id:\s*(\d+)/i);
  const jornalMatch = linhaMeta.match(/Jornal:\s*(.*?)\s+Tipo:/i);
  const tipoMatch = linhaMeta.match(/Tipo:\s*(.*)$/i);

  return {
    dataPublicacao: dataMatch ? dataMatch[1] : '',
    pagina: paginaMatch ? paginaMatch[1] : '',
    idMateria: idMatch ? idMatch[1] : '',
    jornal: jornalMatch ? jornalMatch[1].trim() : '',
    tipo: tipoMatch ? tipoMatch[1].trim() : '',
    resumo: (resumo || '').trim()
  };
}

async function buscar(keyword, dataInicio = null, dataFim = null) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const campoBusca = page.locator('input[name="textobusca"]');
    await campoBusca.waitFor();
    await campoBusca.fill(keyword);

    if (dataInicio) {
      const campoInicio = page.locator('input[name="datainicio"]');
      const existe = await campoInicio.count();
      if (existe) await campoInicio.fill(dataInicio);
    }

    if (dataFim) {
      const campoFim = page.locator('input[name="datafim"]');
      const existe = await campoFim.count();
      if (existe) await campoFim.fill(dataFim);
    }

    await page.locator('input[type="submit"][name="buscar"]').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const textoFinal = await page.locator('body').innerText();
    const linhas = textoFinal.split('\n').map(l => l.trim()).filter(Boolean);
    const ocorrencias = [];

    for (let i = 0; i < linhas.length; i++) {
      const cabecalho = linhas[i];
      if (!/\d{2}\/\d{2}\/\d{4}\s+p[aá]gina\s+\d+\s+-\s+Mat[ée]ria Id:\s*\d+/i.test(cabecalho)) continue;

      const linhaMeta = linhas[i + 1] || '';
      const resumo = linhas[i + 2] || '';
      const item = extrairCamposDeLinhas(cabecalho, linhaMeta, resumo);

      if (!item.idMateria) continue;

      ocorrencias.push({ ...item, coletadoEm: new Date().toISOString() });
    }

    return ocorrencias;
  } finally {
    await browser.close();
  }
}

module.exports = { buscar };
