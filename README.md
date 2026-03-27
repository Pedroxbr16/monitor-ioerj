# monitor-ioerj

Monitor do DOERJ com:
- monitoramento de palavras-chave/secoes;
- acervo local de edicoes em PDF por data;
- indexacao no MongoDB para pesquisa rapida.

## Acervo DOERJ (novo)

Os PDFs sao salvos em:

`dados/doerj/ANO/MES/DIA/DD-parte-xxxx.pdf`

Exemplo:

`dados/doerj/2026/03/25/25-parte-i-poder-executivo.pdf`

### Sincronizar a edicao do dia

```bash
npm run archive:sync
```

Para forcar reprocessamento do dia:

```bash
npm run archive:sync -- --force
```

Para sincronizar uma data especifica:

```bash
npm run archive:sync -- --date=2026-03-25
```

### Backfill historico por periodo

```bash
npm run archive:backfill -- --start=2026-01-01 --end=2026-03-25
```

Para forcar reprocessamento das datas:

```bash
npm run archive:backfill -- --start=2026-01-01 --end=2026-03-25 --force
```

### Variaveis de ambiente do acervo

- `DOERJ_ARCHIVE_ENABLED=true`
- `DOERJ_ARCHIVE_CRON=0 7 * * 1-5`
- `RUN_ARCHIVE_SYNC_ON_STARTUP=true`
- `DOERJ_ARCHIVE_DIR=./dados/doerj`
- `ARCHIVE_SEARCH_LIMIT=3000`

O cron diario do acervo roda no servidor e baixa automaticamente novas edicoes.
