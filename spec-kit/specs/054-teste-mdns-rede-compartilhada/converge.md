# Converge: Teste da Sondagem mDNS Isolado da Rede

Feature: `054-teste-mdns-rede-compartilhada`
Status: DONE
Branch: `fix/teste-mdns-rede-compartilhada`, a partir da `main` @ `2039887` (2.3.0)

## 1. Evidências

- Antes (código da `main`, com o MLab do professor anunciando `mlab.local` em 192.168.1.78 na LAN):
  `mlab.local deveria estar ocupado por 192.0.2.10, obteve 192.168.1.78`.
- Depois, com a mesma rede e `GOTOOLCHAIN=go1.26.11`,
  `go test ./internal/room -run TestLegacyProberDetectaNomeOcupado -count=5 -v` deu 5/5 verdes. Em cada execução, só
  o responder simulado ocupa o nome único, por exemplo `map[mlab-teste-5ff334c7.local:192.0.2.10]`, com a sondagem
  entre 845 e 950 ms (limite de 1,5 s).
- `go vet ./...` verde; `go test ./...` verde em todos os pacotes do backend, inclusive `internal/room`.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5401 | `base := fmt.Sprintf("mlab-teste-%08x", rand.Uint32())`, nomes usados nos dois responders e no `probe` |
| RF-5402 | mesmas três asserções e o limite de 1,5 s |
| RNF-5401 | só biblioteca padrão (`fmt`, `math/rand/v2`) |
| RNF-5402 | `go vet` e `go test ./...` verdes com outro MLab na LAN |

## 3. Desvios registrados

- Nenhum.

## 4. Trabalho restante

- Nenhum nesta feature. Fecha a issue #164.

## 5. Impacto de versão

**Nenhum** (C-5402): só teste, nada do instalador muda (`docs/versionamento.md` §2).
