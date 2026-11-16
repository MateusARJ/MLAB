# Spec: Correções da Matriz de Smoke e Remoção de Legado

Status: READY-FOR-PLAN
Feature ID: `005-correcoes-smoke`
Origem: issues #18 (A19), #19 (A20), #20 e #6; falhas registradas em `docs/metrics/smoke-2026-11.md` e em
`004-smoke-regression/tasks.md` (T403, T406).

## 1. Objetivo

Fazer o produto cumprir dois requisitos já aprovados que a matriz de smoke mostrou não implementados, e remover
código legado sem uso. Um único comportamento novo foi acrescentado em 2026-11-02 (US-504, issue #20), achado
pelo E2E da matriz: o chat do aluno descartava mensagens enviadas antes do WebSocket abrir.

- **RN-04 (001):** "restrição de sessão única por aluno (`4001 Duplicate Session` se a mesma matrícula reconectar)".
- **001/plan.md §10b:** "O cliente exibe feedback visual ao receber `CHAT_RATE_LIMITED`".
- **Issue #6:** remover códigos de implementações antigas que não são mais usados.
- **Issue #20:** o chat do aluno fica desabilitado enquanto o WebSocket da sala não estiver aberto.

A identificação do aluno por Nome e Matrícula (RF-11, US-17) permanece **intacta**.

## 2. Escopo

### Incluído

- encerrar a sessão WebSocket anterior com close code `4001` quando o mesmo aluno (mesma matrícula ou mesmo token)
  abre uma nova sessão na sala;
- não contar a reentrada do mesmo aluno duas vezes no limite de participantes da sala;
- mensagem correta ao aluno cuja sessão foi encerrada por `4001`;
- aviso visual no web do aluno ao receber `CHAT_RATE_LIMITED`, sem desconectar;
- chat do aluno (público e privado) desabilitado até o WebSocket da sala abrir e durante reconexões;
- remoção de código, tipos, componentes e dependências sem consumidor.

### Não incluído

- qualquer mudança no fluxo da matrícula (campo, regex, claim `student_id`, payloads, exibição);
- SFU (`internal/webrtc`), persistência, CI;
- rotas de retrocompatibilidade `/sala/:slug` e atalhos legados Alt+Shift da anotação (ainda têm uso);
- mover ou excluir `docs/metrics/`.

## 3. Atores

Aluno (web), professor (desktop), responsável pelo produto.

## 4. User Stories

### US-501 — Sessão única por aluno
**Como** professor, **quero** que o mesmo aluno não apareça duas vezes na sala, **para** que a lista e a contagem
reflitam os alunos reais.
- Uma nova sessão do aluno com a mesma matrícula derruba a anterior com `4001 Duplicate Session`.
- Reconectar com o mesmo token derruba a conexão anterior com `4001`.
- O aluno derrubado vê que a sessão foi aberta em outra aba ou dispositivo, e não que a aula foi encerrada.

### US-502 — Aviso de limite do chat
**Como** aluno, **quero** ser avisado quando envio mensagens rápido demais, **para** saber por que elas não apareceram.
- O aviso aparece na área do chat e some sozinho; o aluno continua na sala.

### US-504 — Chat desabilitado até conectar
**Como** aluno, **quero** que o chat só aceite mensagens quando estiver conectado, **para** não perder o que escrevo.
- Enquanto o WebSocket da sala não está aberto, o campo e o botão "Enviar" ficam desabilitados, com indicação de que
  o chat está conectando (C-506).
- Ao abrir a conexão, o chat é habilitado; se a conexão cair, volta a ficar desabilitado até reconectar.
- O texto já digitado no campo é preservado.

### US-503 — Remoção de legado
**Como** desenvolvedor, **quero** remover o código que não é mais usado, **para** reduzir manutenção e confusão.

## 5. Requisitos

- RF-501: o hub encerra a conexão anterior com close code `4001` e motivo `Duplicate Session` quando um aluno se
  registra com a mesma matrícula (C-501) ou o mesmo `participant_id` de uma conexão ativa da sala.
- RF-502: a reentrada de um aluno com matrícula já registrada na sala substitui o registro anterior e não é barrada
  pelo limite de participantes.
- RF-503: o web do aluno, ao receber `4001`, não reconecta e exibe a mensagem de C-502.
- RF-504: o web do aluno, ao receber `error` com `CHAT_RATE_LIMITED`, exibe um aviso na área do chat (C-503), sem
  encerrar a conexão.
- RF-505: código sem consumidor listado no plan é removido sem mudança de comportamento.
- RF-506: o web do aluno desabilita o campo e o botão de envio do chat público e do privado enquanto o WebSocket
  da sala não estiver aberto, e os habilita quando a conexão abre (C-506).
- RNF-501: demais fechamentos de conexão mantêm o comportamento atual.

## 6. Regras de Negócio

- RN-501: a RN-04 da 001 vale como está; esta feature só a implementa.
- RN-502: um item de legado só é removido com evidência de que não tem consumidor (busca no repositório).

## 7. Critérios de Sucesso

- Smoke A19 e A20 (`npm run test:smoke -w @mlab/backend`, `npm run test:e2e -w @mlab/web`) passam.
- A14 e A20 do E2E passam sem depender de retry (RF-506).
- Suítes normais (`go test ./...`, `npx turbo run test`) e builds continuam verdes.
