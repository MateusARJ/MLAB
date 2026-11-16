# Plan: Registro do Cliente antes da Leitura

Feature: `039-registro-antes-da-leitura`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3901 e C-3902)

## 1. Summary

```text
antes:  newClient → go writePump; go readPump ──┐ (readPump pode pôr a mensagem em inbound)
        serveWS   → hub.register <- client  ────┴─ select do hub escolhe ao acaso → route descarta

depois: newClient → go writePump
        serveWS   → hub.register <- client → client.startReading() (go readPump) → ice-servers
```

1. `signaling/client.go`: `newClient` deixa de iniciar o `readPump`; novo `(*Client).startReading()`.
2. `signaling/handler.go`: `serveWS` chama `startReading()` logo depois de `hub.register <- client`.
3. `signaling/handler_register_test.go`: teste que segura o hub no registro do professor (pelo listener de status) e
   exige a resposta ao `subscribe-request` que o aluno envia logo depois do `Dial`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Ordem | `register` síncrono, depois `readPump` | C-3901 |
| Cliente recusado | o `readPump` também começa; termina com a conexão e o `unregister` é ignorado | RF-3902 |
| Mensagens do registro | ordem inalterada; `ice-servers` depois do registro | RF-3903 |
| Teste determinístico | listener de status prende a goroutine do hub; o aluno envia a mensagem nesse intervalo | spec §11 |
| Versão | PATCH via `npm run bump -- patch` | C-3902 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Handler esperar o hub ocupado antes de ler | leitura atrasa enquanto o hub processa | o hub não bloqueia por I/O; a mensagem fica no buffer do socket |
| `-race` não roda no Windows (sem cgo) | sem verificação local nativa | rodar no container Linux (`golang:1.26`) e no CI Linux do PR #26 |
| Esgotamento de portas efêmeras no Windows em repetições longas | falso negativo local do teste de ponta a ponta | repetições longas no container Linux |

## Scope Lock

### IN

- início do `readPump` no `Client` e no `serveWS`;
- teste novo do pacote `signaling`;
- incremento PATCH.

### OUT

- fila de mensagens no hub;
- término da goroutine do hub (#109);
- hub, SFU, web e desktop;
- persistência.

### Allowed Paths

- `apps/backend/internal/signaling/client.go`, `apps/backend/internal/signaling/handler.go`,
  `apps/backend/internal/signaling/handler_register_test.go`
- `spec-kit/specs/039-registro-antes-da-leitura/**`
- só na T3903, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/message.go`,
  `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**/src/**`
- `spec-kit/specs/001-screen-share-core/**`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib e `gorilla/websocket`, já usados.

### Non-Goals

- mudar a ordem das mensagens do registro;
- alterar o teste `TestServeWS_ConexaoDuranteEncerramento`.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada; sem P2P nem reencode.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: uma troca de ordem, um teste.
- [ ] Princípio VIII: converge ao final (T3902).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Iniciar o `readPump` depois do `register` em vez de enfileirar no hub | C-3901 |
| 2026-11-15 | Uma feature, um PR, IDs `390x`, PATCH | C-3902 |
