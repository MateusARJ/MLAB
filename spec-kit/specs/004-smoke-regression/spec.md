# Spec: Matriz de Smoke de Regressão

Status: READY-FOR-PLAN
Feature ID: `004-smoke-regression`
Origem: Anexo A de `spec-kit/docs/plano-remediacao-speckit-seguranca.md`; pendência F0.3 de
`docs/metrics/baseline-2026-11.md`; bloqueio de merge registrado nos converges da 001 e da 002.

## 1. Objetivo

Tornar a matriz de smoke A0–A20 executável e repetível: automatizar os itens que não dependem de hardware
(backend por HTTP/WebSocket e web do aluno no navegador) e guiar a execução manual dos itens que dependem de
captura de tela, do app Electron empacotado e da rede física. O resultado de cada item fica registrado num
relatório único, com evidência.

Esta feature não altera comportamento do produto. Ela só acrescenta testes, um roteiro e um relatório.

## 2. Escopo

### Incluído

- smoke automatizado do backend contra o servidor real em memória (HTTP + WebSocket + mídia sintética);
- E2E automatizado do web do aluno em navegador real, em viewport desktop e mobile;
- roteiro manual guiado para os itens que exigem GUI do professor, app empacotado e rede física;
- relatório consolidado da matriz A0–A20 com resultado, modo de execução e evidência.

### Não incluído

- corrigir falhas encontradas pelo smoke (cada falha vira proposta de task na feature dona);
- automação do app Electron (captura, overlay, IPC);
- testes de carga (cobertos por `001/T034`);
- job de CI (C-406).

## 3. Atores

Responsável pelo produto (executa o roteiro e aprova), agente de IA (implementa e roda a parte automatizada).

## 4. User Stories

### US-401 — Smoke de backend em um comando
**Como** responsável, **quero** rodar um comando que valida pelo protocolo real os itens de servidor da matriz.
- Sobe o servidor completo em memória (mesma montagem do `main`), sem processo externo.
- Cada item da matriz coberto vira um subteste com o ID do item no nome.

### US-402 — E2E do aluno no navegador
**Como** responsável, **quero** ver o fluxo do aluno funcionando num navegador de verdade, no desktop e no mobile.
- O professor é simulado (sessão e sala pela API; transmissão por um publisher WebRTC no próprio navegador de teste).
- Cobre entrada, vídeo, autoplay, chat, mão levantada, arquivos, encerramento e reconexão.

### US-403 — Roteiro manual guiado
**Como** responsável, **quero** um passo a passo com critério de aprovação e evidência para os itens que só eu
consigo executar, usando o que tenho: celular e Linux/WSL.

### US-404 — Relatório único
**Como** responsável, **quero** um relatório A0–A20 que junte resultados automáticos e manuais, para decidir o merge.

## 5. Requisitos

- RF-401: o smoke de backend cobre A0, A3, A9 (API), A10 (protocolo), A13 (API), A14, A15, A18 (servidor), A19, A20
  e as verificações de segurança S2, S6 e S9.
- RF-402: o E2E cobre A3, A9, A10, A13, A14, A15, A18 (cliente) e A20 na interface do aluno, e A9/A10/A13 em mobile.
- RF-403: o roteiro cobre A1, A2, A4–A8, A11, A12, A16, A17 e a confirmação em celular real de A10/A13/A15.
- RF-404: o relatório lista os 21 itens com: resultado (OK / FALHA / N/E), modo (auto / manual), evidência.
- RNF-401: smoke e E2E ficam fora do `go test ./...` e do `turbo run test` diários (build tag / comando próprio).
- RNF-402: smoke de backend usa faixa UDP própria para não colidir com a suíte normal nem com o teste de carga.
- RNF-403: nenhuma alteração em código de produção, exceto a extração da montagem do servidor (C-402), sem mudança
  de comportamento.

## 6. Regras de Negócio

- RN-401: um item só é OK com evidência (saída de teste ou registro manual).
- RN-402: falha encontrada é registrada como está; não se ajusta o teste para passar.
- RN-403: item impossível no ambiente disponível é N/E com justificativa (ex.: A17 sem conta ngrok).

## 7. Critérios de Sucesso

- `npm run test:smoke -w @mlab/backend` e `npm run test:e2e -w @mlab/web` rodam do zero numa máquina com Go, Node e
  Chromium do Playwright.
- `npm run smoke` gera `docs/metrics/smoke-2026-11.md` com os 21 itens preenchidos.
- A suíte normal continua verde após a extração da montagem do servidor.
