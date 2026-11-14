# Checklist de Requisitos: Design System 2.0 com Tema Claro e Escuro

Feature: `028-design-system-2`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2801 a RF-2816, RNF-2801 a RNF-2805) tem task.
- [x] Ambiguidades fechadas (C-2801 a C-2809): base visual, o que não muda, rótulos, marca, amarelo, favicon, #89,
  ADR, versão.
- [x] Evidência registrada: leitura de `packages/ui/src`, das páginas do desktop e da web, de `apps/web/index.html`,
  `apps/web/src/favicon.test.ts` e da issue #89 na `development` @ `7bb2499`.
- [x] Edge cases cobertos: movimento reduzido, cache do favicon, janela que diminui, barra flutuante.

## Coerência

- [x] Os padrões 1080p 60 fps, sem gravação, mudo e `.webm` estão na spec como requisito (RF-2810), não só como
  estado atual do código.
- [x] A US-09 da 001 e os RF-2501/2503/2504 da 025 recebem nota de emenda antes do código (AGENTS §11).
- [x] Nenhum contrato muda; nenhuma ADR é exigida (C-2808).
- [x] A única mudança de lógica (RF-2815) tem task e teste próprios.
- [x] Dependências: uma entra, uma sai (RNF-2804).
- [x] Versão MAJOR decidida pelo responsável (C-2809).
- [x] IDs da faixa `28xx` não colidem com outras features.

## Viabilidade

- [x] O redesenho já foi construído e testado numa cópia local (308 testes no desktop e 51 na web verdes).
- [x] As mudanças do #88 nos arquivos da web se combinam sem conflito com o redesenho (merge de três vias conferido).
- [x] O Vite dos dois apps já importa CSS e arquivos de fonte de pacotes do workspace.

## Resultado

APPROVED
