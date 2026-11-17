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
  "mdns_link": "string (opcional; host mDNS anunciado: mlab.local, mlab-2.local ...)",
  "short_ip_link": "string (opcional)",
  "short_mdns_link": "string (opcional)",
  "status": "waiting",
  "created_at": "ISO8601"
}
```

- Título vazio gera o segmento `sala`; nome vazio gera `professor`.
- `mdns_link`/`short_mdns_link` usam o nome mDNS que o backend anuncia de fato, escolhido antes da resposta: o
  primeiro livre na rede entre `mlab.local`, `mlab-2.local` … `mlab-20.local` (012, RF-122/RF-123). Sem anúncio
  ativo, os dois campos não vêm e `link` é o link por IP; `NGROK_URL`/`PUBLIC_URL`/`BASE_URL` têm precedência em
  `link` (012, RF-126).

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

- Mesmas regras de `link`/`mdns_link` do `POST /rooms`, com o nome anunciado no momento da leitura: ele pode mudar
  durante a sessão quando o backend cede o nome num conflito (012, RF-125). O app desktop relê este endpoint a cada
  10 s (012, RF-128).

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
  "student_id": "string (7 números + 4 letras + 4 números; normalizada em maiúsculas — 046)"
}
```

**Response 200:**
```json
{
  "token": "string (JWT aluno)",
  "expires_at": "ISO8601",
  "participant_id": "uuid",
  "room_status": "waiting | publishing | reconnecting",
  "room_id": "uuid (canônico)",
  "ws_url": "ws://<host>/ws/rooms/{room_id}/signal",
  "ice_servers": [{ "urls": ["string"] }],
  "professor_name": "string (opcional)",
  "room_title": "string (opcional)"
}
```

**Errors:**
- `400 Bad Request` — campos vazios ou inválidos (inclui matrícula fora do padrão — `003-classroom-interaction`, US-17).
  O padrão é `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$` (ex.: `2025116TADS0000`); o servidor remove espaços nas pontas e grava a
  matrícula em maiúsculas antes de validar (`046-formato-matricula`, RF-4601, RF-4602).
- `404 Room not found` — slug/id inexistente.
- `409 Room closed` — sala já encerrada.
- `409 Student ID in use` — já há WebSocket ativo de um aluno com a mesma matrícula na sala (sem diferenciar
  maiúsculas). Corpo: `{"error": "Esta matrícula já está conectada nesta transmissão."}`. Tem precedência sobre o
  `429` (RN-04, ADR 0010, feature 027).
- `429 Participant limit reached` — sala cheia.

---

### GET /rooms/{roomId}/info e GET /rooms/{sala}/{prof}/info

Dados públicos da sala para a tela de entrada do aluno. Sem autenticação.

**Response 200:**
```json
{ "room_id": "uuid", "slug": "string", "title": "string", "professor_name": "string", "status": "waiting | publishing | reconnecting" }
```

**Errors:**
- `404 "sala não encontrada"` — sala inexistente ou já removida do store (encerrada pela REST `close` ou pelo hub).
- `404 "esta transmissão já foi encerrada"` — sala `closed` ainda presente no store.

> Sala encerrada nunca aparece no `200`: o encerramento a remove do store (033/RF-3303, C-3303).

---

### GET /rooms/active

Sala ativa no servidor (usada pelo web app para redirecionar o aluno que abre a raiz `/`). Sem autenticação.
Prioridade: `publishing` > `reconnecting` > `waiting`; entre salas do mesmo status vence a criada mais recentemente.

**Response 200:** `room_id`, `slug`, `title`, `professor_name`, `status`, `link`, `ip_link`, `mdns_link`, `short_ip_link`, `short_mdns_link`.

**Errors:** `404` — nenhuma sala ativa.

> Regra de prioridade determinística em vigor desde `002-security-hardening`/S5 (T205); `reconnecting` incluído na
> `035-status-sala-pelo-hub` (RF-3503, C-3502).

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
