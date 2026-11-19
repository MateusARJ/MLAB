# Spec: E2E sem Recarregamento do Vite

Status: READY
Feature ID: `051-e2e-sem-reload-do-vite`
Origem: issue #153 (e2e A3 instável: vídeo que não chega ao aluno). A análise registrada na issue mostrou que a causa é
a configuração do e2e, não o app nem o SFU. Muda só ferramenta de teste; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

1. Os artefatos gravados pelo Playwright durante o e2e do aluno não fazem o servidor de desenvolvimento do web
   recarregar a página em teste.
2. O e2e do aluno deixa de falhar de forma intermitente por esse recarregamento.

## 2. Contexto

Verificado em 2026-11-18 na `development` @ `34716d8` (2.2.0):

- `apps/web/playwright.config.ts`: `outputDir: 'e2e-results/artifacts'`, relatório JSON em
  `e2e-results/results.json` e `trace: 'retain-on-failure'`. Com `retain-on-failure`, o trace de todo teste é gravado
  e só apagado no fim, se o teste passar.
- Durante a gravação, os recursos de rede do trace vão para
  `e2e-results/artifacts/.playwright-artifacts-0/traces/resources/<sha1>.html` (cópia do `index.html` servido ao
  aluno). Um observador de arquivos registrou esse `.html` durante um A10 normal.
- `apps/web/vite.config.ts` não configura `server.watch`. O Vite observa `apps/web` e ignora por padrão só `.git`,
  `node_modules`, `test-results` e o cache; `e2e-results` é observada.
- Com a página do aluno aberta, um `.html` gravado em `e2e-results/` fez o Vite enviar
  `{"type":"full-reload","path":"/e2e-results/…"}` pelo WebSocket do HMR; um `.png` no mesmo lugar e um `.html` em
  `test-results/` não enviaram nada.
- A3 repetido 40 vezes: 3 falhas, todas com `recv full-reload` nos frames do aluno e o WebSocket da sala fechado
  depois da `offer`. Sem o recarregamento (reproduções instrumentadas), 80/80 verdes.
- `scripts/smoke-report.js` (004) lê o relatório em `apps/web/e2e-results/results.json`.

## 3. Escopo

### Incluído

- Pasta de saída e relatório JSON do Playwright do web.
- Pastas ignoradas pelo observador do servidor de desenvolvimento do web.
- Caminho do relatório lido por `scripts/smoke-report.js`.
- Teste e2e de regressão do não recarregamento.

### Não incluído

- Código do app (`apps/web/src/**`), backend, SFU, desktop.
- Cenários e asserções dos testes A3–A20.
- Causa do fechamento lento do trace com `--trace=on` (registrada na #153 como hipótese; vira issue própria se a
  verificação mostrar que continua).

## 4. Atores

- **Mantenedor**, que roda o e2e localmente e na matriz de smoke.

## 5. User Stories

### US-5101 — E2E sem recarregamento da página

Como mantenedor, quero que o e2e do aluno só falhe por defeito real, e não porque o Vite recarregou a página.

- Dado o e2e rodando com a configuração padrão, quando o Playwright grava o trace de um teste, então a página do aluno
  não recebe `full-reload`.
- Dado o A3 repetido 40 vezes sem retry, então todas as execuções passam.

## 6. Requisitos Funcionais

- RF-5101: o Playwright do web grava artefatos em `apps/web/test-results/e2e` e o relatório JSON em
  `apps/web/test-results/e2e-results.json`.
- RF-5102: o servidor de desenvolvimento do web ignora `**/test-results/**`, `**/e2e-results/**` e
  `**/playwright-report/**` na observação de arquivos, explicitamente.
- RF-5103: `scripts/smoke-report.js` lê o relatório do e2e no novo caminho.
- RF-5104: um teste e2e grava um `.html` na pasta de saída do teste e em `e2e-results/` com a página do aluno aberta
  e verifica que o WebSocket do HMR não recebe `full-reload`.
- RF-5105: `apps/web/.gitignore` inclui `test-results/`.

## 7. Requisitos Não Funcionais

- RNF-5101 — estabilidade: A3 (`desktop`), A10 (`desktop` e `mobile`) e A13 (`mobile`) verdes em execuções repetidas
  sem retry (40 para o A3).
- RNF-5102 — regressão: suíte e2e do aluno verde nos dois projetos; HMR do `src/` continua funcionando.
- RNF-5103 — dependências: nenhuma nova.
- RNF-5104 — versão: sem incremento (só ferramenta de teste, `docs/versionamento.md` §2).

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| trace gravado durante o teste | `.html` em `test-results/e2e/…`; sem `full-reload` |
| arquivo antigo em `e2e-results/` | ignorado pelo Vite |
| `npm run smoke -- --no-run` | lê `apps/web/test-results/e2e-results.json` |

## 9. Edge Cases

- Cópia local antiga de `e2e-results/`: continua no `.gitignore` e ignorada pelo Vite.
- `npx playwright test --output=<outra pasta>` fora de `apps/web`: fora do escopo.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `npx playwright test -g "A3 " --project=desktop --repeat-each=40 --retries=0` → 40/40.
- Teste de regressão (RF-5104) verde e quebrando com a configuração anterior.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5101 a C-5103).
