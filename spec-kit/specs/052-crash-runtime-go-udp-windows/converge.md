# Converge: Crash do Runtime Go na Leitura UDP do Windows

Feature: `052-crash-runtime-go-udp-windows`
Status: DONE
Branch: `fix/crash-runtime-go-udp-windows`, a partir da `main` @ `39fde1e` (2.2.1) (C-5203)

## 1. Evidências

- Diagnóstico (logs da máquina do professor, 2026-11-19): duas quedas com `Exception 0xc0000005` e
  `PC=0x101470e5e0`. A primeira saiu com código 2; a segunda travou no traceback e foi morta no fechamento do app
  (código 1). O PC é o endereço de retorno em `internal/poll.(*FD).ReadFromInet4` (`0x00007ff6_1470e5e0`) com os 32
  bits altos trocados por `0x10`, a assinatura de golang/go#77975.
- `apps/backend/go.mod`: `go 1.26.11`. `go mod tidy` não mudou o `go.sum`.
- Com `GOTOOLCHAIN=go1.26.11` (`go version go1.26.11 windows/amd64`): `go vet ./...` verde; `go test ./...` verde em
  `cmd/server`, `internal/auth`, `internal/chat`, `internal/signaling` e `internal/webrtc`. Em `internal/room`, só
  `TestLegacyProberDetectaNomeOcupado` falha, e falha igual com `GOTOOLCHAIN=go1.26.0` na `main` (3/3); ver §3.
- Testes novos: `TestSetCrashLog_PanicVaiParaArquivoEStderr` (subprocesso com `panic`: o texto e o stack trace
  chegam ao arquivo, em append, e ao stderr) e `TestSetCrashLog_CaminhoInvalidoDevolveErro`.
- Não verificado nesta entrega: aula real no Windows com o instalador novo. O crash é intermitente (10 min e 2 min
  nas sessões do relato); a confirmação fica para a validação do responsável, com
  `go version -m resources/bin/mlab-backend.exe` mostrando `go1.26.11`.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5201 | diretiva `go 1.26.11`; CI lê pelo `go-version-file` (`.github/workflows/build-all.yml`) |
| RF-5202 | `setCrashLog` em `lifecycle.go`, chamado no `main.go`; teste do subprocesso |
| RF-5203 | `main.go` registra "AVISO" e segue; teste do caminho inválido; sem `MLAB_LOG_FILE`, nada é chamado |
| RNF-5201 | `go vet` e `go test` verdes com 1.26.11, exceto o desvio do §3 (pré-existente) |
| RNF-5202 | só `runtime/debug` da biblioteca padrão; `go.sum` intacto |
| RNF-5203 | `debug.CrashOptions{}` vazio: só a saída do runtime, sem ambiente |

## 3. Desvios registrados

Issue do crash: #163.

- #164 — `fix(backend): teste da sondagem mdns falha com outro mlab na mesma rede`. Não bloqueante:
  `TestLegacyProberDetectaNomeOcupado` usa multicast real e espera que `mlab.local` esteja ocupado pelo responder
  simulado (192.0.2.10). Com outro MLab anunciando `mlab.local` na LAN (192.168.1.78), a resposta real vem antes e o
  teste falha. Falha igual na `main` com Go 1.26.0; não depende desta feature.

## 4. Trabalho restante

- Feature `053-reacao-queda-backend`: o app desktop detectar queda ou travamento do backend, avisar o professor e se
  recuperar (C-5202).
- Levar a correção para a edição HTTPS por rebase de `edicao/https-lan`.
- Como a `development` não existe mais no remoto, recriá-la a partir da `main` se o fluxo do AGENTS.md §15 continuar
  valendo.

## 5. Impacto de versão

**PATCH** (C-5203): atualização da toolchain que vai no instalador, sem mudança de comportamento, e correção de
diagnóstico do log do backend; sem capacidade nova nem contrato (`docs/versionamento.md` §2). 2.2.1 → 2.2.2.
