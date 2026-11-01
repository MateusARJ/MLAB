# Contract: Arquivos da Sala

Status: READY
Feature: `003-classroom-interaction`

## Producer / Consumer

- Producer: `apps/backend/internal/room/files.go`, `handler.go`.
- Consumers: `apps/desktop` (upload e listagem), `apps/web` (listagem e download).

## Armazenamento

Somente em memória, por sala (ADR 0005). Nada é gravado em disco pelo servidor.

---

## POST /rooms/{roomId}/files

Envia um arquivo para a turma.

- **Authorization:** Bearer JWT `role: professor`, dono da sala (`sub == owner_id`).
- **Body:** `multipart/form-data`, campo `file`.
- **Limite por arquivo:** 50 MB.

**Response 201:**
```json
{
  "id": "uuid",
  "room_id": "uuid",
  "name": "string",
  "size": 12345,
  "content_type": "string",
  "url": "/rooms/{roomId}/files/{fileId}/download",
  "uploaded_at": "ISO8601"
}
```

Efeito colateral: broadcast `file-shared` na sala (ver `signaling-classroom.md`).

**Errors:** `401`, `403` (não é professor ou não é dono), `404` (sala), `400` (campo `file` ausente ou corpo inválido),
`413` (arquivo acima do limite ou sala acima do teto), `500`.

---

## GET /rooms/{roomId}/files

Lista os arquivos da sala (mesmo formato do item acima, em array; sala sem arquivos → `[]`).

## GET /rooms/{roomId}/files/{fileId}/download

Baixa o arquivo.

- Headers de resposta: `Content-Type` do envio (ou `application/octet-stream`), `Content-Disposition: attachment; filename="<nome>"`.
- **Errors:** `404` (arquivo inexistente).

---

## Autorização da listagem e do download — em vigor desde `002-security-hardening`/S4 (T204)

- Token aceito em `Authorization: Bearer <jwt>` **ou** no parâmetro `?token=<jwt>` (mesmo padrão do WebSocket), para
  permitir links de download no navegador.
- Aluno: `room_id` do token igual à sala (UUID canônico; slug é resolvido para o UUID).
- Professor: dono da sala.
- Sem token ou token inválido → `401`; token de outra sala → `403`.
- Resposta de download inclui `X-Content-Type-Options: nosniff`.

## Limites por sala — em vigor desde `002-security-hardening`/S4 (T204)

- Teto de memória por sala: 300 MB (`MLAB_ROOM_FILES_MAX_MB`).
- Máximo de arquivos por sala: 50 (`MLAB_ROOM_FILES_MAX_COUNT`).
- Acima de qualquer limite → `413`.
- Os arquivos da sala são liberados da memória quando a sala é encerrada (REST `close`, substituição da sala pelo professor ou encerramento pelo WebSocket).


## Compatibility

Mudança de payload exige atualização deste contrato, de `packages/types` e dos consumidores.
