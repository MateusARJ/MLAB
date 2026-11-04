# Checklist de Requisitos: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-901 a RF-904, RNF-901, RNF-902) tem task.
- [x] Ambiguidades fechadas (C-901, C-902, C-903).
- [x] Causa do defeito registrada com evidência no código (C-901: `forward` sem efeito no Linux; C-902: recusa de
  atalho silenciosa e overlay sem foco).

## Coerência

- [x] Regras de anotação da 003 (US-19, RF-309) inalteradas (RN-901); duplo `Ctrl` segue exclusivo do Windows.
- [x] Windows e macOS mantêm `setIgnoreMouseEvents(true, { forward: true })` (RNF-901).
- [x] Contrato IPC novo (`annotation-overlay:toolbar-rect`) registrado na 003 e validado no main.
- [x] Nenhuma dependência nova; numeração 009 sem colisão com 007/008 de outras branches.

## Viabilidade

- [x] Hit-test em módulo puro, testável sem Electron; manager testável com `electron` mockado e
  `process.platform` trocado.
- [x] Verificação manual possível no WSLg (Ubuntu 26.04, XWayland); Ubuntu/GNOME real registrado como pendência se
  indisponível.

## Resultado

APPROVED
