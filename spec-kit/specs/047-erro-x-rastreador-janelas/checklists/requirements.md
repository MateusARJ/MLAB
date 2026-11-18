# Checklist de Requisitos: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4701 a RF-4703, RNF-4701 a RNF-4704) tem task.
- [x] Ambiguidades fechadas (C-4701 a C-4703): mecanismo, comportamento diante de erro, entrega e versão.
- [x] Evidência registrada: `nativeWindowTracker.ts` (sem `XSetErrorHandler` em `createLinuxX11Tracker`),
  `x11InputShape.ts` (handler temporário da T911), `cursorPresence.ts` (consultas a cada 16 ms), log da 009
  (`evidencias/t910-ubuntu-testes.log`, `BadWindow` em `X_QueryTree`).
- [x] Edge cases de XID `0` e de erro entregue fora da consulta cobertos (spec §9).

## Coerência

- [x] RF-4703 preserva a 009/T911; a suíte da T911 fica na lista de paths proibidos para não ser ajustada.
- [x] Nenhum contrato muda; PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `470x` não colidem (busca por `RF-47`, `C-47`, `T47` sem resultado).

## Viabilidade

- [x] O `koffi` simulado da T911 (`x11InputShape.test.ts`) mostra como simular `XSetErrorHandler`, `XSync` e a
  entrega do erro ao handler instalado.
- [x] O WSL desta máquina tem XWayland (WSLg, `DISPLAY=:0`), onde a #139 foi reproduzida na 009/T905.

## Resultado

APPROVED
