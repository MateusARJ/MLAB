# Contract: Auth

Status: READY
Feature: `001-screen-share-core`

## Purpose

Definir o mecanismo de autenticação e os contratos de token para professor e aluno.

## Mecanismo

JWT (JSON Web Token) assinado pelo servidor com chave secreta (nunca hardcoded; lida de variável de ambiente).

## Tokens

### Token do Professor

Emitido após login com credenciais (e-mail + senha).

**Payload:**

```json
{
  "sub": "<professor_id>",
  "role": "professor",
  "email": "<email>",
  "exp": <unix_timestamp>,
  "iat": <unix_timestamp>
}
```

- Validade: 8 horas (configurável via ENV).
- Emitido em: `POST /auth/login`.

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

- Validade: duração da aula + 30 min de margem (configurável).
- Emitido em: `POST /rooms/{roomId}/join`.

## Regras de Autorização

- O servidor valida o JWT em toda requisição autenticada.
- `role: professor` pode: criar sala, encerrar sala, publicar mídia, gerar link único, enviar mensagem de chat.
- `role: aluno` pode: assinar mídia (subscribe), enviar mensagem de chat.
- Aluno não pode publicar mídia nem acessar endpoints exclusivos do professor.
- Token expirado ou com assinatura inválida resulta em `401 Unauthorized`.
- Token de aluno com `room_id` diferente da sala solicitada resulta em `403 Forbidden`.

## Endpoints

### POST /auth/login (professor)

Request:
```json
{ "email": "string", "password": "string" }
```

Response 200:
```json
{ "token": "string", "expires_at": "ISO8601" }
```

Errors: `400 Bad Request`, `401 Unauthorized`.

## Compatibility

Mudança de payload do JWT ou de mecanismo de assinatura exige ADR e atualização de todos os consumidores.
