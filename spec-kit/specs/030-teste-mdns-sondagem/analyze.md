# Analyze: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-3001 a C-3003) e plan concordam: correção só nos testes, aplicando o limite do RNF-121 à
sondagem do claim, sem mudar produção nem o requisito. A faixa `300x` não colide com outras features (verificado por
busca em `spec-kit/` e `docs/`).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3001 | T3001 |
| RF-3002 | T3001 |
| RNF-3001 | T3001, T3002 (produção, `go.mod` e `package.json` proibidos) |

## 3. Contratos

Nenhum muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3001 toca só `mdns_test.go` e `mdns_probe_test.go`; T3002 só `spec-kit/specs/030-teste-mdns-sondagem/**`.

## 5. Riscos

- Sondagem real acima de 1,5 s sob carga: o teste continua falhando (é violação do RNF-121), com os dois tempos no log.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3001.
