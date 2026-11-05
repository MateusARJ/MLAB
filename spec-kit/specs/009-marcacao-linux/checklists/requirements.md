# Checklist de Requisitos: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-901 a RF-904, RNF-901, RNF-902) tem task.
- [x] Ambiguidades fechadas (C-901, C-902, C-903; C-904 aprovada em 2026-11-05 após spike).
- [x] Causa do defeito registrada com evidência no código (C-901: `forward` sem efeito no Linux; C-902: recusa de
  atalho silenciosa e overlay sem foco).

## Coerência

- [x] Regras de anotação da 003 (US-19, RF-309) inalteradas (RN-901); duplo `Ctrl` segue exclusivo do Windows.
- [x] Windows e macOS mantêm `setIgnoreMouseEvents(true, { forward: true })` (RNF-901).
- [x] Contrato IPC novo (`annotation-overlay:toolbar-rect`) registrado na 003 e validado no main.
- [x] Nenhuma dependência nova no `package.json`; `koffi` já existente; `libX11`/`libXext` já exigidas pelo
  Electron no Linux. Numeração 009 sem colisão com 007/008 de outras branches.
- [x] RF-901 e RNF-902 reescritos para a região de entrada X11 (C-904), com o hit-test por ponteiro como alternativa;
  evidência da falha em `evidencias/t905-wslg-hit-test.log`.

## Viabilidade

- [x] Hit-test e cálculo da região de entrada em módulo puro, testáveis sem Electron; `x11InputShape.ts` testável
  com `koffi` mockado; manager testável com `electron` mockado e
  `process.platform` trocado.
- [x] Verificação manual possível no WSLg (Ubuntu 26.04, XWayland); Ubuntu/GNOME real registrado como pendência se
  indisponível.

## Resultado

APPROVED
