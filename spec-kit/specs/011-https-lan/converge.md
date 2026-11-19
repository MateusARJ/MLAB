# Converge: HTTPS na LAN com CA local (edição MLab HTTPS)

Feature: `011-https-lan`
Data: 2026-11-06
Branch: `edicao/https-lan`. Edição isolada, **sem merge na `development`** (C-1102). PR #48 (ADR) fechado sem merge.
Issue: #47

## 1. O que foi entregue

| Requisito | Situação | Onde |
|---|---|---|
| RF-1101 CA local com Name Constraints | Atendido | `apps/backend/internal/tlsca/tlsca.go` |
| RF-1102 certificado de servidor sob demanda | Atendido (SNI ou IP local; 30 dias; cache e renovação) | `tlsca.go` (`GetCertificate`, `LeafFor`) |
| RF-1103 listener HTTPS | Atendido (`MLAB_TLS=1`, `WEB_TLS_PORT`, TLS ≥ 1.2, HTTP/1.1) | `cmd/server/main.go`, `cmd/server/tls_routes.go` |
| RF-1104 `/tls/info`, `/tls/ok`, `/mlab-ca.crt` | Atendido | `tls_routes.go` |
| RF-1105 `enabled: false` em dev | Atendido | `registerTLSRoutes(..., cfg.DevWebPort == "")` |
| RF-1106 redirecionamento/instalação no web | Atendido | `apps/web/src/components/TlsGate.tsx`, `services/tls.ts` |
| RF-1107 página de instalação | Atendido (sistema detectado, passo a passo, impressão digital, "Manter", "Continuar com HTTPS") | `apps/web/src/pages/CertInstall.tsx` |
| RF-1108 cartão HTTPS no Dashboard | Atendido (impressão digital e exportação) | `apps/desktop/src/renderer/pages/Dashboard.tsx`, `services/tls.ts` |
| RF-1109 identidade da edição | Atendido (`MLab HTTPS`, `com.mlab.classroom.https`, env do backend) | `apps/desktop/package.json`, `src/main/main.ts` |
| RNF-1101 sem dependência nova | Atendido | `package-lock.json` inalterado |
| RNF-1102 chave 0600, servidor só em memória | Atendido; a chave nunca é servida (teste) | `tlsca.go`, `tls_routes_test.go` |
| RNF-1103 `.gitignore` | Atendido (`mlab-ca.key`, `mlab-ca.crt`) | `.gitignore` |

## 2. Verificação

- `go test ./...` verde. `tlsca`:
  - Name Constraints críticas;
  - `x509.Verify` aceita IP privado, `mlab.local`, `mlab-<prof>.local` e `localhost`;
  - certificado para `example.com`, mesmo assinado à força pela CA, é recusado pelo verificador;
  - CA reaproveitada;
  - cache e renovação;
  - servidor TLS sem SNI.

  `cmd/server`:
  - rotas e headers;
  - `/tls/ok` só por HTTPS, com CORS para a origem HTTP;
  - HTTP/1.1 e TLS ≥ 1.2;
  - cliente sem a CA não confia.
- `go test -tags smoke ./cmd/server` verde. `npx turbo run test --force` 5/5 (web 48/48, desktop 143/143).
  `npm run spec:check` PASS.
- `tsc --noEmit`: web 0 erros; desktop 14 erros, todos já existentes (`main.ts:9`, `cursorMask.worker.ts`,
  `Room.tsx`, `Room.test.tsx`), nenhum em arquivo desta feature.
- **Ponta a ponta local** (binário do backend + build do web, `MLAB_TLS=1`, portas 18080/18443, IP 192.168.1.108):
  - `curl` com a CA (Schannel com `--ssl-no-revoke`):
    - `/tls/ok` responde por IP, `mlab.local`, `mlab-ana.local` e `localhost`;
    - um nome público falha no handshake;
    - a página e `/health` respondem por HTTPS;
  - Chrome headless sem a CA mostra "Conexão segura do MLab" (`evidencias/tls-instalacao.png`,
    `tls-instalacao-estreita.png`);
  - com a CA aceita (`--ignore-certificate-errors`, simulando o aparelho que confia), redireciona para HTTPS e mostra
    a entrada da aula (`evidencias/tls-confiavel.png`).

## 3. Gaps restantes

- **Teste manual nos aparelhos reais, com a CA de fato instalada:** Windows (Chrome/Edge), Android, iOS, macOS e
  Firefox, baixando PDF, docx, zip e .java sem "Download inseguro bloqueado". Não executado aqui: instalar uma CA no
  repositório do sistema muda a configuração de segurança da máquina e cabe ao responsável fazer. É a prova final da
  issue #47.
- **App empacotado** (`npm run make:win`) não gerado nesta sessão. Validar no instalador:
  - nome "MLab HTTPS" e coexistência com o MLab;
  - criação da CA em `%APPDATA%\MLab HTTPS\tls`;
  - liberação do firewall para a 8443.
- **Schannel/revogação:** clientes Windows que usam o Schannel (ex.: `curl`) exigem consulta de revogação. Chrome e
  Edge não exigem para CAs locais, mas validar no teste manual. Se algum navegador exigir, avaliar uma CRL vazia
  servida pela própria 8080.
- **Download da CA por HTTP** pode ser avisado pelo navegador. A página orienta "Manter" e a conferência da impressão
  digital.
- Numeração: a outra sessão usa a **012** para mDNS. A feature de arrastar arquivos (issue #46), prevista como 012 no
  plano, precisa de outro número quando for especificada.

## 4. Versão

Edição isolada, sem PR para a `development`: **sem `npm run bump`** e versão mantida em 1.9.1, com o instalador
`MLab HTTPS-Setup-1.9.1`. Se a edição passar a ter releases próprias, definir com o responsável o esquema de versão
(ex.: sufixo ou série separada) antes de publicar, conforme o `docs/versionamento.md`.

## 5. Desvios registrados

- Interferência de outra sessão na mesma pasta de trabalho (troca de branch durante o commit; o hash 2d6eba9 virou
  df21769). Resolvido sem perda; a outra sessão passou a usar a worktree `C:\Users\User\Documents\mlab-mdns`.
  Nenhuma issue: não é defeito do produto.

## 6. Atualizações por rebase

### 2026-11-19 — rebase sobre a `development` 2.2.1

- **Base:** os 11 commits da edição foram rebaseados de `3646ecb` (#124) para `315209e` (#156, `development` 2.2.1),
  que estava 109 commits à frente. Os commits seguem assinados. O push forçado exigiu desligar a ruleset
  `Rule-edicao-https-lan` só durante o envio; ela foi reativada em seguida.
- **Versão:** a edição acompanha a da `development` e passa a **2.2.1** (instalador `MLab HTTPS-Setup-2.2.1`), sem
  bump próprio (§4).
- **Conflitos resolvidos:**
  - `apps/web/src/App.tsx`: mantidos os dois imports, `BrandMark` (UI 2.0) e `TlsGate` (RF-1106).
  - `apps/desktop/src/renderer/pages/Dashboard.tsx`: a UI 2.0 trocou o `Card` centralizado pelo layout em duas
    colunas. O cartão **HTTPS na rede local** (RF-1108) foi refeito como um segundo `ml-panel` na coluna da direita,
    abaixo de **Como os alunos entram**, com a impressão digital (`https-fingerprint`) e **Exportar certificado**
    (`export-ca`). O import antigo de `MLAB-logo.png` saiu, porque a tela nova usa o `BrandMark`.
  - `README.md`: mantido o README da edição, como manda a seção "Manter a edição atualizada".
  - Sem conflito: `apps/desktop/package.json` (identidade "MLab HTTPS"), `src/main/main.ts` (`MLAB_TLS=1`), o backend
    e a lista de ADRs do `AGENTS.md` (0008 ao lado da 0009 e da 0010).
- **Verificação automática:**
  - `npm run spec:check` PASS e `npm run version:check` 2.2.1;
  - backend: `go vet` e `go test ./...` verdes, incluindo `internal/tlsca` e `cmd/server`;
  - web: `vitest` 85/85 (com `TlsGate` e `services/tls`) e lint;
  - desktop: `vitest` 393/393 e `npm run lint` (`tsc --noEmit`).
- **Backend com `MLAB_TLS=1`** (portas de teste 18080/18443, pasta temporária): a CA foi criada na primeira subida
  (`mlab-ca.crt`, `mlab-ca.key`); `/tls/info` respondeu `enabled: true` com a impressão digital, `/tls/ok` respondeu
  200 por HTTPS e `/mlab-ca.crt` baixou o certificado.
- **Teste manual do responsável:** com o backend em `MLAB_TLS=1` e o app do professor em `npm run dev`, o cartão
  **HTTPS na rede local** aparece no layout novo, com a impressão digital e a exportação do certificado; o fluxo foi
  confirmado como funcional.
- **Gaps:** continuam os da §3 (aparelhos reais com a CA instalada e o instalador `make:win`). Nenhum teste
  automatizado cobre o cartão no Dashboard.
