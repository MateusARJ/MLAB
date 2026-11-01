# Contract: Signaling — Interação em Sala

Status: READY
Feature: `003-classroom-interaction`
Complementa: `spec-kit/specs/001-screen-share-core/contracts/signaling.md` (mesmo WebSocket `/ws/rooms/{roomId}/signal`,
mesmo envelope `{ "type": string, "payload": object }`).

## Producer / Consumer

- Producer/consumer servidor: `apps/backend/internal/signaling` (`message.go`, `hub.go`).
- Clientes: `apps/desktop` (professor) e `apps/web` (aluno).

## Cliente → Servidor

| Tipo | Payload | Quem pode | Regras |
|---|---|---|---|
| `chat-message` | `{ content, is_private?, target_id? }` | todos | `is_private=true`: aluno → professor(es); professor → `target_id`. Sanitização, máscara de palavrões e rate limit iguais ao chat público |
| `raise-hand` | `{ raised?: boolean }` (padrão `true`) | aluno | professor recebe `FORBIDDEN` |
| `lower-hand` | `{ participant_id? }` | professor (obrigatório `participant_id`) ou o próprio aluno (sem `participant_id`) | alvo inexistente ou não-aluno → `NOT_FOUND`; sem `participant_id` vindo do professor → `BAD_REQUEST` |
| `pin-message` | `{ message_id, pinned, is_private?, target_id? }` | professor | outros → `FORBIDDEN`; 4ª fixação no mesmo escopo → `PIN_LIMIT_REACHED`; payload inválido → `INVALID_PAYLOAD` |

## Servidor → Cliente

| Tipo | Payload | Destinatários |
|---|---|---|
| `chat-message` | `{ message_id, participant_id, name, role, student_id?, content, is_private, target_id?, sent_at, pinned? }` | público: todos; privado: remetente + destinatário(s) conforme regras acima |
| `chat-history` | `{ messages: [chat-message payload] }` | unicast ao conectar; só mensagens públicas, máx. 200 mais recentes |
| `hand-updated` | `{ participant_id, name, student_id?, raised, raised_at? }` | todos |
| `participants-update` | `{ count, participants: [{ participant_id, name, student_id?, role, hand_raised, hand_raised_at? }] }` | todos |
| `chat-message-pinned` | `{ message_id, pinned, is_private, target_id? }` | público: todos; privado: professor(es) e o aluno `target_id` |
| `file-shared` | `{ id, name, size, url }` | todos, a cada envio de arquivo |
| `files-history` | `{ files: [file-shared payload] }` | unicast ao conectar, se houver arquivos |

## Códigos de erro (mensagem `error`)

| Código | Situação |
|---|---|
| `FORBIDDEN` | papel sem permissão para a operação |
| `PIN_LIMIT_REACHED` | limite de 3 fixações por escopo |
| `NOT_FOUND` | aluno alvo de `lower-hand` inexistente |
| `BAD_REQUEST` | `lower-hand` do professor sem `participant_id` |
| `INVALID_PAYLOAD` | payload malformado |
| `CHAT_RATE_LIMITED` | definido na 001 (RN-15/RN-16) |

## Escopos de fixação

- Público: um escopo único por sala.
- Privado: um escopo por conversa, identificado pelo `target_id` do aluno.

## Compatibility

Mudança breaking exige atualização deste contrato, de `packages/types` e dos consumidores.
