# Clarify: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Feature: `023-tela-preta-entrada-antecipada`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-12, junto com o plano de correção da issue #54.

## C-2301 — Quando o hub anuncia `publishing`

- **Contexto:** a issue #54 propõe avaliar se o `session-state: publishing` deve sair só no `onStreamStarted`, e não
  no `publish-request` nem no registro do WebSocket do professor.
- **Opções:**
  - (A) manter o hub como está e corrigir na SFU: sem track, `ErrMediaNotReady` → `waiting` ao aluno;
  - (B) mover o `publishing` para o `onStreamStarted`.
- **Resposta aprovada:** **A**. Com a correção da SFU, a assinatura antecipada é inofensiva: o aluno volta a ver a
  espera e o `stream-started` o leva à transmissão. A opção B muda a semântica do RF-07 e do contrato `signaling.md`
  (o desktop e a reconexão também leem esse estado) e exigiria nível MINOR ou MAJOR.
- **Impacto em spec:** RF-2302, RNF-2301.

## C-2302 — Áudio que chega depois do vídeo

- **Contexto:** o áudio é opcional no desktop, então a SFU não pode esperar sempre pelas duas tracks.
- **Opções:** (A) reemitir `onTrackReady` quando o áudio é criado depois do vídeo; (B) renegociar na SFU com cada
  aluno; (C) esperar o áudio por um tempo fixo.
- **Resposta aprovada:** **A**. Reaproveita o `stream-started` existente, sem mensagem nova, e a regra de geração de
  tracks (RF-2303) impede que a nova assinatura receba a oferta antiga. A opção B exigiria uma renegociação iniciada
  pelo servidor, que o contrato não prevê. A opção C atrasaria a entrada.
- **Impacto em spec:** RF-2304.

## C-2303 — Esconder o vídeo até chegarem quadros

- **Contexto:** a issue sugere não marcar "conectado" nem mostrar o `<video>` até a track receber quadros
  (`track.onunmute`).
- **Resposta aprovada:** fora do escopo. Com a SFU corrigida, a oferta sempre traz a track real. A mudança afetaria a
  UI e os testes de exibição sem resolver a causa.
- **Impacto em spec:** §3 (Não incluído).

## C-2304 — Regra de reaproveitamento da oferta pendente

- **Contexto:** o reaproveitamento existe desde `4869fa5` para evitar `InvalidModificationError` com
  `subscribe-request` duplicado. Recriar a oferta sempre traria esse problema de volta.
- **Resposta aprovada:** contador de geração de tracks na sala (`trackGen`), incrementado ao criar a track local de
  vídeo ou de áudio, e geração gravada por aluno quando a oferta é criada. Só reaproveita quando as gerações são
  iguais. A oferta reaproveitada passa pela mesma inserção das linhas de banda.
- **Impacto em spec:** RF-2303, RN-2301.

## C-2305 — Faixa de IDs, ADR e impacto de versão

- **Faixa de IDs:** `US-230x`, `RF-230x`, `RNF-230x`, `RN-230x`, `C-230x` e `T230x`.
- **ADR:** não é necessária. Não troca SFU nem stack WebRTC, não muda o contrato nem a autorização.
- **Impacto de versão:** **PATCH**. É uma correção sem mudança de capacidade nem de contrato
  (`docs/versionamento.md` §2, AGENTS §13).

## Resultado

CLOSED — C-2301 a C-2305 respondidas; nenhuma ambiguidade em aberto.
