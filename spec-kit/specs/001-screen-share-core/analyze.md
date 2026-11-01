# Analyze: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Mode: READ-ONLY
Status: PASS

Reanálise de 2026-11-01 após o `converge.md`, revalidada após as emendas da fase F4. O PASS anterior (pós-T005) cobria só RF-01..RF-13 e RNF-01..RNF-07
e não considerava as tasks T022–T033 nem o código entregue depois delas.

## 1. Inconsistências

| # | Inconsistência | Resolução |
|---|---|---|
| I-01 | US-01/RF-12/RN-01 × sessão por nome | ✅ ADR 0006; spec, `contracts/auth.md`, RF012/RN001 reescritos |
| I-02 | RN-06 × slug fixo (T032) | ✅ RN-06 emendada |
| I-03 | RN-18 × `chat-history` | ✅ movida para 003 (RN-304) |
| I-04 | "Não incluído: upload de arquivos" × `files.go` | ✅ removido; coberto por 003/US-16 |
| I-05 | C-04 × LAN offline | ✅ ADR 0005; clarify anotado |
| I-06 | C-01/RNF-10 × estado em memória | ✅ ADR 0005; RNF-10 reescrito |
| I-07 | RNF-02/RNF-09 × perfis 60 fps | ✅ RNF-02/RNF-09 emendados |
| I-08 | contratos incompletos | ✅ `room-api.md`, `signaling.md` atualizados; interações em `003/contracts/` |
| I-09 | tasks sem `Prohibited Paths` | ✅ registrados retroativamente |
| I-10 | T014/T029 com arquivos apagados | ✅ anotadas (C2) |

Gaps de **implementação** (segurança, testes, medição) não são inconsistências entre artefatos: continuam em
`converge.md` (Status: OPEN) e serão fechados pela `002-security-hardening` e pela fase F6.

## 2. Cobertura de requisitos

Legenda: ✅ coberto por spec + task + evidência · ⚠️ parcial · ❌ divergente (ver §1)

| Requisito | Tasks | Status |
|---|---|---|
| RF-01, RF-02, RF-03 | T008, T010, T011 | ✅ |
| RF-04, RF-26, RF-27 | T016, T022–T024 | ✅ |
| RF-05, RF-06, RF-29 | T011, T026 | ✅ |
| RF-07 | T010 | ✅ |
| RF-08 | T021 | ⚠️ exposição contínua não verificada |
| RF-09, RF-16, RF-17 | T012 | ✅ |
| RF-10, RF-20 | T016, T023 | ✅ |
| RF-11 | T018, T030 | ✅ |
| RF-12 | T014 (removida), 002/S2–S3 | ✅ spec emendada; implementação da chave de host em 002/S2 |
| RF-13, RF-14, RF-15 | T009, T015 | ✅ |
| RF-18, RF-19 | T010, T019 | ✅ |
| RF-21, RF-22, RF-25 | T019, T031 | ✅ |
| RF-23 | T010 | ✅ (TURN opcional após ADR 0005) |
| RF-24 | T016, T029 (superseded) | ✅ reescrito para o fluxo atual |
| RF-28 | T025, T027 | ✅ |
| RNF-01, RNF-02, RNF-03, RNF-08, RNF-09, RNF-15 | T020, T021 | ⚠️ requisitos coerentes; medição a refazer em F6/R3 (Princípio IV) |
| RNF-04 | T021 | ⚠️ |
| RNF-05 | T008 | ⚠️ segredo JWT fixo → 002/S1 |
| RNF-06 | T017–T019 | ✅ |
| RNF-07 | T013 | ⚠️ macOS não verificado |
| RNF-10 | — | ✅ emendado (ADR 0005) |
| RNF-13, RNF-14, RNF-16, RNF-17 | T010, T011, T012 | ✅ |
| RNF-18 | T025 | ✅ |
| RN-01 | T008, 002/S2–S3 | ✅ emendada; implementação em 002 |
| RN-02 a RN-05, RN-07 a RN-17 | T008–T012, T018 | ✅ |
| RN-06 | T009, T032 | ✅ emendada |
| RN-18 | 003/T305 | ✅ movida para 003 |
| RN-19, RN-20 | T024, T025 | ✅ |

## 3. Contratos

| Contrato | Status |
|---|---|
| `contracts/auth.md` | ✅ READY (revisado) |
| `contracts/room-api.md` | ✅ READY (revisado) |
| `contracts/signaling.md` | ✅ READY (revisado) |
| `contracts/media-session.md` | ✅ READY |

## 4. Tarefas fora do Scope Lock

- Nenhuma task registrada está fora do Scope Lock.
- O código antes fora de task foi coberto pela feature 003 (T301–T312).

## 5. Riscos de segurança/performance

- `/auth/session` emite token de professor sem nenhuma verificação → 002/S2.
- `JWT_SECRET` com valor fixo de fallback no backend e no desktop → 002/S1.
- Credenciais semeadas `professor123` no backend → 002/S3.
- Listagem e download de arquivos sem autenticação; arquivos nunca liberados da memória → 002/S4.
- WebSocket aceita qualquer origem; CORS `*` → 002/S6.
- `request-keyframe` é aceito de qualquer participante, sem checagem de papel (achado de 2026-11-01, fora das tasks S1–S8 aprovadas; aguarda decisão do dono do produto).
- Metas de desempenho sem medição atual (Princípio IV) → F6/R3.

## 6. Resultado

- [ ] FAIL
- [x] PASS — artefatos consistentes após as emendas. Implementação de segurança segue em `002-security-hardening`;
  medições de desempenho em F6/R3.
