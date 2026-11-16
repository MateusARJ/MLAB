# Checklist de Requisitos: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-191, RF-192, RNF-191) tem task.
- [x] Ambiguidades fechadas (C-191 a C-194), incluindo a escolha entre aceitar e rejeitar da issue #50.
- [x] Evidência registrada: regex e reprodução da issue, levantamento dos 126 cabeçalhos atuais.

## Coerência

- [x] Nenhum contrato muda.
- [x] Sem dependência nova e sem ADR.
- [x] Versão sem incremento, coerente com `docs/versionamento.md` §2.
- [x] Os demais gates do validador não mudam.

## Viabilidade

- [x] Python 3 disponível localmente (`py`).
- [x] 011 verificável sem tocar a `edicao/https-lan` (C-193).

## Resultado

APPROVED
