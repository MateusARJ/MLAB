# Converge: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-06
Commit avaliado: `6bedc82`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-101 a C-103), `plan.md`, `tasks.md` (T101–T104)
- código em `apps/backend/internal/room/mdns.go`, `mdns_test.go`, `apps/backend/go.mod`
- suítes: `go vet ./...` e `go test ./...` no backend (6 pacotes verdes), `GOOS=linux go vet ./...`,
  `GOOS=darwin go build ./...`
- verificação manual: smoke A16 feito pelo responsável em 2026-11-06 com celulares de alunos

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-101 | `pion/mdns/v2` em `mdns.go` (`da62529`); `TestMDNSRespondeConsultaLegacyUnicast` falha com a v0.0.12 (`c7d1cf4`) e passa com a v2; A16: `mlab.local` abriu a sala no Chrome e no Safari de celulares de alunos |
| RF-102 | `TestMDNSServerLifecycleAndQuery` verde; `Resolve-DnsName mlab.local -Type A` no Windows devolveu o IP da Wi-Fi |
| RF-103 | subteste AAAA de `TestMDNSRespondeConsultaLegacyUnicast`; `mdns.Server` da v2 limita a A/AAAA e não responde A a pergunta AAAA |
| RNF-101 | `StartMDNSServer` mantém aviso em log e retorno de erro quando a 5353 falha; `handler.go` intocado |
| RN-101 | links e contratos sem mudança; `buildRoomLinks` e `handler.go` intocados (link por IP não reverificado no A16) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| `go.mod` | troca de `pion/mdns` | `go mod tidy` também atualizou `x/net` 0.35, `x/sys` 0.41, `pion/logging` 0.2.4 e passou `pion/rtp` a direta | previsto em Dependencies do plan; suíte completa verde |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Versão do Android e do iOS dos aparelhos do A16 não foi registrada (relato: "Chrome e Safari de alguns alunos").
- `docs/metrics/smoke-2026-11.md` ainda marca A16 como PENDENTE: atualizar na próxima rodada de smoke (path fora
  desta feature).

## 6. Novas tasks necessárias

- **Fora da 010 — dois professores na mesma rede:** o comportamento de RF-312 (003) não muda nesta feature. Cada
  backend anuncia `mlab.local` com o próprio IP, sem sondagem nem detecção de conflito (RFC 6762 §8); o celular
  fica com a resposta que chegar primeiro. O link com caminho (`/<sala>/<professor>/entrar`) que cair no backend
  errado mostra "sala não encontrada"; a raiz `mlab.local:8080/` redireciona para a sala ativa do backend que
  respondeu, ou seja, pode levar o aluno para a aula de outro professor. Exige feature própria (ex.: sondar o nome
  antes de anunciar e usar `mlab-<professor>.local`, já anunciado hoje, no link).

## 7. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.8.1 | Correção de capacidade existente (RF-312 da 003) e troca de dependência, sem requisito de produto novo, sem mudança de contrato nem de fluxo. |

## 8. Resultado

- [ ] OPEN — há gaps registrados acima com encaminhamento definido.
- [x] CONVERGED — requisitos da 010 atendidos e verificados; o item da seção 6 é anterior à 010 e fica para
  feature própria.
