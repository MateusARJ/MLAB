# Analyze: Bloqueio de Executáveis no Upload e Headers de Download

Feature: `022-bloqueio-executaveis-upload`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma.

- Spec, clarify (C-2201 a C-2207) e plan concordam:
  - bloqueio por extensão e por assinatura, com código-fonte liberado;
  - mapa fixo de `Content-Type`;
  - headers RFC 6266 com `nosniff`, CSP `sandbox` e `no-store`;
  - pré-validação só de extensão no desktop;
  - versão MINOR.
- A mensagem do 415 (C-2204) não cita "scripts", o que é coerente com C-2202.
- A faixa `220x` não colide com outras features: busca por `RF-220`, `C-220` e `T220` em `spec-kit/` e `docs/` só
  acha esta feature.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2201 | T2201 (contrato), T2202 (`isBlockedExtension` e 415), T2204 (curl) |
| RF-2202 | T2201, T2202 (`hasExecutableSignature` e 415), T2204 |
| RF-2203 | T2202 (teste de listagem sem o arquivo recusado) |
| RF-2204 | T2201, T2202 (`serverContentType` e teste com `Content-Type` falso) |
| RF-2205 | T2201, T2202 (`contentDisposition` e headers), T2204 (`curl -i`) |
| RF-2206 | T2203 |
| RF-2207 | T2203 |
| RNF-2201 | T2202 (regra no servidor) |
| RNF-2202 | T2201 (contrato só ganha o 415; payload igual) |
| RNF-2203 | todas: nenhuma dependência nova |
| RNF-2204 | T2202 (checagem por prefixo) |
| RN-2201 | T2202, T2203 (mesma lista e mensagem, testadas dos dois lados) |
| RN-2202 | T2202 (código-fonte aceito), T2204 (`.py` → 201) |

## 3. Contratos

- `003-classroom-interaction/contracts/files.md` muda na T2201, antes do código: 415, `content_type` do servidor e
  headers do download.
- `packages/types`, eventos `file-shared`/`files-history` e web: sem mudança.

## 4. Tarefas fora do Scope Lock

Nenhuma. Cada task toca só os Allowed Paths do plan; a T2205 só mexe em `package.json` via `npm run bump`.

## 5. Riscos

- Falso positivo de `MZ` em texto: aceito na spec (§9).
- Conflito de versão com o PR da 021: rebase e novo bump no PR que entrar depois.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2201.
