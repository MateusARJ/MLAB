# Analyze: Arrastar Arquivos para a Aba Arquivos da Sala

Feature: `018-arquivos-arrastar`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-181 a C-189), plan e tasks concordam: zona de soltar só na aba Arquivos, fila sequencial
com estados por item, erro que não interrompe a fila, pré-validação de 50 MB e pasta, botão com `multiple` na mesma
fila, e duas camadas contra a navegação por drop (renderer + guard restrito ao `index.html`).

- A issue #46 sugeria incluir o 415 e os headers e chamar a feature de `012-...`. As duas sugestões foram trocadas por
  decisão explícita (C-181, C-183). O escopo retirado vira issue na T186.
- O resumo da issue citava `main.ts` e `annotationOverlayWindow.ts`. O plan resolve o guard por parâmetro padrão, e
  as tasks proíbem os dois arquivos. Coerente com o Scope Lock.
- Revalidação de 2026-11-11 (C-190): o RF-191 entra na spec, a US-183 o descreve, o Scope Lock libera só
  `apps/web/src/pages/Room.tsx` e o teste dele, e a T187 cobre o requisito antes da T186. Não há contradição com o
  RNF-183, que foi ajustado para permitir só a rolagem; o contrato `files.md` e a ordem da lista não mudam.
- A faixa `18x` não colide: não há `RF-18x`, `RNF-18x`, `RN-18x`, `C-18x`, `T18x` nem `A13b` em outra feature.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-181 | T184 |
| RF-182 | T184 |
| RF-183 | T183 |
| RF-184 | T183, T184 |
| RF-185 | T183, T184 |
| RF-186 | T183 |
| RF-187 | T183 |
| RF-188 | T184 |
| RF-189 | T184 |
| RF-190 | T181, T182, T185 (smoke no app empacotado) |
| RF-191 | T187 (web e desktop), T186 (smoke) |
| RNF-181 | T181, T186 (smoke) |
| RNF-182 | T183 (servidor continua respondendo 413/403; o app só antecipa) |
| RNF-183 | todas (`apps/backend/**`, `packages/**` e contratos proibidos; `apps/web/**` proibido, exceto `pages/Room.tsx` e o teste dele na T187) |
| RNF-184 | T183 (service/hook), T184 (componente) |
| RNF-185 | todas (`package.json` só pelo bump) |
| RN-181 | T183 (mensagens do servidor), T185/T186 (smoke) |
| RN-182 | sem mudança no backend; zona só no desktop (T184) |
| Estados §7 / Edge cases §8 (unmount, pisca, sala cheia) | T183, T184 |

## 3. Contratos

Nenhuma mudança. `003/contracts/files.md` (POST multipart `file`; 201; 400/403/404/413) é consumido como está.
O `desktop-ipc.md` não muda: nenhum canal IPC novo.

## 4. Tarefas fora do Scope Lock

Nenhuma. Todos os paths das tasks estão em `Allowed Paths` do plan. `main.ts`, `annotationOverlayWindow.ts`,
`preload.ts`, `services/room.ts`, `services/auth.ts`, `packages/**` e `apps/backend/**` estão proibidos; em
`apps/web/**`, só `src/pages/Room.tsx` e `src/pages/Room.test.tsx` são permitidos (T187).

## 5. Riscos

- `tsc --noEmit` do desktop já falha (#51): o gate das tasks é nenhum erro novo nos arquivos tocados.
- O guard restrito só é exercitado de verdade no app empacotado: testes unitários com caminhos Windows e smoke A13b
  no instalador (janela principal e overlay de marcação).
- jsdom sem `DataTransfer`: os testes usam objetos falsos; o comportamento real do Explorador fica para o smoke.

## 6. Resultado

- [ ] FAIL
- [x] PASS: T181 a T187 concluídas; converge em `converge.md`.
