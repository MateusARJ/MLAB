# Plan: HTTPS na LAN com CA local

Feature: `011-https-lan`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-1101 a C-1106)
ADR: `spec-kit/docs/adrs/0008-https-na-lan-com-ca-local.md` (aprovada para a edição MLab HTTPS)

## 1. Summary

1. **`internal/tlsca` (RF-1101, RF-1102, RNF-1102):**
   - `LoadOrCreate(dir)` lê ou cria a CA (PEM; chave PKCS#8 com 0600) com Name Constraints críticas.
   - `(*CA).GetCertificate(*tls.ClientHelloInfo)` resolve o nome (SNI, ou IP de `hello.Conn.LocalAddr()`), valida
     contra as restrições e emite o certificado de servidor ECDSA com validade de 30 dias, em cache.
   - `Fingerprint()` devolve a impressão digital curta (8 bytes em 4 grupos) e `FingerprintSHA256()` a completa.
     `CertPEM()` devolve o certificado para download.
2. **Servidor (RF-1103 a RF-1105):**
   - `cmd/server/main.go` lê `MLAB_TLS`, `WEB_TLS_PORT` e `MLAB_TLS_DIR` (padrão `tls`).
   - Sobe um `http.Server` TLS com `GetCertificate`, `MinVersion` TLS 1.2 e `TLSNextProto` vazio (só HTTP/1.1, por
     causa do WebSocket).
   - As rotas `/tls/info`, `/tls/ok` e `/mlab-ca.crt` ficam em `cmd/server/tls_routes.go`, registradas em `newServer`
     por `serverConfig.TLS`.
3. **Web (RF-1106, RF-1107):**
   - `src/services/tls.ts`: `fetchTlsInfo`, `probeHttps`, `httpsUrlFor`.
   - `src/components/TlsGate.tsx` envolve as rotas em `App.tsx`.
   - `src/pages/CertInstall.tsx` mostra a instalação.
4. **Desktop (RF-1108, RF-1109):**
   - `main.ts` passa `MLAB_TLS=1` e `WEB_TLS_PORT=8443` ao backend embarcado e usa o `AppUserModelId` da edição.
   - `Dashboard.tsx` ganha o cartão "HTTPS na rede local", alimentado por `services/tls.ts`.
   - `package.json` (`build`) recebe a identidade "MLab HTTPS".
5. **Contrato:** `contracts/tls.md` (rotas novas e campos).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Algoritmo | ECDSA P-256 (CA e servidor), SHA-256 | RF-1101 |
| Validade | CA 10 anos; servidor 30 dias, renovado com < 1 dia | RF-1101, RF-1102 |
| Restrições | `PermittedDNSDomains` `local`, `localhost`; `PermittedIPRanges` privados, loopback, link-local e ULA; `PermittedDNSDomainsCritical` | RF-1101 |
| Nome sem SNI | IP local da conexão TLS | RF-1102 |
| HTTP/2 | desligado no listener TLS (WebSocket via gorilla exige HTTP/1.1) | RF-1103 |
| CORS de `/tls/ok` | o `corsMiddleware` existente já aceita origem do mesmo host em outra porta (`room.IsAllowedOrigin`) | RF-1104 |
| Fingerprint curta | primeiros 8 bytes do SHA-256 do DER, hex maiúsculo, 4 grupos de 4 | RF-1104 |
| Teste do aparelho | `fetch('https://host:port/tls/ok', {cache:'no-store'})` com timeout de 4 s | RF-1106 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Navegador ignorar Name Constraints | CA vira coringa | Chrome, Edge, Firefox e Apple aplicam as restrições do certificado raiz; teste Go com `x509.Verify` |
| iOS exigir validade ≤ 825 dias e `serverAuth` | certificado recusado | servidor com 30 dias e `ExtKeyUsageServerAuth` |
| Download da CA bloqueado por ser HTTP | aluno não instala | orientação "Manter" e impressão digital (RF-1107) |
| Porta 8443 bloqueada pelo firewall | teste falha e mostra a instalação | a regra de firewall do Windows é por programa (server.exe); registrar no converge |
| CA apagada (desinstalar com `deleteAppDataOnUninstall`) | alunos reinstalam | documentado na ADR |
| Laço de redirecionamento em dev | página não abre | `enabled: false` com DevWebPort (RF-1105) |

## Scope Lock

### IN

- CA local, listener HTTPS, rotas `/tls/*` e `/mlab-ca.crt`;
- página de instalação e redirecionamento no web;
- cartão HTTPS e identidade da edição no desktop;
- contrato, documentação e testes desta feature.

### OUT

- merge na `development`; fallback HTTP para o aluno;
- CA pública, ACME, domínio, túnel;
- mudanças em SFU, sinalização, autenticação e arquivos.

### Allowed Paths

- `apps/backend/internal/tlsca/**`
- `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/tls_routes.go`, `apps/backend/cmd/server/tls_routes_test.go`
- `apps/web/src/services/tls.ts`, `apps/web/src/services/tls.test.ts`
- `apps/web/src/components/TlsGate.tsx`, `apps/web/src/components/TlsGate.test.tsx`
- `apps/web/src/pages/CertInstall.tsx`, `apps/web/src/App.tsx`
- `apps/desktop/src/main/main.ts` (só o env do spawn e o `AppUserModelId`)
- `apps/desktop/src/renderer/services/tls.ts`, `apps/desktop/src/renderer/pages/Dashboard.tsx`
- `apps/desktop/package.json` (só `build`: identidade da edição)
- `.gitignore`
- `docs/https-lan.md`
- `spec-kit/docs/adrs/0008-https-na-lan-com-ca-local.md`, `AGENTS.md` (§9, lista de ADRs)
- `spec-kit/specs/011-https-lan/**`

### Prohibited Paths

- `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
- `apps/backend/internal/room/**` (nenhuma mudança de links nem de origens; C-1105)
- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Join.tsx`
- `packages/**`
- `**/package-lock.json` (nenhuma dependência nova)

### Dependencies

- Nenhuma nova. Go: `crypto/x509`, `crypto/ecdsa`, `crypto/tls`, `crypto/sha256`, `encoding/pem`. Web e desktop:
  `fetch`, React e `@mlab/ui`, que já existem.

### Non-Goals

- QR code de instalação;
- perfil `.mobileconfig` assinado para iOS;
- detectar se a CA foi removida do aparelho depois de instalada (o teste de confiança cobre).

## 4. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — autorização inalterada; as rotas novas são públicas e só expõem o certificado público e o status.
- [x] Princípio III — SFU intocada.
- [x] Princípio IV — sem meta de desempenho.
- [x] Princípio V — `contracts/tls.md` novo.
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — um pacote pequeno e testável; nenhuma abstração sem consumidor.
- [ ] Princípio VIII — converge ao final (T1106).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-06 | Opção B (CA local) aprovada para a edição MLab HTTPS | ADR 0008 |
| 2026-11-06 | Branch isolada `feat/https-lan`; PR #48 fechado sem merge | C-1102 |
| 2026-11-06 | Edição "MLab HTTPS" com `appId` próprio | C-1103 |
| 2026-11-06 | Botão "Continuar com HTTPS", sem fallback HTTP | C-1104 |
| 2026-11-06 | Link continua HTTP; página redireciona | C-1105 |
