# Spec: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Status: READY
Feature ID: `023-tela-preta-entrada-antecipada`
Origem: issue #54. Corrige o descumprimento do RF-07 da `001-screen-share-core` ("sem recarregar a página").

## 1. Objetivo

Fazer a transmissão aparecer sozinha para o aluno que abriu o link antes de o professor começar, sem tela preta e sem
precisar apertar F5. Entrar antes do professor é o fluxo normal de uma aula.

## 2. Contexto

Verificado em 2026-11-12 na `development` @ `c838fb4` (`room.go`, `hub.go` e `useWebRTCSubscriber.ts` iguais aos da
`2bb6461` citada na issue):

- O hub marca `publishing` no `publish-request` e no registro do WebSocket do professor, antes de a mídia existir na
  SFU. O aluno recebe `session-state: publishing` e envia `subscribe-request`.
- `Room.createSubscriberOffer` (`apps/backend/internal/webrtc/room.go`), sem `videoTrack`, adiciona um transceiver de
  vídeo `sendonly` vazio e devolve uma oferta sem mídia real e sem `m=audio`. O aluno responde, o ICE conecta (status
  "conectado") e nenhum pacote chega: tela preta.
- Quando a track fica pronta, o hub envia `stream-started` e o aluno assina de novo. Se a PC do aluno no servidor ainda
  está em `have-local-offer` (a answer da primeira oferta se perdeu), `createSubscriberOffer` **devolve a oferta
  antiga**, gerada sem as tracks. A tela fica preta para sempre. O reaproveitamento também perde as linhas `b=AS`/
  `b=TIAS`.
- A answer se perde porque `ws.onmessage` no hook é `async` e não serializa as mensagens. O `stream-started` fecha a
  PC enquanto a `offer` anterior ainda está em `setRemoteDescription`/`createAnswer`. O `createAnswer` falha e o erro
  é engolido.
- O `onTrackReady` só dispara no `OnTrack` de vídeo. Se o áudio chega depois, um aluno que assinou no intervalo fica
  sem áudio, e nada o faz renegociar ("às vezes sem áudio").
- O F5 resolve porque, na nova conexão, a `videoTrack` já existe e a PC antiga é descartada.

## 3. Escopo

### Incluído

- SFU: não ofertar ao aluno sem a track de vídeo do professor; não reaproveitar oferta pendente criada com outro
  conjunto de tracks; manter as linhas de banda na oferta reaproveitada; reemitir a prontidão quando o áudio chega
  depois do vídeo.
- Web dos alunos: processar as mensagens de sinalização em ordem e descartar o resultado de uma negociação cuja
  PeerConnection já foi substituída.

### Não incluído

- mudar quando o hub anuncia `publishing` (C-2301);
- esconder o `<video>` até a track receber quadros (`onunmute`) (C-2303);
- mudanças no app desktop, em `packages/types` e no contrato `001/contracts/signaling.md`.

## 4. Atores

- **Aluno:** entra na sala pelo navegador, antes ou depois de o professor transmitir.
- **Professor:** inicia a transmissão no app desktop, com ou sem áudio.

## 5. User Stories

### US-2301 — Transmissão aparece sem recarregar

Como aluno que entrou antes do professor, quero ver o vídeo e ouvir o áudio assim que o professor começar, sem apertar
F5.

- Dado que entrei com a sala em espera, quando o professor inicia a transmissão com áudio, então vejo o vídeo e ouço o
  áudio sem recarregar a página.
- Dado que entrei com a sala em espera, quando o professor inicia só com vídeo, então vejo o vídeo sem recarregar.
- Dado que a transmissão já está ativa, quando entro, então vejo o vídeo como hoje, sem demora adicional.

## 6. Requisitos Funcionais

- RF-2301: o aluno que entrou antes do início da transmissão passa a receber o vídeo, e o áudio quando houver, sem
  recarregar a página.
- RF-2302: a SFU não cria oferta de assinatura enquanto não existe a track de vídeo do professor. Nesse caso,
  `CreateSubscriberOffer` devolve o erro `ErrMediaNotReady`, e o hub, como já faz para qualquer erro dessa chamada,
  responde ao aluno `session-state: waiting`. O `stream-started` seguinte dispara a nova assinatura.
- RF-2303: a SFU só reaproveita a oferta pendente (`have-local-offer`) de um aluno quando ela foi criada com o mesmo
  conjunto de tracks que existe agora. Se uma track foi criada depois, a PeerConnection antiga é fechada e uma oferta
  nova é gerada. A oferta reaproveitada mantém as linhas `b=AS:6000`/`b=TIAS:6000000`.
- RF-2304: quando a track de áudio do professor é criada depois da de vídeo, a SFU sinaliza a prontidão de novo
  (`onTrackReady`), e o hub envia `stream-started`.
- RF-2305: o hook web processa as mensagens de sinalização uma de cada vez, na ordem de chegada.
- RF-2306: o hook web não envia answer nem aplica candidato ICE de uma PeerConnection que já foi substituída ou
  fechada enquanto a negociação aguardava.

## 7. Requisitos Não Funcionais

- RNF-2301 — compatibilidade: as mensagens, os payloads e a semântica do contrato `001/contracts/signaling.md` não
  mudam.
- RNF-2302 — desempenho: o tempo de entrada na sala de quem entra com a transmissão já ativa não piora (AGENTS §7).
  Nesse caso a oferta continua sendo criada na primeira assinatura.
- RNF-2303 — dependências: nenhuma dependência nova.

## 7.1 Regras de Negócio

- RN-2301: a proteção contra `subscribe-request` duplicado (`4869fa5`) continua valendo. Duas assinaturas sem answer
  no mesmo conjunto de tracks recebem a mesma oferta.

## 8. Estados e Erros

| Estado da SFU | Evento | Resultado |
|---|---|---|
| sem track de vídeo | `subscribe-request` | `ErrMediaNotReady` → `session-state: waiting` ao aluno (RF-2302) |
| track de vídeo pronta | `OnTrack` de vídeo | `stream-started` → nova assinatura com a oferta completa |
| oferta pendente, mesmas tracks | `subscribe-request` | mesma oferta, com as linhas de banda (RF-2303, RN-2301) |
| oferta pendente, tracks novas | `subscribe-request` | PC antiga fechada, oferta nova (RF-2303) |
| vídeo pronto, áudio criado depois | `OnTrack` de áudio | `stream-started` de novo (RF-2304) |

## 9. Edge Cases

- `OnTrack` de vídeo e de áudio quase juntos: podem sair dois `stream-started` seguidos. O aluno assina duas vezes, e
  a fila (RF-2305) e o descarte (RF-2306) garantem que só a última negociação vale.
- Áudio antes do vídeo: o `stream-started` do vídeo já leva as duas tracks. Não há segundo aviso.
- Professor sem áudio: só o aviso do vídeo.
- Professor reconectando (`reconnecting`) ou trocando a fonte: as tracks locais da sala são preservadas, então a
  oferta e o reaproveitamento seguem como hoje.

## 10. Dados/Contratos impactados

- Nenhum. `ErrMediaNotReady` é interno ao backend; o aluno continua recebendo `session-state: waiting`, que o contrato
  já prevê para essa situação.

## 11. Critérios de Sucesso

- Testes Go: assinatura antes da track → `ErrMediaNotReady`; oferta pendente criada antes de uma track nova não é
  reaproveitada, e a nova tem `m=video`, `m=audio` e `b=AS:6000`; assinatura duplicada sem track nova → mesma oferta,
  com `b=AS`; áudio depois do vídeo → `onTrackReady` de novo.
- Teste do hook: `stream-started` que chega enquanto uma `offer` está em `setRemoteDescription` só é processado
  depois de a answer dessa oferta sair; em seguida, a PC nova assina e responde à oferta seguinte (RF-2305). Uma PC
  substituída fora da fila (desmontagem do componente) não envia answer (RF-2306).
- Manual na LAN: aluno que entra antes do professor vê vídeo e ouve áudio sem F5 em 10 repetições seguidas; com a
  transmissão já ativa, a entrada continua imediata.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2301 a C-2305).
