# Contract: WebRTC Signaling + Chat

Status: READY
Feature: `001-screen-share-core`

## Purpose

Trocar mensagens de sinalização necessárias para estabelecer a sessão WebRTC e
distribuir mensagens de chat em tempo real para todos os participantes da sala.

## Producer / Consumer

Bidirecional entre navegador/Electron e backend de sinalização Go.

## Transport

WebSocket (WSS em produção). Authorization via JWT enviado no handshake inicial
(query param `?token=<jwt>` ou header `Sec-WebSocket-Protocol`).

---

## Mensagens de Sinalização WebRTC

### Cliente → Servidor

| Tipo | Payload | Descrição |
|---|---|---|
| `join` | `{ room_id, token }` | Participante entra na sala via WebSocket |
| `offer` | `{ sdp }` | Professor envia SDP offer para publicar |
| `answer` | `{ sdp }` | Aluno envia SDP answer para assinar |
| `ice-candidate` | `{ candidate }` | Candidato ICE do cliente |
| `publish-request` | `{}` | Professor solicita permissão para publicar tela+áudio |
| `subscribe-request` | `{ publisher_id }` | Aluno solicita assinatura da track do professor |

### Servidor → Cliente

| Tipo | Payload | Descrição |
|---|---|---|
| `offer` | `{ sdp }` | Servidor envia SDP offer ao assinante |
| `answer` | `{ sdp }` | Servidor confirma offer do publicador |
| `ice-candidate` | `{ candidate }` | Candidato ICE do servidor/SFU |
| `session-state` | `{ status, participants_count }` | Estado atual da sala |
| `publish-approved` | `{ publisher_id }` | Professor autorizado a publicar |
| `participant-joined` | `{ participant_id, name, role }` | Novo participante entrou |
| `participant-left` | `{ participant_id }` | Participante saiu |
| `room-closed` | `{}` | Sala encerrada pelo professor |
| `error` | `{ code, message }` | Erro de sinalização ou autorização |

---

## Mensagens de Chat

### Cliente → Servidor

| Tipo | Payload | Descrição |
|---|---|---|
| `chat-message` | `{ content: string }` | Participante envia mensagem de texto |

### Servidor → Todos os Clientes da Sala

| Tipo | Payload | Descrição |
|---|---|---|
| `chat-message` | `{ message_id, participant_id, name, role, content, sent_at }` | Mensagem distribuída para a sala |

**Regras do chat:**
- `content` não pode ser vazio; o servidor descarta mensagens em branco.
- `sent_at` é gerado pelo servidor; o cliente nunca define o timestamp.
- O servidor valida o JWT antes de aceitar qualquer mensagem de chat.
- Mensagens não são entregues a participantes que se conectaram depois sem histórico (histórico via REST é definido no plan).

---

## IceServers (TURN/STUN)

O servidor inclui a configuração de ICE na resposta ao `join` ou em mensagem dedicada:

```json
{
  "type": "ice-servers",
  "payload": {
    "ice_servers": [
      { "urls": ["stun:stun.servidor.com:3478"] },
      {
        "urls": ["turn:turn.servidor.com:3478"],
        "username": "<gerado pelo servidor>",
        "credential": "<gerado pelo servidor>"
      }
    ]
  }
}
```

Credenciais TURN são temporárias e geradas pelo backend; nunca hardcoded.

---

## Authorization

- O servidor valida room membership e papel (role) antes de aceitar operações protegidas.
- Somente `role: professor` e dono da sala pode emitir `publish-request`.
- `role: aluno` só pode emitir `subscribe-request` e `chat-message`.
- Qualquer tentativa de operação não autorizada resulta em mensagem `error` e pode encerrar a conexão.

## Compatibility

Qualquer alteração breaking (novo campo obrigatório, remoção de campo, mudança de tipo) exige atualização deste contrato, de `packages/types` e das tasks downstream.
