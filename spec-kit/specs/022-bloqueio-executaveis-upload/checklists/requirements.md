# Checklist de Requisitos: Bloqueio de Executáveis no Upload e Headers de Download

Feature: `022-bloqueio-executaveis-upload`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2201 a RF-2207, RNF-2201 a RNF-2204, RN-2201, RN-2202) tem task.
- [x] Ambiguidades fechadas (C-2201 a C-2207): regra, lista, código-fonte, mapa de tipos, mensagem, headers,
  pré-validação, ADR e versão.
- [x] Evidência registrada: comportamento atual de `uploadFile`/`downloadFile` na `development` @ `3010573`.
- [x] Edge cases cobertos: sem extensão, extensão dupla, ponto/espaço final, `MZ` em texto, arquivo vazio, nome
  acentuado.

## Coerência

- [x] O contrato `files.md` da 003 é atualizado antes do código; payload e eventos não mudam (RNF-2202).
- [x] Decisão no servidor (AGENTS §8); o desktop só antecipa a mensagem.
- [x] Web dos alunos não depende de `content_type` (verificado em `apps/web/src`).
- [x] Sem dependência nova e sem ADR (C-2207).
- [x] Versão MINOR decidida pelo responsável, coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `220x` não colidem com outras features.

## Viabilidade

- [x] Fixture de testes `newFilesFixture` reutilizável; `multipart.Writer.CreatePart` permite o `Content-Type` falso.
- [x] Toda entrada de arquivo do desktop passa por `useRoomFileUploads.enqueue`.

## Resultado

APPROVED
