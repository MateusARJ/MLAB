# Converge: E2E sem Recarregamento do Vite

Feature: `051-e2e-sem-reload-do-vite`
Status: DONE
Branch: `fix/e2e-sem-reload-do-vite`, a partir da `development` @ `34716d8` (2.2.0)

## 1. Evidências

- `I1` (`apps/web/e2e/infra.e2e.ts`): verde com a configuração nova. Com o `vite.config.ts` anterior e
  `--output=e2e-results/artifacts`, falha mostrando os dois `full-reload`
  (`/e2e-results/i1-…/i1-recurso.html` e `/e2e-results/artifacts/…/i1-recurso.html`).
- Vite 5.4.21 (`resolveChokidarOptions`): `server.watch.ignored` é somado aos padrões (`.git`, `node_modules`,
  `test-results`, cache), sem substituí-los.
- Repetições sem retry, nesta branch:

| Teste | Antes (configuração anterior) | Depois |
|---|---|---|
| A3 `desktop` | 3 falhas em 40, todas com `recv full-reload` | 40/40 |
| A10 `desktop` + `mobile` | — | 30/30 (15 + 15) |

- A13 `mobile` nesta branch, sem a 050: 9 falhas em 15. É o defeito da #149 (nome acessível "1" no botão de
  Arquivos), corrigido no #154 e ainda fora da `development`. Sem os recarregamentos do Vite, a corrida do selo
  aparece mais vezes; antes, o recarregamento às vezes reiniciava a página e o teste passava por acaso.
- Branch local temporária com esta feature e o #154 (050) juntos: A13 `mobile` 15/15 e suíte e2e completa 14/14
  (`desktop` e `mobile`, com o `I1`), sem retry. Branch apagada depois da verificação.
- `node --check scripts/smoke-report.js` ok; o relatório passa a ler `apps/web/test-results/e2e-results.json`.
- HMR de `src/`: os globs só cobrem `test-results`, `e2e-results` e `playwright-report`. A edição de um arquivo de
  `src/` com o `npm run dev` aberto não foi testada à mão; fica para a validação do responsável.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5101 | `playwright.config.ts`: `outputDir: 'test-results/e2e'`, JSON em `test-results/e2e-results.json` |
| RF-5102 | `vite.config.ts`: `server.watch.ignored`; `I1` e prova negativa |
| RF-5103 | `smoke-report.js` no novo caminho; `node --check` |
| RF-5104 | `I1` verde; falha com a configuração anterior |
| RF-5105 | `apps/web/.gitignore` com `test-results/` |
| RNF-5101 | A3 40/40, A10 30/30, A13 15/15 com o #154 |
| RNF-5102 | suíte completa 14/14 com o #154 |
| RNF-5103 | nenhuma dependência nova |
| RNF-5104 | nenhum manifesto de versão alterado |

## 3. Desvios registrados

- Nenhum novo. A falha do A13 sem a 050 é a #149, já corrigida no #154.

## 4. Trabalho restante

- Depois do merge do #154 e desta feature, rodar a suíte e2e na `development` para confirmar o conjunto.
- Fechamento lento do trace com `--trace=on` (registrado na #153): não verificado nesta feature (Non-Goal). Se
  continuar depois da mudança de pasta, vira issue própria.

## 5. Impacto de versão

**Nenhum** (C-5103): muda só configuração de teste, a observação de arquivos do servidor de desenvolvimento e um
script do smoke; o instalador não muda (`docs/versionamento.md` §2).
