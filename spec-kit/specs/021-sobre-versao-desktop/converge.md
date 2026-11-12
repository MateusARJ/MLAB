# Converge: Versão e Informações do MLab no App Desktop

Feature: `021-sobre-versao-desktop`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `665e892` (T2101), `189f433` (T2102), `b51ff61` (T2101a), `08c9511` (T2103), `7fa512a` (T2104)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2101 a C-2107, com a C-2104 revista), `plan.md`, `tasks.md` (T2101 a T2105, T2101a)
- código: `packages/types/src/index.ts`, `apps/desktop/electron.vite.config.ts`, `apps/desktop/src/main/{appMeta,appInfo,main,preload}.ts`,
  `apps/desktop/src/renderer/hooks/useAppInfo.ts`, `apps/desktop/src/renderer/components/AppInfoFooter.tsx`,
  `apps/desktop/src/renderer/pages/{ProfessorEntry,Dashboard}.tsx`, `apps/desktop/package.json`
- contrato: `003-classroom-interaction/contracts/desktop-ipc.md`
- suítes e checks:
  - `npx tsc --noEmit -p .` e `npx vitest run` em `apps/desktop`;
  - `npm run lint` na raiz;
  - `electron-vite build`;
  - `electron-builder --win --dir` com leitura do `VersionInfo`.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2101 | `AppInfoFooter` em `ProfessorEntry.tsx` e `Dashboard.tsx`; testes "mostra a versão do MLab no rodapé" nas duas telas e em `AppInfoFooter.test.tsx` |
| RF-2102 | `AppInfoFooter.test.tsx`: o diálogo mostra nome, "Versão X.Y.Z", descrição e copyright |
| RF-2103 | `AppInfoFooter.test.tsx`: fecha por "Fechar" e por Esc |
| RF-2104 | `main.ts`: `buildAppInfo(app.getVersion(), __MLAB_APP_META__)`; `appInfo.test.ts`; nenhuma versão escrita à mão em `apps/desktop/src` |
| RF-2105 | `package.json`: `description` = `build.linux.description` = "Plataforma de transmissão de tela e interação para aulas ao vivo"; o bundle do main recebe o mesmo texto (`define_MLAB_APP_META_default` em `out/main/main.js`) |
| RF-2106 | `build.copyright` = `Copyright © 2026 Mateus de Araujo`; `readAppMeta` o leva ao app (`appMeta.test.ts`, inclusive com o `package.json` real); `MLab.exe` → `LegalCopyright` = `Copyright © 2026 Mateus de Araujo` |
| RF-2107 | `useAppInfo.test.ts` e `AppInfoFooter.test.tsx`: falha do IPC ou resposta sem versão → nada renderizado |
| RNF-2101 | renderer só usa `window.electronAPI.getAppInfo()`; canal sem parâmetros |
| RNF-2102 | `get-app-info` na tabela Renderer → Main de `desktop-ipc.md`; `AppInfo` em `packages/types` |
| RNF-2103 | nenhuma dependência nova em `package.json` |
| RNF-2104 | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; foco no "Fechar" ao abrir (teste) |
| RN-2101 | `version` do `package.json` intocado até o `npm run bump`; `ProductVersion`/`FileVersion` do executável iguais ao `version` |

Suíte do desktop: 29 arquivos e 262 testes verdes. `tsc --noEmit` do desktop: 0 erros. `npm run lint` na raiz: 5 de 5.

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RF-2101, RF-2102 | Smoke manual do professor no app em execução (`npm run dev` ou instalador): conferir o rodapé e o "Sobre" nas duas telas | Comportamento coberto por testes de componente e de tela. O agente não tem acesso visual ao app em execução; o smoke fica com o responsável, antes do merge. |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| Clique fora do diálogo também o fecha | `AppInfoFooter.tsx` (backdrop) | complementa RF-2103 sem mudar o estado da tela; mantido |

## 5. Testes faltantes

- Nenhum teste automatizado do handler `get-app-info` dentro do processo principal real. A lógica está em funções
  puras testadas (`readAppMeta`, `buildAppInfo`), e o registro do canal segue o padrão de `get-host-key`.

## 6. Novas tasks necessárias

- Nenhuma na 021.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio encontrado |

Revisão de decisão durante a implementação (não é desvio): a C-2104 foi revista pelo responsável depois da T2102. O
copyright passou de "ano do build" para `Copyright © 2026 Mateus de Araujo`. Os artefatos foram revalidados no commit
`43dff81`, e o código foi ajustado na T2101a.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.13.0 | Funcionalidade nova e compatível: US-2101/US-2102 e o canal IPC `get-app-info` (adição compatível em contrato), sem remover nada (C-2107). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — rodapé e "Sobre" nas telas de identificação e dashboard, versão vinda de `app.getVersion()`,
  descrição única e copyright `Copyright © 2026 Mateus de Araujo` no app e no executável. Só falta o smoke manual
  do professor (seção 2).
