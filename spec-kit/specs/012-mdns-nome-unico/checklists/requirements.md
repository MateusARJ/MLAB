# Checklist de Requisitos: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-121 a RF-128, RNF-121 a RNF-123) tem task.
- [x] Ambiguidades fechadas (C-121 a C-127), incluindo os pontos de clarify das issues #37 e #39 (alias, sondagem,
  limite, estabilidade do nome, conflito tardio, aviso no desktop, campo novo).
- [x] Causa do defeito registrada com evidência no código: `mdns.go` anuncia sempre `mlab.local`; `handler.go`
  monta os links com `mlab.local` fixo e anuncia numa goroutine depois de montar os links.

## Coerência

- [x] RF-312 (003) e RF-101 (010) recebem nota apontando para a 012; nada é reescrito em silêncio.
- [x] Contrato: só a descrição de `mdns_link`/`link` muda em `001/contracts/room-api.md`; formato igual (RN-122).
- [x] Sem dependência nova e sem ADR: a stack mDNS continua `pion/mdns/v2` (AGENTS §9). O responder nativo do SO,
  que exigiria ADR, está fora.
- [x] `origin.go` já aceita `mlab-*.local`, o que cobre `mlab-N.local`; fica proibido no Scope Lock.

## Viabilidade

- [x] Teste automatizado com responder falso na mesma máquina (dois sockets 5353 com SO_REUSEADDR), com `t.Skip`
  sem multicast, como na 010.
- [x] Lógica de escolha e desempate testável sem rede (prober falso).
- [x] Desktop testável com vitest e timers falsos.
- [x] Verificação manual possível com dois PCs na mesma Wi-Fi e um Android 12+.

## Resultado

APPROVED
