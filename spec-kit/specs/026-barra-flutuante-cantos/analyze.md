# Analyze: Barra Flutuante de Marcação nos Cantos da Tela

Feature: `026-barra-flutuante-cantos`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma.

- Spec, clarify (C-2601 a C-2604) e plan concordam: posições independentes só na sessão, reabertura na posição da
  barra aberta enquanto a bolinha não se move, âncora à bolinha nos demais casos, orientação fixada na expansão,
  contrato inalterado, versão PATCH.
- RNF-2601 é compatível com o main: `annotationOverlayWindow.ts` (`syncState`) só guarda e repassa `toolbarPos`, e a
  `Room.tsx` não lê esse campo; nenhum dos dois está nos Allowed Paths.
- A faixa `260x` não colide: a busca por `RF-260`, `C-260` e `T260` em `spec-kit/` e `docs/` só acha esta feature.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2601 | T2601, T2602 |
| RF-2602 | T2601, T2602, T2603 |
| RF-2603 | T2601, T2602 (unitários nos quatro cantos), T2603 |
| RF-2604 | T2601, T2602, T2603 (mão levantada, popover) |
| RF-2605 | T2601, T2602 (botão, sync, atalho), T2603 (`Alt+H`) |
| RF-2606 | T2601, T2602 |
| RNF-2601 | T2601 (contrato intocado; `packages/**` proibido) |
| RNF-2602 | T2601, T2602 (testes da 009 e 017 seguem verdes) |
| RNF-2603 | T2601 (nenhuma dependência) |

## 3. Contratos

- Nenhum contrato afetado (C-2602).

## 4. Tarefas fora do Scope Lock

Nenhuma. A T2601 toca o componente e a nota da 003; a T2602 só o teste; a T2603 só esta pasta; a T2604 só mexe em
`package.json` via `npm run bump`.

## 5. Riscos

- Eco do main ao trocar `collapsed` e alternância dupla do `Alt+H`: mitigados no plan §3; um defeito confirmado fora
  do escopo vira issue de desvio.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2601.
