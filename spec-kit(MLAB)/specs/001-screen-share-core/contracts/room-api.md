# Contract: Room API

Status: READY
Feature: `001-screen-share-core`

## Purpose

Criar, acessar e gerenciar salas. Gerar link único de acesso para alunos.

## Producer

Backend Go (`apps/backend`).

## Consumer

App desktop do professor (`apps/desktop`) e web app dos alunos (`apps/web`).

## Transport

HTTP/JSON. Authorization via Bearer JWT em todos os endpoints protegidos.

---

## Endpoints

### POST /auth/login

Autenticação do professor. Definido em `contracts/auth.md`.

---

### POST /rooms

Cria uma nova sala. Exclusivo para professor.

**Authorization:** Bearer JWT (`role: professor`).

**Request:**
```json
{
  "max_participants": 50
}
```

**Response 201:**
```json
{
  "room_id": "uuid",
  "slug": "string",
  "link": "https://<host>/sala/<slug>",
  "status": "waiting",
  "created_at": "ISO8601"
}
```

**Errors:** `401 Unauthorized`, `403 Forbidden`.

---

### GET /rooms/{roomId}/link

Retorna o link único de acesso dos alunos para a sala. Exclusivo para professor.

**Authorization:** Bearer JWT (`role: professor`, dono da sala).

**Response 200:**
```json
{
  "room_id": "uuid",
  "link": "https://<host>/sala/<slug>"
}
```

**Errors:** `401`, `403`, `404 Room not found`.

---

### POST /rooms/{roomId}/join

Aluno informa Nome e Matrícula e recebe um JWT de sessão.

**Authorization:** sem autenticação prévia (endpoint público do link único).

**Request:**
```json
{
  "name": "string (não vazio)",
  "student_id": "string (não vazio)"
}
```

**Response 200:**
```json
{
  "token": "string (JWT aluno)",
  "expires_at": "ISO8601",
  "participant_id": "uuid",
  "room_status": "waiting | publishing"
}
```

**Errors:**
- `400 Bad Request` — campos vazios ou inválidos.
- `404 Room not found` — slug/id inexistente.
- `409 Room closed` — sala já encerrada.
- `429 Participant limit reached` — sala cheia.

---

### POST /rooms/{roomId}/close

Encerra a sala. Exclusivo para professor dono da sala.

**Authorization:** Bearer JWT (`role: professor`, dono da sala).

**Response 200:**
```json
{ "status": "closed", "closed_at": "ISO8601" }
```

**Errors:** `401`, `403`, `404`.

---

## Authorization Summary

| Endpoint | Professor | Aluno |
|---|---|---|
| `POST /rooms` | ✅ | ❌ |
| `GET /rooms/{id}/link` | ✅ (dono) | ❌ |
| `POST /rooms/{id}/join` | ❌ | ✅ |
| `POST /rooms/{id}/close` | ✅ (dono) | ❌ |

## Compatibility

Mudanças de payload devem atualizar consumidores (`apps/desktop`, `apps/web`), `packages/types` e esta especificação.
