# Analyze: Fixar uma Janela na Transmissão de Múltiplas Janelas

Feature: `032-fixar-janela-transmissao`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3201 a C-3206) e plan concordam: uma janela fixada por vez; foco ignorado e registrado; desfixar
  troca para a última focada só quando difere; cursor e lupa só na fixada via `pinnedSourceId`; janela fechada desfixa,
  minimizada mantém; sem atalho e sem barra de marcação; clique no nome com fixação equivale a Fixar; versão MINOR.
- A issue #91 deixava em aberto o clique no nome com uma janela fixada; resolvido em C-3205, sem contradizer a regra
  "fixar outra substitui".
- O comportamento atual de seguir o foco não tem RF próprio na 001/003; a 032 o descreve como linha de base
  (RF-3210) e não o altera sem fixação.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3201 | T3204 |
| RF-3202 | T3202, T3203 |
| RF-3203 | T3201, T3203 |
| RF-3204 | T3202, T3203 |
| RF-3205 | T3204 |
| RF-3206 | T3203 |
| RF-3207 | T3202, T3203 |
| RF-3208 | T3201, T3206 (notas 003/007) |
| RF-3209 | T3203 |
| RF-3210 | T3203, T3204, T3205 |
| RF-3211 | T3201 |
| RNF-3201 | T3201 |
| RNF-3202 | T3201, T3202, T3203, T3205 |
| RNF-3203 | todas: nenhuma dependência nova |

## 3. Contratos

- `003/contracts/desktop-ipc.md`: `startCursorTracking(target)` com `pinnedSourceId` opcional e semântica de
  `active-window-changed` com uma janela fixada, registrados antes da implementação; a T3201 marca "Em vigor".
- `packages/types` e protocolo WebSocket inalterados.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3201 toca só o main (`cursorPresence.ts`, teste novo, tipo no `preload.ts`) e o contrato; T3202 só o hook e
o `setup.ts`; T3203 a T3205 só `Room.tsx` e `Room.test.tsx`; T3206 só documentos e `package.json` via `npm run bump`.
O `main.ts` fica proibido porque o handler já repassa o alvo inteiro ao `CursorPresenceTracker.start`.

## 5. Riscos

- Conflito com o #93 no `Room.tsx`: mitigado por C-3201 (T3203 em diante só depois do merge, com revalidação deste
  analyze).
- Alinhamento real do cursor e fim da captura com janelas do sistema operacional não cobertos por teste automatizado:
  mitigado pelos testes com rastreador simulado e pela verificação manual da T3206.
- Possível problema anterior na gravação após troca de janela: fora do escopo; observado na T3206 (C-3206).

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3201, na branch de implementação criada depois do merge do #93 (C-3201).
