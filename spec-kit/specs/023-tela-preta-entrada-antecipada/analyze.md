# Analyze: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Feature: `023-tela-preta-entrada-antecipada`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma.

- Spec, clarify (C-2301 a C-2305) e plan concordam:
  - o hub não muda;
  - a SFU recusa assinar sem track de vídeo e reaproveita a oferta só na mesma geração de tracks;
  - o áudio tardio reemite a prontidão;
  - o hook web serializa a sinalização e descarta a negociação obsoleta;
  - versão PATCH.
- RF-2302 depende de o hub responder `waiting` a erro de `CreateSubscriberOffer`. Conferido em
  `apps/backend/internal/signaling/hub.go` (`onSubscribeRequest`), que fica fora do escopo e não precisa mudar.
- RF-2305 e RF-2306 não se sobrepõem. Com a fila, o `stream-started` nunca interrompe uma `offer` em andamento: a
  answer dela sai e só depois a PC é trocada. O descarte de RF-2306 cobre a troca de PC fora da fila (desmontagem,
  reconexão do WebSocket). O §11 da spec e os checks da T2302 foram revistos com esse entendimento antes da
  implementação.
- A faixa `230x` não colide: a busca por `RF-230`, `C-230` e `T230` em `spec-kit/` e `docs/` só acha esta feature.
  O `RF023` de `docs/requirements.md` é outro formato de ID (sem hífen).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2301 | T2301, T2302, T2303 (manual, 10 repetições) |
| RF-2302 | T2301 |
| RF-2303 | T2301 |
| RF-2304 | T2301 |
| RF-2305 | T2302 |
| RF-2306 | T2302 |
| RNF-2301 | T2301 (hub e contrato intocados) |
| RNF-2302 | T2303 |
| RNF-2303 | todas: nenhuma dependência nova |
| RN-2301 | T2301 (assinatura duplicada → mesma oferta) |

## 3. Contratos

- `001-screen-share-core/contracts/signaling.md`: sem mudança. `session-state: waiting` e `stream-started` são usados
  com a semântica já documentada.
- `packages/types` e o app desktop: sem mudança.

## 4. Tarefas fora do Scope Lock

Nenhuma. A T2301 toca só arquivos do pacote `webrtc` listados; a T2302 só o hook e seu teste; a T2304 só mexe em
`package.json` via `npm run bump`.

## 5. Riscos

- Dois `stream-started` seguidos: absorvidos pela fila e pelo descarte do hook.
- Testes antigos que assinavam sem track: ajustados na T2301, já que o comportamento antigo era o defeito.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2301.
