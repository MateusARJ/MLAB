# Checklist de Requisitos: HTTPS na LAN com CA local

Feature: `011-https-lan`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-1101 a RF-1109, RNF-1101 a RNF-1103) tem task.
- [x] Ambiguidades fechadas (C-1101 a C-1106).
- [x] Causa do defeito registrada com evidência no código (servidor só HTTP, `main.go`).
- [x] ADR 0008 aprovada, com escopo limitado à edição isolada.

## Coerência

- [x] Nada é mergeado na `development` (C-1102); o MLab principal não muda.
- [x] Autorização inalterada nos dois listeners (RN-1102).
- [x] Contrato novo em `contracts/tls.md`; o contrato da 003 não muda (o link continua HTTP — C-1105).
- [x] Nenhuma dependência nova (RNF-1101).

## Viabilidade

- [x] CA e emissão testáveis com `x509.Verify` e `httptest`, sem rede real.
- [x] Página de instalação testável com `fetch` mockado.
- [x] Teste manual possível servindo o build do web com `MLAB_TLS=1`.

## Resultado

APPROVED
