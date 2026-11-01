# Contract: WebRTC Signaling + Chat

Status: READY (revisado em 2026-11-01)
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
| `stream-pause` | `{ paused: boolean }` | Professor pausa ou retoma a transmissão (RF-20). Somente professor; outros recebem `error FORBIDDEN` |
| `request-keyframe` | `{}` | Publisher pede keyframe imediato à SFU após troca de fonte (RN-12) |
| `end-session` | `{}` | Professor encerra a transmissão e a sala pelo WebSocket (RF-15). Somente professor |

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
| `ice-servers` | `{ ice_servers: [{ urls, username?, credential? }] }` | Configuração ICE (ver seção IceServers) |
| `stream-paused` | `{ paused: boolean }` | Broadcast: transmissão pausada ou retomada |
| `stream-started` | `{ publisher_id }` | Broadcast: mídia do professor pronta para assinatura |
| `participants-update` | `{ count, participants: [{ participant_id, name, student_id?, role, hand_raised, hand_raised_at? }] }` | Broadcast: lista atualizada de participantes (campos de mão em `003-classroom-interaction`) |
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
- Histórico, chat privado, fixação de mensagens e máscara de palavrões são definidos em `spec-kit/specs/003-classroom-interaction/contracts/signaling-classroom.md`.

---

## IceServers (TURN/STUN)

O servidor inclui a configuração de ICE na resposta ao `join` (apenas `urls`) e na mensagem dedicada `ice-servers`.
Pela ADR 0005, o TURN é opcional: sem TURN configurado, a lista contém apenas os servidores disponíveis na LAN.

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
- `role: aluno` só pode emitir `subscribe-request`, `answer`, `ice-candidate`, `chat-message` e as mensagens de interação definidas na feature 003.
- `stream-pause` e `end-session` são exclusivos do professor.
- Qualquer tentativa de operação não autorizada resulta em mensagem `error` e pode encerrar a conexão.

## Compatibility

Qualquer alteração breaking (novo campo obrigatório, remoção de campo, mudança de tipo) exige atualização deste contrato, de `packages/types` e das tasks downstream.
