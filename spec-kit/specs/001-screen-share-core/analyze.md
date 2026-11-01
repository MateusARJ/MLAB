# Analyze: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Mode: READ-ONLY
Status: FAIL

Reanálise de 2026-11-01 após o `converge.md`. O PASS anterior (pós-T005) cobria só RF-01..RF-13 e RNF-01..RNF-07
e não considerava as tasks T022–T033 nem o código entregue depois delas.

## 1. Inconsistências

| # | Inconsistência | Bloqueia? | Encaminhamento |
|---|---|---|---|
| I-01 | US-01/RF-12/RN-01 (login e-mail/senha) × código (sessão por nome, login descontinuado) | sim | ADR 0006 + emenda F4 |
| I-02 | RN-06 (slug aleatório) × T032 (slug fixo por professor) — T032 alterou comportamento sem emendar a spec (§11) | sim | emenda F4 |
| I-03 | RN-18 (sem histórico) × `chat-history` | sim | 003 |
| I-04 | Spec "Não incluído: upload de arquivos" × `room/files.go` | sim | 003 |
| I-05 | C-04 (TURN obrigatório) × operação LAN offline | sim | ADR 0005 |
| I-06 | C-01/RNF-10 (PostgreSQL) × estado em memória | sim | ADR 0005 |
| I-07 | RNF-02/RNF-09 × perfis 60 fps e REMB 8 Mbps | sim | emenda F4 |
| I-08 | `contracts/room-api.md` e `contracts/signaling.md` não cobrem rotas e mensagens existentes | sim | emenda F4 + contratos 003 |
| I-09 | Tasks T001–T005b, T006–T021, T030–T033 sem `Prohibited Paths:` (Princípio VI) | sim | emenda F4 (paths retroativos explícitos) |
| I-10 | T014/T029 `[x]` com arquivos apagados | não | anotadas em C2 |

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
| RF-12 | T014 (removida) | ❌ I-01 |
| RF-13, RF-14, RF-15 | T009, T015 | ✅ |
| RF-18, RF-19 | T010, T019 | ✅ |
| RF-21, RF-22, RF-25 | T019, T031 | ✅ |
| RF-23 | T010 | ✅ (TURN opcional após ADR 0005) |
| RF-24 | T016, T029 (superseded) | ⚠️ reescrever para o fluxo atual |
| RF-28 | T025, T027 | ✅ |
| RNF-01, RNF-02, RNF-03, RNF-08, RNF-09, RNF-15 | T020, T021 | ⚠️ medição anterior a `29c54d0`/`1ed55d1`; RNF-02/09 ❌ I-07 |
| RNF-04 | T021 | ⚠️ |
| RNF-05 | T008 | ⚠️ segredo JWT fixo → 002/S1 |
| RNF-06 | T017–T019 | ✅ |
| RNF-07 | T013 | ⚠️ macOS não verificado |
| RNF-10 | — | ❌ I-06 |
| RNF-13, RNF-14, RNF-16, RNF-17 | T010, T011, T012 | ✅ |
| RNF-18 | T025 | ✅ |
| RN-01 | T008, T014 | ❌ I-01 |
| RN-02 a RN-05, RN-07 a RN-17 | T008–T012, T018 | ✅ |
| RN-06 | T009, T032 | ❌ I-02 |
| RN-18 | — | ❌ I-03 |
| RN-19, RN-20 | T024, T025 | ✅ |

## 3. Contratos

| Contrato | Status |
|---|---|
| `contracts/auth.md` | ❌ descreve `POST /auth/login`; não descreve `POST /auth/session` |
| `contracts/room-api.md` | ❌ incompleto (I-08) |
| `contracts/signaling.md` | ❌ incompleto (I-08) |
| `contracts/media-session.md` | ✅ READY |

## 4. Tarefas fora do Scope Lock

- Nenhuma task registrada está fora do Scope Lock.
- Há código fora de qualquer task (ver `converge.md` §4) — encaminhado para a feature 003.

## 5. Riscos de segurança/performance

- `/auth/session` emite token de professor sem nenhuma verificação → 002/S2.
- `JWT_SECRET` com valor fixo de fallback no backend e no desktop → 002/S1.
- Credenciais semeadas `professor123` no backend → 002/S3.
- Listagem e download de arquivos sem autenticação; arquivos nunca liberados da memória → 002/S4.
- WebSocket aceita qualquer origem; CORS `*` → 002/S6.
- Metas de desempenho sem medição atual (Princípio IV) → F6/R3.

## 6. Resultado

- [x] FAIL — corrigir upstream antes de novas implementações na 001.
- [ ] PASS

Volta a PASS quando I-01 a I-09 forem resolvidas pelas fases F3 e F4 do plano de remediação.
