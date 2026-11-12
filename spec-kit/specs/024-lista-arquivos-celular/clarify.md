# Clarify: Lista de Arquivos do Celular na Altura da Gaveta

Feature: `024-lista-arquivos-celular`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-12, junto com o plano de correção das issues #65 e #68.

## C-2401 — Qual contêiner rola

- **Contexto:** hoje a moldura `mobileFilesContent` e a lista `filesList` têm `overflowY: auto`.
- **Opções:** (A) a lista rola e a moldura vira só moldura (`minHeight: 0`, sem `overflowY`); (B) a moldura rola e a
  lista cresce sem limite.
- **Resposta aprovada:** **A**. Mantém o marcador `files-end` dentro do contêiner que rola, como na gaveta do desktop,
  e a rolagem automática (RF-191) continua igual.
- **Impacto em spec:** RF-2401, RF-2403.

## C-2402 — Padding

- **Contexto:** a moldura tem padding 14px e a lista 12px, somando 26px nas bordas.
- **Resposta aprovada:** padding único de 14px na moldura; a lista do celular fica sem padding próprio. O espaçamento
  entre os itens (`gap: 10px`) continua.
- **Impacto em spec:** RF-2401.

## C-2403 — Faixa de IDs, ADR e impacto de versão

- **Faixa de IDs:** `US-240x`, `RF-240x`, `RNF-240x`, `C-240x` e `T240x`.
- **ADR:** não é necessária. Ajuste de layout sem mudança de arquitetura, contrato ou autorização.
- **Impacto de versão:** **PATCH**. Correção sem capacidade nova nem mudança de contrato (`docs/versionamento.md` §2,
  AGENTS §13).

## Resultado

CLOSED — C-2401 a C-2403 respondidas; nenhuma ambiguidade em aberto.
