# Spec: Crash do Runtime Go na Leitura UDP do Windows

Status: READY
Feature ID: `052-crash-runtime-go-udp-windows`
Origem: relato de uso real em 2026-11-19 (MLab 2.2.1, Windows, 10 a 14 alunos). Os logs da máquina do professor
mostram o backend caindo duas vezes no meio da aula. A causa é um bug do runtime Go, não do código do MLab. Não muda
regra de negócio, contrato nem ADR.

## 1. Objetivo

1. O backend embarcado deixa de cair por corrupção de pilha na leitura UDP do Windows.
2. Uma queda do runtime (`panic`, `fatal error`, exceção) fica registrada no log persistente do backend, e não só no
   log do app.

## 2. Contexto

Verificado nos logs da máquina do professor (`mlab-main.log` e `mlab-backend.log`, 2026-11-19, `main` @ `39fde1e`):

- 18:03:32 UTC: `Exception 0xc0000005 0x8 0x101470e5e0 0x101470e5e0`, `PC=0x101470e5e0`, "unknown pc"; o backend sai
  com código 2. O app não percebe, e alunos e professor passam a receber erro de fetch.
- 18:08:17 UTC, depois de reabrir o app: a mesma exceção, no mesmo PC. Uma segunda falha no traceback
  (`fatal error: unexpected signal during runtime execution`) deixa o processo travado, sem sair.
- O PC inválido `0x00000010_1470e5e0` é o endereço de retorno válido `0x00007ff6_1470e5e0` (dentro de
  `internal/poll.(*FD).ReadFromInet4`) com os 32 bits altos sobrescritos por `0x10` (16 = `sizeof(sockaddr_in)`).
- É o bug golang/go#77975: no Windows, o `WSARecvFrom` assíncrono grava o tamanho do endereço (`rsan`) num slot da
  pilha que já foi reaproveitado. A correção é `internal/poll: move rsan to heap on windows`, backport golang/go#78041,
  publicada no **Go 1.26.2**.
- O backend é compilado com Go **1.26.0** (`apps/backend/go.mod`; o CI usa `setup-go` com `go-version-file`). Toda
  leitura UDP do Pion (ICE e mDNS) passa por esse caminho.
- O `mlab-backend.log` não tem nenhuma linha do crash: o runtime escreve direto no stderr, fora do `log.SetOutput`
  (`apps/backend/cmd/server/main.go`). O crash só aparece no `mlab-main.log`, que repassa o stderr do processo.

## 3. Escopo

### Incluído

- Versão do Go usada para compilar e testar o backend.
- Saída de crash do runtime no `mlab-backend.log` (complementa RF-3414 da 034).

### Não incluído

- Reação do app desktop à queda ou ao travamento do backend (aviso, reinício): feature própria, `053`.
- Atualização de dependências do Pion ou de outros módulos.
- Mudança de workflow do CI (segue o `go-version-file`).

## 4. Atores

- **Professor e alunos**: dependem do backend embarcado durante a aula.
- **Mantenedor**: diagnostica quedas pelo `mlab-backend.log`.

## 5. User Stories

### US-5201 — Aula sem queda do backend

Como professor, quero que a transmissão não caia por um defeito do runtime.

- Dado o backend compilado pelo CI, quando o binário é inspecionado (`go version -m`), então a versão do Go é
  1.26.11.
- Dado uma aula no Windows com vários alunos, então não aparece `Exception 0xc0000005` com PC `0x00000010…` no log.

### US-5202 — Crash registrado no log do backend

Como mantenedor, quero que um crash do runtime fique no `mlab-backend.log`.

- Dado o backend com `MLAB_LOG_FILE`, quando ocorre um `panic` não tratado, então o texto do `panic` e o stack trace
  ficam no arquivo de log, além do stderr.

## 6. Requisitos Funcionais

- RF-5201: o backend é compilado e testado com Go 1.26.11 (última de patch da 1.26 em 2026-11-19, que inclui a
  correção de golang/go#77975, disponível desde a 1.26.2). A diretiva `go` de `apps/backend/go.mod` fixa essa versão,
  e o CI a segue pelo `go-version-file`.
- RF-5202: com `MLAB_LOG_FILE` definido, a saída de crash do runtime (`panic` não tratado, `fatal error`, exceção) é
  gravada em append no mesmo arquivo de log, por `runtime/debug.SetCrashOutput`. O stderr continua recebendo a saída,
  e o `mlab-main.log` também.
- RF-5203: se o arquivo não puder ser aberto para a saída de crash, o backend registra um aviso no log e continua.
  Sem `MLAB_LOG_FILE`, nada muda.

## 7. Requisitos Não Funcionais

- RNF-5201 — regressão: `go vet ./...` e `go test ./...` em `apps/backend` verdes com a nova versão.
- RNF-5202 — dependências: nenhuma nova; `runtime/debug` é da biblioteca padrão.
- RNF-5203 — segurança: a saída de crash não grava variáveis de ambiente (mantém RNF-3402 da 034).

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| `MLAB_LOG_FILE` definido, crash do runtime | crash no arquivo e no stderr |
| `MLAB_LOG_FILE` definido, arquivo não abre | aviso no log, backend segue, crash só no stderr |
| `MLAB_LOG_FILE` vazio | comportamento atual (crash só no stderr) |

## 9. Edge Cases

- Crash durante o traceback (segunda falha, como em 18:08:17): o que o runtime chegar a escrever vai para os dois
  destinos.
- Várias execuções: o arquivo é aberto em append e não apaga o histórico.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `go vet ./...` e `go test ./...` verdes em `apps/backend`, com teste novo para RF-5202 e RF-5203.
- `go version` do toolchain usado nos testes é 1.26.11.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5201 a C-5203).
