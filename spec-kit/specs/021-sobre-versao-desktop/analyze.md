# Analyze: Versão e Informações do MLab no App Desktop

Feature: `021-sobre-versao-desktop`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma.

- Spec, clarify (C-2101 a C-2107) e plan concordam: rodapé e diálogo nas telas de identificação e dashboard, canal
  `get-app-info`, descrição única, copyright `Copyright © 2026 Mateus de Araujo` lido do `build.copyright` e versão
  MINOR.
- Revalidação de 2026-11-12: a C-2104 foi revista depois da T2102 (ano de lançamento e titular informados pelo
  responsável). RF-2106, plan e tasks foram atualizados juntos, e a T2101a ajusta o código já entregue na T2101.
  Nenhuma outra task muda.
- O plan inclui `packages/types/src/index.ts` porque o contrato `desktop-ipc.md` exige o tipo do payload ali.
- A faixa `210x` não colide com outras features: busca por `RF-210`, `C-210` e `T210` em `spec-kit/` e `docs/` só
  acha esta feature.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2101 | T2102 (componente), T2103 (telas) |
| RF-2102 | T2102 |
| RF-2103 | T2102 |
| RF-2104 | T2101 (`app.getVersion()`), T2105 (versão do executável) |
| RF-2105 | T2101 (descrição do `define`), T2104 (`package.json`) |
| RF-2106 | T2101a (`readAppMeta` e `buildAppInfo`), T2104 (`build.copyright`), T2105 (`VersionInfo`) |
| RF-2107 | T2102 (hook e componente) |
| RNF-2101 | T2101 |
| RNF-2102 | T2101 |
| RNF-2103 | todas: nenhuma dependência nova |
| RNF-2104 | T2102 |
| RN-2101 | T2104 (`version` intocado), T2105 (bump) |

## 3. Contratos

- `003-classroom-interaction/contracts/desktop-ipc.md` ganha o canal `get-app-info` na T2101.
- `packages/types` ganha `AppInfo` na mesma task.
- Nenhuma mudança HTTP/WebSocket.

## 4. Tarefas fora do Scope Lock

Nenhuma. Cada task toca só os Allowed Paths do plan; a T2105 só mexe em `package.json` via `npm run bump`.

## 5. Riscos

- Asserção exata `getByText('MLab')` em `ProfessorEntry.test.tsx`: o rodapé usa o texto "MLab vX.Y.Z" num nó único.
- Global do `define` ausente nos testes: `buildAppInfo` é pura e recebe o metadado por parâmetro.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2101a.
