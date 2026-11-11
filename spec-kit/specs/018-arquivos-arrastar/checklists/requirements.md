# Checklist de Requisitos: Arrastar Arquivos para a Aba Arquivos da Sala

Feature: `018-arquivos-arrastar`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-181 a RF-190, RNF-181 a RNF-185, RN-181, RN-182) tem task (ver `analyze.md` §2).
- [x] Os pontos em aberto da issue #46 estão fechados (C-181 a C-189): escopo, navegação, nome, pré-validação,
  pastas, drop durante envio, erro por item, botão/retorno, zona e versão.
- [x] Situação atual registrada com evidência no código: envio de um arquivo só (`Room.tsx:1382-1418`), HTTP dentro
  da página (`Room.tsx:1393`), UI da aba (`Room.tsx:2971-3015`), guard aceitando qualquer `file:`
  (`navigationGuard.ts:15`), limites e mensagens do servidor (`apps/backend/internal/room/files.go`).

## Coerência

- [x] A 003 (US-16) recebe só uma nota apontando para a 018; nada é reescrito.
- [x] Nenhum contrato muda: `003/contracts/files.md` é consumido como está; `packages/types` intacto.
- [x] Sem dependência nova e sem ADR: não muda stack, autenticação nem contrato global (AGENTS §9). O endurecimento
  do guard reforça o RNF-SEC-07 da 002 sem mudar a decisão.
- [x] O escopo retirado da issue (415/headers) é decisão explícita do responsável (C-181) e vira issue própria.
- [x] Mensagens de erro do app iguais às do servidor (`arquivo acima do limite de 50MB`).

## Viabilidade

- [x] Guard testável com o `fakeContents` já usado em `navigationGuard.test.ts`.
- [x] Service, hook, zona e `Room` testáveis com vitest + jsdom, `fetch` mockado e `DataTransfer` falso.
- [x] Gate de `tsc` definido apesar da #51: nenhum erro novo nos arquivos tocados.
- [x] Smoke manual possível com o instalador Windows e um celular na mesma rede (A13b).

## Resultado

APPROVED
