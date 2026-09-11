# Contract: Media Session

Status: DRAFT

## Purpose

Definir a semântica da publicação e assinatura da tela do professor.

## Producer

Professor autorizado.

## Consumer

Alunos autorizados.

## Transport

WebRTC via SFU.

## Rules

- uma publicação de tela ativa por sala no escopo inicial;
- professor possui permissão de publish;
- aluno possui permissão de subscribe;
- servidor/SFU não deve exigir uma upstream individual do professor por aluno.

## Observability

Registrar, por sessão:

- role;
- publish/subscribe state;
- bitrate;
- FPS;
- RTT;
- packet loss;
- timestamps de conexão.
