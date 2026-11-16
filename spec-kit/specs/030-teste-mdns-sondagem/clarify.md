# Clarify: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Status: CLOSED

Decisão aprovada pelo responsável em 2026-11-14, com o plano de correção da issue #87.

## C-3001 — Qual intervalo o RNF-121 limita

- **Contexto:** o RNF-121 diz que "a sondagem acrescenta no máximo 1,5 s à criação da sala"; o teste mede o claim
  inteiro (socket, interfaces, sondagem e responder).
- **Resposta aprovada:** o limite vale só para a sondagem, como está escrito no requisito. O tempo total do claim é
  registrado, sem limite.

## C-3002 — Correções sugeridas na issue

- **Contexto:** a issue #87 sugere "medir só a sondagem, folga documentada, ou rodar o teste fora do paralelismo".
- **Alternativas:** (A) medir só a sondagem, injetando no teste um prober que cronometra o prober real por
  `newMDNSProber`; (B) aumentar o limite do teste; (C) serializar a execução do pacote.
- **Resposta aprovada:** **A**. (B) mudaria o que o teste verifica sem mudar o requisito; (C) esconderia a variação
  sem corrigir a medição e deixaria a suíte mais lenta. Commits `test(backend)`, sem incremento de versão
  (`docs/versionamento.md` §2).

## C-3003 — Corrida com o monitor de conflito

- **Contexto:** o claim entrega o mesmo prober ao monitor de conflito (`startMonitor`), que sonda de novo após 2 s, em
  outra goroutine, enquanto o teste ainda roda.
- **Resposta aprovada:** o cronômetro guarda só a primeira sondagem (a do claim), sob mutex.

## Resultado

CLOSED — C-3001 a C-3003 respondidas; nenhuma ambiguidade em aberto.
