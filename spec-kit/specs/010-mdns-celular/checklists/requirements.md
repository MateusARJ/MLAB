# Checklist de Requisitos: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-101 a RF-103, RNF-101) tem task.
- [x] Ambiguidades fechadas (C-101 a C-103).
- [x] Causa do defeito registrada com evidência no código da biblioteca (C-101: resposta só multicast, ID 0, sem
  pergunta, sem filtro de tipo na `pion/mdns v0.0.12`).

## Coerência

- [x] RF-312 da 003 inalterado (RN-101); links e contratos sem mudança.
- [x] Dependência nova (`pion/mdns/v2`) registrada no Scope Lock; sem ADR porque não troca a stack WebRTC/SFU nem
  a infraestrutura (AGENTS §9). O plano B (responder nativo do SO) exige ADR e está fora.
- [x] Limites fora de escopo (Firefox, Android < 12, isolamento de AP) explícitos na spec.

## Viabilidade

- [x] Teste automatizado possível com socket UDP local, com `t.Skip` quando o ambiente não tiver multicast.
- [x] Verificação manual possível com um Android 12+ na mesma Wi-Fi do professor.

## Resultado

APPROVED
