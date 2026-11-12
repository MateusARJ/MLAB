# Converge: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Feature: `023-tela-preta-entrada-antecipada`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `1bc9a0b` (T2301), `92bef77` (T2302)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2301 a C-2305), `plan.md`, `tasks.md` (T2301 a T2304)
- contrato: `001-screen-share-core/contracts/signaling.md` (sem mudança)
- código: `apps/backend/internal/webrtc/room.go`; `apps/web/src/hooks/useWebRTCSubscriber.ts`
- suítes:
  - `go vet ./internal/webrtc/`, `go vet -tags loadtest ./internal/webrtc/` e `go test -count=1 ./...` em
    `apps/backend`; `gofmt -l` dos quatro arquivos Go alterados;
  - `npm run test -w apps/web` e `npm run lint` na raiz.
- verificação manual (T2303): professor no app desktop e aluno no navegador, na LAN, confirmada pelo responsável
  ("funcionando perfeitamente").
- `chrome://webrtc-internals` exportado pelo responsável num celular Android 10 (Chrome 157, 4 GB, 8 núcleos),
  assistindo pela web dos alunos. Só tem uma PeerConnection e duas amostras de estatística, de cerca de 1 s e 2 s
  depois da conexão.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2301 | T2301 + T2302; manual (T2303) sem F5. Dump: a oferta recebida tem `m=video` com `a=msid:mlab-stream video`, `m=audio` com `a=msid:mlab-stream audio` e `b=TIAS:6000000`; `ontrack` de vídeo e de áudio |
| RF-2302 | `TestRoom_SubscriberOffer_SemTrackDeVideo`; `TestSFUService_Lifecycle` (erro `ErrMediaNotReady` antes da track) |
| RF-2303 | `TestRoom_SubscriberOffer_TrackNovaDescartaOfertaPendente` (`m=audio`, `mlab-stream`, `b=AS`/`b=TIAS`, outro `ice-ufrag`, PC antiga fechada) |
| RF-2304 | `TestRoom_EnsureLocalTrack_ProntidaoDoAudio` (áudio depois e antes do vídeo, geração só ao criar track) |
| RF-2305 | teste "deve tratar stream-started só depois da answer da offer em andamento…" |
| RF-2306 | testes "não deve enviar answer de uma offer cuja PC foi descartada…" e "não deve repetir o candidato ICE numa PC descartada" |
| RNF-2301 | `hub.go`, `packages/types` e `signaling.md` intocados; o aluno recebe `session-state: waiting`, já previsto |
| RNF-2302 | manual (T2303). Dump: PeerConnection criada → `connected` em ~245 ms (`setRemoteDescription` ~11 ms depois de criada; ICE `connected` em ~168 ms) |
| RNF-2303 | nenhuma dependência nova |
| RN-2301 | `TestRoom_SubscriberOffer_DuplicadaMesmaGeracaoReaproveita`; `TestSFU_Security_DuplicateSubscriberEviction` |

Conferência dos testes: os três testes novos do hook falham contra o hook anterior (`git stash`) e passam com a
correção.

Totais:

- Backend: `go test -count=1 ./...` verde em todos os pacotes; `go vet` com e sem a tag `loadtest`.
- Web: 4 arquivos e 45 testes verdes.
- `npm run lint` na raiz: 5 de 5.

## 1.1 Métricas do dump (referência, AGENTS §7)

Janela curta, um aparelho só: os números descrevem a entrada, não uma aula. Não há afirmação de meta atingida.

| Métrica | Valor |
|---|---|
| Tempo de entrada (PC criada → `connected`) | ~245 ms |
| Vídeo | VP8, 1366×768, ~57 quadros/s recebidos, ~59 decodificados/s; decodificador de hardware (MediaCodec), ~9 ms por quadro |
| Bitrate recebido | ~1,3 Mbit/s |
| Perda de pacotes | 0 (vídeo e áudio); NACK 0; congelamentos 0 |
| RTT | 19 a 51 ms (par host↔host, Wi-Fi) |
| Jitter buffer | vídeo ~56–67 ms; áudio ~44 ms |
| Quadros descartados | 13, todos na largada (PLI 3), antes do primeiro quadro-chave; nenhum entre as duas amostras |
| Áudio | Opus, sem perda; nível próximo de silêncio no trecho |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- O §11 da spec e os checks da T2302 foram ajustados antes da implementação (`39cf5dc`): com a fila de RF-2305, o
  `stream-started` só é tratado depois da answer da offer em andamento.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| Bloco de vídeo em `createSubscriberOffer` virou `if sender, err := …` | `room.go` | só forma: com RF-2302 o vídeo sempre existe ali |

## 5. Testes faltantes

- Nenhum automatizado. Uma captura mais longa do `webrtc-internals` (60 s ou mais, com vários alunos) daria a
  métrica de estabilidade que esta janela de 2 s não mostra.

## 6. Novas tasks necessárias

- Nenhuma na 023.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

- O `gofmt -l` lista vários arquivos Go não tocados porque a cópia de trabalho no Windows está em CRLF; o índice está
  em LF e passa no gofmt. Não é desvio.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.14.1 | Correção sem capacidade nova nem mudança de contrato: as mensagens e a semântica de `signaling.md` continuam as mesmas (C-2305). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o aluno que entra antes do professor recebe vídeo e áudio sem F5: a SFU não oferta sem a track de
  vídeo, não reaproveita oferta criada com outras tracks e reavisa no áudio tardio; o hook trata a sinalização em
  ordem e descarta negociação obsoleta.
