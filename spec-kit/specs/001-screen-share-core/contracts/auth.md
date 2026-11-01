# Contract: Auth

Status: READY (revisado em 2026-11-01 — ADR 0006)
Feature: `001-screen-share-core`

## Purpose

Definir o mecanismo de autenticação e os contratos de token para professor e aluno.

## Mecanismo

JWT HS256 assinado pelo backend. O segredo vem de `JWT_SECRET`; quando a variável não é fornecida, o backend gera
um segredo aleatório de 32 bytes a cada execução. Não existe valor fixo de fallback (ADR 0006).

Não existe login, conta ou senha de professor (ADR 0006).

## Tokens

### Token do Professor

Emitido por `POST /auth/session` mediante chave de host válida.

**Payload:**

```json
{
  "sub": "<professor_session_id>",
  "role": "professor",
  "email": "professor@mlab.local",
  "name": "<nome informado>",
  "exp": <unix_timestamp>,
  "iat": <unix_timestamp>
}
```

- `sub`: identificador aleatório gerado a cada sessão.
- `email`: valor fixo mantido por compatibilidade (fallback na derivação do slug do professor, RN-06). Não identifica uma conta.
- Validade: 8 horas (`PROFESSOR_TOKEN_TTL_H`).

### Token do Aluno

Emitido quando o aluno informa Nome e Matrícula ao entrar via link único.

**Payload:**

```json
{
  "sub": "<participant_id>",
  "role": "aluno",
  "name": "<nome_completo>",
  "student_id": "<matricula>",
  "room_id": "<room_id>",
  "exp": <unix_timestamp>,
  "iat": <unix_timestamp>
}
```

- Validade: 6 horas (`STUDENT_TOKEN_TTL_H`).
- Emitido em: `POST /rooms/{roomId}/join` e `POST /rooms/{sala}/{prof}/join` (ver `room-api.md`).

## Chave de host

- `MLAB_HOST_KEY`: 32 bytes aleatórios em hexadecimal, gerados pelo processo principal do app desktop a cada execução
  (ou por `scripts/dev.js` no modo de desenvolvimento do monorepo).
- Entregue ao backend por variável de ambiente e ao renderer do desktop pelo IPC `get-host-key` (ver `003-classroom-interaction/contracts/desktop-ipc.md`).
- Nunca é versionada, exibida na interface nem registrada em log.

## Regras de Autorização

- O servidor valida o JWT em toda requisição autenticada.
- `role: professor` pode: criar sala, encerrar sala, publicar mídia, obter link, enviar arquivos, fixar mensagens, enviar mensagem de chat.
- `role: aluno` pode: assinar mídia (subscribe), enviar mensagem de chat, levantar a mão, listar e baixar arquivos da própria sala.
- Aluno não pode publicar mídia nem acessar endpoints exclusivos do professor.
- Token expirado ou com assinatura inválida resulta em `401 Unauthorized`.
- Token de aluno com `room_id` diferente da sala solicitada resulta em `403 Forbidden`.

## Endpoints

### POST /auth/session (professor)

Headers:
```text
Content-Type: application/json
X-MLab-Host-Key: <MLAB_HOST_KEY>
```

Request:
```json
{ "name": "string" }
```

- `name` vazio ou ausente é tratado como `"Professor"`.

Response 200:
```json
{ "token": "string", "expires_at": "ISO8601", "name": "string" }
```

Errors:
- `403 Forbidden` — header `X-MLab-Host-Key` ausente ou diferente de `MLAB_HOST_KEY`, ou backend sem `MLAB_HOST_KEY` configurado.
- `500 Internal Server Error` — falha ao assinar o token.

> **Vigência:** em vigor desde `002-security-hardening`/S2 (T202).

### POST /auth/login

**Removido** (ADR 0006). Responde `404 Not Found` desde `002-security-hardening`/S3 (T203).

## Compatibility

Mudança de payload do JWT ou de mecanismo de assinatura exige ADR e atualização de todos os consumidores
(`apps/desktop`, `apps/web`, `packages/types`).
