# Research: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: RESOLVED

## Perguntas respondidas

Todas as perguntas de pesquisa foram resolvidas e registradas formalmente em `clarify.md` (CLOSED).

| Pergunta | Decisão | Ref |
|---|---|---|
| SFU com Pion ou SFU pronto? | Pion WebRTC (Go) | C-03, clarify.md |
| TURN necessário? | Sim, obrigatório (coturn) | C-04, clarify.md |
| Autenticação da primeira versão? | JWT com Nome + Matrícula para aluno | C-01, contracts/auth.md |
| Limite operacional de participantes? | 50 por sala, configurável via ENV | C-02, clarify.md |
| Estrutura do repositório? | Monorepo Turborepo | C-05, ADR 0001 |
| Framework do app desktop? | Electron + React + TypeScript | C-06, ADR 0002 |

## Regra

Nenhuma conclusão deste documento pode substituir uma decisão formal em `clarify.md` ou ADR quando aplicável.
