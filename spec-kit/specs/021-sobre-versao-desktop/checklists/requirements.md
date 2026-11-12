# Checklist de Requisitos: Versão e Informações do MLab no App Desktop

Feature: `021-sobre-versao-desktop`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2101 a RF-2107, RNF-2101 a RNF-2104, RN-2101) tem task.
- [x] Ambiguidades fechadas (C-2101 a C-2107): local, campos, descrição, copyright, fonte dos dados, web e versão.
- [x] Evidência registrada: estado do `package.json` e ausência de `app.getVersion()` na `development` @ `3010573`.
- [x] Estados e erros cobertos, inclusive a falha do IPC (RF-2107).

## Coerência

- [x] Canal novo registrado no contrato `desktop-ipc.md` e tipo em `packages/types`, como o contrato exige.
- [x] Renderer só usa `window.electronAPI` (AGENTS §6 e §8).
- [x] Versão única respeitada: nada de versão escrita à mão (ADR 0007).
- [x] Sem dependência nova e sem ADR: não muda autenticação, SFU, framework nem contrato global.
- [x] Versão MINOR, coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `210x` não colidem com outras features.

## Viabilidade

- [x] `app.getVersion()` e o `define` do electron-vite estão disponíveis nas versões instaladas.
- [x] O comportamento do `VersionInfo` foi conferido no `app-builder-lib` 24.13.3 instalado.

## Resultado

APPROVED
