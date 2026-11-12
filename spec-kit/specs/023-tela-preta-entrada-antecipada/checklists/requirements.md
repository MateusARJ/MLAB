# Checklist de Requisitos: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Feature: `023-tela-preta-entrada-antecipada`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2301 a RF-2306, RNF-2301 a RNF-2303, RN-2301) tem task.
- [x] Ambiguidades fechadas (C-2301 a C-2305): semântica do hub, áudio tardio, `onunmute`, regra de reaproveitamento,
  ADR e versão.
- [x] Evidência registrada: leitura de `room.go`, `hub.go` e `useWebRTCSubscriber.ts` na `development` @ `c838fb4`, e
  teste Go temporário descrito na issue #54.
- [x] Edge cases cobertos: vídeo e áudio quase juntos, áudio antes do vídeo, professor sem áudio, reconexão e troca de
  fonte.

## Coerência

- [x] O contrato `signaling.md` não muda; o aluno recebe `session-state: waiting`, já previsto (RNF-2301).
- [x] A proteção de `4869fa5` contra assinatura duplicada continua valendo (RN-2301).
- [x] O hub não é tocado: o tratamento de erro de `CreateSubscriberOffer` já responde `waiting` (`hub.go`).
- [x] Os testes atuais que assinam sem track (`sfu_test.go`, `sfu_security_test.go`) estão nos Allowed Paths.
- [x] O teste de carga (`loadtest_test.go`) espera `onTrackReady` antes de assinar, então não é afetado.
- [x] Sem dependência nova e sem ADR (C-2305).
- [x] Versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `230x` não colidem com outras features.

## Viabilidade

- [x] Os testes do SFU preenchem `videoTrack`/`audioTrack` direto (padrão de `sfu_test.go`).
- [x] Os mocks de `RTCPeerConnection` do hook aceitam promessa controlada no `setRemoteDescription`.

## Resultado

APPROVED
