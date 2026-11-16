# Spec: Limite do RNF-121 Medido Só na Sondagem

Status: READY
Feature ID: `030-teste-mdns-sondagem`
Origem: issue #87 (desvio registrado na `027-matricula-unica-na-transmissao`, T2702). Só testes; não muda regra,
contrato nem ADR.

## 1. Objetivo

Tornar estável `TestMDNSNaoDisputaNomeDeOutroBackend` (`apps/backend/internal/room/mdns_test.go`), fazendo o teste
comparar com o limite do RNF-121 o mesmo intervalo que o requisito define: o tempo da sondagem. O comportamento de
produção está correto e não muda.

## 2. Contexto

Verificado em 2026-11-14 na `development` @ `54081ed`:

- RNF-121 (`012-mdns-nome-unico/spec.md`): "a **sondagem** acrescenta no máximo 1,5 s à criação da sala".
- O teste mede o tempo de parede de `ClaimMDNSName` inteiro (`mdns.go`), que além da sondagem abre o socket 5353
  (`listenReusablePacketConn`), enumera as interfaces de rede (`mdnsInterfaces` → `net.Interfaces()`) e sobe o
  responder pion (`startMDNSResponder`, que entra no grupo multicast). Esses passos já existiam antes da 012 (anúncio
  da `010-mdns-celular`) e não são o que o RNF-121 limita.
- A sondagem (`legacyProber.probe`, `mdns_probe.go`) é limitada por prazos: jitter de até 250 ms + 3 rodadas de
  250 ms, cerca de 1,0 s no máximo.
- Evidência da issue #87: com `go test -count=1 ./...` (pacotes em paralelo, Wi-Fi real, Windows 11) o claim levou
  2,21 s e o teste falhou; repetido sozinho, passou 3 de 3.
- `TestLegacyProberDetectaNomeOcupado` (`mdns_probe_test.go`) já mede só a sondagem com o mesmo limite e não foi
  citado como instável.

## 3. Escopo

### Incluído

- testes de `apps/backend/internal/room` que aplicam o limite do RNF-121 dentro do claim.

### Não incluído

- código de produção (`mdns.go`, `mdns_probe.go`), parâmetros da sondagem e o próprio RNF-121;
- afrouxar o limite de 1,5 s ou serializar a execução do pacote;
- `TestLegacyProberDetectaNomeOcupado`, que já mede só a sondagem.

## 4. Requisitos

- RF-3001: o teste do claim com outro backend anunciando `mlab.local` aplica o limite de 1,5 s do RNF-121 ao tempo da
  sondagem feita pelo claim, e não ao tempo total do claim. Se a sondagem passar de 1,5 s, o teste falha.
- RF-3002: o teste registra no log o tempo da sondagem e o tempo total do claim, para que uma falha mostre de onde veio
  o tempo.
- RNF-3001: sem mudança de código de produção, sem dependência nova e sem incremento de versão.

## 5. Critérios de Sucesso

- `go test -count=10 ./...` em `apps/backend` sem falha de `TestMDNSNaoDisputaNomeDeOutroBackend` na máquina da
  issue (Windows 11, Wi-Fi real).
- `go test -race` do pacote sem corrida entre o cronômetro do teste e o monitor de conflito.
- `npm run spec:check` com PASS para `030-teste-mdns-sondagem`.
