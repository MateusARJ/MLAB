# Contract: Room API

Status: READY (revisado em 2026-11-01)
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

### POST /auth/session

Sessão do professor (pré-condição dos endpoints protegidos). Definido em `contracts/auth.md`.
Não existe login por e-mail e senha (ADR 0006).

---

### POST /rooms

Cria a sala do professor. Exclusivo para professor. Se o mesmo professor (`sub`) já tiver uma sala, ela é encerrada e
removida antes da criação da nova (RN-06).

**Authorization:** Bearer JWT (`role: professor`).

**Request:**
```json
{
  "title": "string (opcional)",
  "professor_name": "string (opcional; padrão: claim name)",
  "max_participants": 50
}
```

**Response 201:**
```json
{
  "room_id": "uuid",
  "slug": "{titulo-da-sala}/{nome-do-professor}",
  "link": "http://<host>/sala/{titulo}/{professor}",
  "ip_link": "string (opcional)",
  "mdns_link": "string (opcional, mlab.local)",
  "short_ip_link": "string (opcional)",
  "short_mdns_link": "string (opcional)",
  "status": "waiting",
  "created_at": "ISO8601"
}
```

- Título vazio gera o segmento `sala`; nome vazio gera `professor`.

**Errors:** `401 Unauthorized`, `403 Forbidden`.

---

### GET /rooms/{roomId}/link

Retorna o link único de acesso dos alunos para a sala. Exclusivo para professor.

**Authorization:** Bearer JWT (`role: professor`, dono da sala).

**Response 200:**
```json
{
  "room_id": "uuid",
  "link": "string",
  "ip_link": "string (opcional)",
  "mdns_link": "string (opcional)",
  "short_ip_link": "string (opcional)",
  "short_mdns_link": "string (opcional)"
}
```

**Errors:** `401`, `403`, `404 Room not found`.

---

### POST /rooms/{roomId}/join e POST /rooms/{sala}/{prof}/join

Aluno informa Nome e Matrícula e recebe um JWT de sessão. `{roomId}` aceita o UUID ou o slug; a forma
`/{sala}/{prof}` corresponde ao link fixo do professor.

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
  "room_status": "waiting | publishing",
  "room_id": "uuid (canônico)",
  "ws_url": "ws://<host>/ws/rooms/{room_id}/signal",
  "ice_servers": [{ "urls": ["string"] }],
  "professor_name": "string (opcional)",
  "room_title": "string (opcional)"
}
```

**Errors:**
- `400 Bad Request` — campos vazios ou inválidos (inclui matrícula fora do padrão — `003-classroom-interaction`, US-17).
- `404 Room not found` — slug/id inexistente.
- `409 Room closed` — sala já encerrada.
- `429 Participant limit reached` — sala cheia.

---

### GET /rooms/{roomId}/info e GET /rooms/{sala}/{prof}/info

Dados públicos da sala para a tela de entrada do aluno. Sem autenticação.

**Response 200:**
```json
{ "room_id": "uuid", "slug": "string", "title": "string", "professor_name": "string", "status": "waiting | publishing | reconnecting | closed" }
```

**Errors:** `404 Room not found`.

---

### GET /rooms/active

Sala ativa no servidor (usada pelo web app para redirecionar o aluno que abre a raiz `/`). Sem autenticação.
Prioridade: sala em `publishing`; depois a sala em `waiting` criada mais recentemente.

**Response 200:** `room_id`, `slug`, `title`, `professor_name`, `status`, `link`, `ip_link`, `mdns_link`, `short_ip_link`, `short_mdns_link`.

**Errors:** `404` — nenhuma sala ativa.

> A regra de prioridade passa a ser determinística com `002-security-hardening`/S5.

---

### Arquivos da sala

`POST /rooms/{roomId}/files`, `GET /rooms/{roomId}/files` e `GET /rooms/{roomId}/files/{fileId}/download` são
definidos em `spec-kit/specs/003-classroom-interaction/contracts/files.md`.

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
| `POST /rooms/{id}/join` (e `/{sala}/{prof}/join`) | ❌ | ✅ |
| `POST /rooms/{id}/close` | ✅ (dono) | ❌ |
| `GET /rooms/{id}/info` | público | público |
| `GET /rooms/active` | público | público |

## Compatibility

Mudanças de payload devem atualizar consumidores (`apps/desktop`, `apps/web`), `packages/types` e esta especificação.
