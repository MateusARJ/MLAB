# Converge: Aviso de Mão Levantada Responsivo

Feature: `006-banner-mao-levantada`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-02
Commit avaliado: `d7e7024` (branch `fix/web-banner-mao-levantada`)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-601, C-602), `plan.md`, `tasks.md` (T601–T603)
- Suítes: `npx turbo run build test --force` (8/8 tasks), vitest do web 40/40, `tsc` ok, `npm run spec:check` (6/6 PASS)
- E2E do aluno no Microsoft Edge: 13/13 OK (A15 no desktop e no mobile); 2 flaky do harness (ver §5)
- Capturas no perfil mobile (Pixel 7 e 360 px de largura) em `evidencias/`

## 1. Requisitos atendidos

| Requisito | Evidência |
|---|---|
| RF-601 largura limitada à área do vídeo | `Room.tsx` (`handRaisedBanner`: `max-content` + `calc(100% - 32px)`); teste de `Room`; E2E A15 mobile; `evidencias/depois-360px.png` |
| RF-602 ícone fixo e botão sem quebra | `handRaisedBannerIcon` (`flexShrink: 0`, 16 px), `handRaisedLowerBtn` (`nowrap`); teste de `Room` |
| RF-603 Design System | `Button` (`secondary`, `sm`), `colors` e `radii` de `@mlab/ui` |
| RNF-601 semântica e ação mantidas | `role="status"`, mesmo texto, `toggleHand(false)` com `stopPropagation`; testes de `Room` e A15 |

## 2. Antes e depois (360 px de largura)

| | Antes | Depois |
|---|---|---|
| Largura do aviso | ~metade da área do vídeo | área do vídeo menos 16 px de cada lado |
| Texto | 5 linhas | 2 linhas |
| Botão "Abaixar Mão" | quebrado em 2 linhas | 1 linha |
| Ícone da mão | reduzido a um ponto | 16 px, visível |

Arquivos: `evidencias/antes-360px.png`, `evidencias/depois-360px.png`, `evidencias/depois-pixel7.png`.

## 3. Divergências

Nenhuma entre código e spec/plan desta feature. US-11, RF-301 e RN-301 da 003 inalterados.

## 4. Código sem requisito

Nenhum. Os `data-testid` do aviso servem aos testes da T601/T602.

## 5. Testes faltantes / limitações de verificação

- **Harness E2E:** o teste executado logo após o A13 às vezes falha na 1ª tentativa com `TargetClosedError` antes de
  qualquer passo (A14 no desktop, A15 no mobile nesta execução) e passa no retry. Já registrado em
  `../005-correcoes-smoke/converge.md` §5; não envolve o aviso.
- Confirmação em celular físico fica para o roteiro manual da matriz (A15, `docs/metrics/smoke-runbook.md`).

## 6. Novas tasks necessárias

Nenhuma nesta feature.

## 7. Resultado

- [ ] OPEN
- [x] CONVERGED — T601–T603 entregues e verificadas.
