# Clarify: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Status: CLOSED

Decisões tomadas com o dono do produto em 2026-11-01.

## C-501 — Comparação da matrícula

- **Contexto:** o web envia a matrícula em maiúsculas, mas o backend aceita minúsculas (`2025116tads0039`).
- **Resposta aprovada:** a comparação para a RN-04 ignora maiúsculas e minúsculas (`strings.EqualFold`), após trim.

## C-502 — Mensagem ao aluno derrubado por 4001

- **Resposta aprovada:** "Sua sessão foi aberta em outra aba ou dispositivo." O aluno volta para a tela de entrada,
  sem reconexão automática.

## C-503 — Aviso de rate limit

- **Resposta aprovada:** usa a `message` enviada pelo servidor; sem ela, "Você está enviando mensagens rápido demais.
  Aguarde alguns segundos.". Aparece acima do formulário do chat (público e privado) e some sozinho após 5 s ou ao
  ser fechado. Componente `Alert` de `@mlab/ui`.

## C-504 — Matrícula

- **Resposta aprovada:** a matrícula permanece como está (Nome + Matrícula, regex, claim e exibição). Nenhuma ADR
  nova: a RN-04 já está especificada e coberta pela ADR 0004 §2.1.C.

## C-505 — Pasta de métricas

- **Resposta aprovada:** `docs/metrics/` permanece no lugar.

## C-506 — Chat antes da conexão (issue #20)

- **Contexto:** `sendChatMessage` descarta a mensagem quando o WebSocket não está aberto, sem aviso.
- **Resposta aprovada (2026-11-02):** o campo e o botão "Enviar" do chat público e do privado ficam desabilitados
  enquanto o WebSocket da sala não estiver aberto (inclusive durante reconexão). O placeholder passa a
  "Conectando ao chat..." nesse período. O texto digitado é preservado. Sem fila de mensagens pendentes.

## Resultado

CLOSED — C-501 a C-506 respondidas; nenhuma ambiguidade em aberto.
