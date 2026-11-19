# Checklist de Requisitos: Reação do App à Queda do Backend

Feature: `053-reacao-queda-backend`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-5301 a RF-5307, RNF-5301 a RNF-5305) tem task.
- [x] Ambiguidades fechadas (C-5301 a C-5304): retomada, detecção, limite e entrega.
- [x] Evidência registrada: logs do relato (saída com código 2; processo travado) e código atual do `BackendManager`.
- [x] Edge cases cobertos: queda no encerramento, porta ocupada pelo travado, dashboard, gravação local, queda na
  partida.
- [x] Contrato do canal novo em `contracts/ipc-backend-status.md`.

## Coerência

- [x] 034 (encerramento): `stop()`/`forceKillSync()` marcam `stopping` e impedem reinício (RNF-5305).
- [x] ADR 0005 (estado em memória): a spec não promete recuperar chat, arquivos ou presença.
- [x] ADR 0006 (sessão por nome e chave de host): renovação com a mesma chave via IPC.
- [x] 052: independente; a 052 tira a causa conhecida, a 053 cobre qualquer queda.
- [x] MINOR coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `530x` não colidem.

## Viabilidade

- [x] `BackendManager` já tem as dependências injetadas (`fetchHealth`, `sleep`, `now`) para testar sem processo
  real.
- [x] `startPublishing` fecha a conexão anterior; o token é lido do `sessionStorage` a cada render do `Room`.

## Resultado

APPROVED
