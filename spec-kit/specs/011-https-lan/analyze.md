# Analyze: HTTPS na LAN com CA local

Feature: `011-https-lan`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A ADR 0008 (aprovada para a edição isolada), a spec, o clarify (C-1101 a C-1106) e o plan concordam:
- CA local com Name Constraints;
- certificado de servidor sob demanda;
- listener 8443;
- link HTTP com redirecionamento;
- botão "Continuar com HTTPS" sem fallback HTTP;
- edição "MLab HTTPS" fora da `development`.

A numeração 011 não colide com 008, 009 ou 010 da `development`.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-1101 | T1101 |
| RF-1102 | T1101 |
| RF-1103 | T1102 |
| RF-1104 | T1102 |
| RF-1105 | T1102 |
| RF-1106 | T1103 |
| RF-1107 | T1103 |
| RF-1108 | T1104 |
| RF-1109 | T1104 |
| RNF-1101 | T1101–T1104 (sem dependência nova) |
| RNF-1102 | T1101 |
| RNF-1103 | T1101 |
| RN-1101 | T1103 (link inalterado) |
| RN-1102 | T1102 (mesmo roteador e middlewares) |

## 3. Contratos

Contrato novo `contracts/tls.md`. O contrato de salas da 003 não muda (o link continua HTTP).

## 4. Tarefas fora do Scope Lock

Nenhuma. `internal/room/**` ficou proibido: o `corsMiddleware` e o `IsAllowedOrigin` já aceitam a origem do mesmo host
em outra porta, e a mesma checagem vale para o WebSocket.

### Riscos

- Download da CA pelo HTTP pode ser avisado pelo navegador: orientação na página (RF-1107).
- Laço em dev: `enabled: false` (RF-1105).

### Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T1101.
