# Tasks: HTTPS na LAN com CA local

Feature: `011-https-lan`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE (edição isolada; sem merge na development)

Regra de cada task: os testes do pacote afetado ficam verdes e `npx turbo run test --force` fica verde antes do `[x]`.

### T1101 — Pacote `tlsca`: CA local e emissão sob demanda
[x] T1101
Allowed Paths: `apps/backend/internal/tlsca/**`, `.gitignore`
Prohibited Paths: `apps/backend/internal/room/**`, `apps/backend/internal/signaling/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] `LoadOrCreate` cria e reaproveita a CA; chave com 0600 (RF-1101, RNF-1102).
- [x] Name Constraints críticas; `x509.Verify` aceita IP privado, `mlab.local` e `localhost` e recusa `example.com` e IP público (RF-1101, RF-1102).
- [x] `GetCertificate` usa o SNI ou o IP local, guarda em cache e renova (RF-1102).
- [x] `tls/` no `.gitignore` (RNF-1103).

### T1102 — Listener HTTPS e rotas `/tls/*`
[x] T1102
Depends On: T1101
Allowed Paths: `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/tls_routes.go`, `apps/backend/cmd/server/tls_routes_test.go`, `spec-kit/specs/011-https-lan/contracts/tls.md`
Prohibited Paths: `apps/backend/internal/room/**`, `apps/backend/internal/signaling/**`, `apps/backend/internal/auth/**`, `apps/web/**`, `apps/desktop/**`
Checks:
- [x] `MLAB_TLS=1` sobe HTTPS em `WEB_TLS_PORT`, TLS ≥ 1.2, só HTTP/1.1 (RF-1103).
- [x] `/tls/info`, `/mlab-ca.crt` e `/tls/ok` conforme o contrato; `enabled: false` em dev (RF-1104, RF-1105).
- [x] Teste com `httptest` TLS e a CA no pool.

### T1103 — Página de instalação e redirecionamento no web
[x] T1103
Depends On: T1102
Allowed Paths: `apps/web/src/services/tls.ts`, `apps/web/src/services/tls.test.ts`, `apps/web/src/components/TlsGate.tsx`, `apps/web/src/components/TlsGate.test.tsx`, `apps/web/src/pages/CertInstall.tsx`, `apps/web/src/App.tsx`
Prohibited Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Join.tsx`, `apps/web/src/hooks/**`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] Em `http:` com `enabled`: redireciona quando `/tls/ok` responde; mostra a instalação quando falha (RF-1106).
- [x] Instalação por sistema, download, impressão digital, orientação "Manter" e botão "Continuar com HTTPS" (RF-1107).
- [x] Sem `enabled`, em `https:` ou com erro em `/tls/info`, o app segue como hoje.

### T1104 — Edição "MLab HTTPS" no desktop
[x] T1104
Depends On: T1102
Allowed Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/renderer/services/tls.ts`, `apps/desktop/src/renderer/pages/Dashboard.tsx`, `apps/desktop/package.json`
Prohibited Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] Backend embarcado com `MLAB_TLS=1` e `WEB_TLS_PORT=8443`; `AppUserModelId` da edição (RF-1109).
- [x] `build`: `productName` "MLab HTTPS", `appId` `com.mlab.classroom.https`, atalhos e nomes do NSIS e do Linux (RF-1109).
- [x] Cartão HTTPS no Dashboard com a impressão digital e "Exportar certificado" (RF-1108).

### T1105 — Documentação da edição
[x] T1105
Depends On: T1103, T1104
Allowed Paths: `docs/https-lan.md`, `AGENTS.md`, `spec-kit/docs/adrs/0008-https-na-lan-com-ca-local.md`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] Guia do professor e do aluno (instalação por sistema, TI/GPO, remoção, teste local).
- [x] ADR 0008 na lista do `AGENTS.md` §9, com o escopo da edição.

### T1106 — Verificação e converge
[x] T1106
Depends On: T1101, T1102, T1103, T1104, T1105
Allowed Paths: `spec-kit/specs/011-https-lan/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] `go test ./...`, `npx turbo run test --force`, `npm run spec:check`.
- [x] Teste local: backend com o build do web e `MLAB_TLS=1`; página de instalação por HTTP; HTTPS com a CA no pool.
- [x] `converge.md` com gaps e versão.
