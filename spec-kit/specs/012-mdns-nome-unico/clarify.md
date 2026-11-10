# Clarify: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-06 (análise das issues #37 e #39) e confirmadas na retomada em
2026-11-08.

## C-121 — Destino do alias `mlab-<professor>.local`

- **Contexto:** a 003 (RF-312) anuncia `mlab.local` e `mlab-<professor>.local`. Com a numeração, um professor de slug
  `2` geraria `mlab-2.local`, igual ao nome numerado de outro backend. `IsAllowedOrigin` (`origin.go`) já aceita
  qualquer `mlab-*.local`.
- **Alternativas:** (A) remover o alias; (B) manter o alias e reservar slugs numéricos.
- **Resposta aprovada:** **A**. Cada backend anuncia um único nome (RF-124). `origin.go` não muda.

## C-122 — Como sondar

- **Contexto:** a `pion/mdns/v2` não faz sondagem nem detecção de conflito; `Conn.Query` devolve só a primeira
  resposta, que pode ser a do próprio backend. Os `LocalNames` são fixos na criação do servidor.
- **Alternativas:** (A) sondagem própria no MLab com consulta *legacy unicast* (porta efêmera), que a `pion/mdns/v2`
  de outros backends ≥ 010 já responde por unicast; (B) responder nativo do SO, que trata conflito, mas troca a
  infraestrutura de rede e exige ADR.
- **Resposta aprovada:** **A**, sem dependência nova (`golang.org/x/net/dns/dnsmessage` e `ipv4` já estão no
  `go.mod`). As 20 perguntas vão num só pacote por rodada (a `pion/mdns/v2` responde cada pergunta da mensagem).
  Renomear = fechar e recriar o servidor com o novo nome. B fica como plano B com ADR própria.

## C-123 — Limite de nomes e momento da escolha

- **Resposta aprovada:** 20 candidatos (`mlab.local`, `mlab-2.local` … `mlab-20.local`). O nome é escolhido a cada
  criação de sala, sempre começando de `mlab.local`; se o 1º professor sair, o 2º continua com `mlab-2.local` até
  criar outra sala ou reiniciar (links já distribuídos não mudam). Com os 20 ocupados, não há anúncio (RF-126).

## C-124 — Conflito depois do anúncio

- **Contexto:** dois professores criando sala ao mesmo tempo podem sondar juntos e escolher o mesmo nome.
- **Alternativas:** (A) só registrar em log; (B) desempate e troca de nome, com aviso no desktop.
- **Resposta aprovada:** **B**. Reconsulta em +2 s, +5 s e a cada 60 s; o IPv4 numericamente menor mantém o nome; o
  outro troca para o menor nome livre e o desktop avisa (RF-125, RF-128). Backend MLab anterior à 010 não é
  detectado (não responde a consulta legacy); o smoke exige a mesma versão nos dois PCs.

## C-125 — Como o desktop fica sabendo da mudança de nome

- **Alternativas:** (A) novo evento no WebSocket; (B) releitura periódica de `GET /rooms/{id}/link`.
- **Resposta aprovada:** **B**, a cada 10 s, enquanto os links estiverem na tela. O Dashboard não tem WebSocket e o
  contrato de eventos não muda. Sem campo novo (`mdns_host`): o desktop compara `mdns_link`.

## C-126 — Link padrão sem anúncio

- **Contexto:** hoje `link` é `http://mlab.local:<porta>` mesmo quando o anúncio falhou.
- **Resposta aprovada:** sem anúncio, `mdns_link`/`short_mdns_link` saem da resposta (o campo já é opcional e tem
  `omitempty`) e `link` passa a ser o link por IP; variáveis de ambiente continuam com precedência (RF-126).

## C-127 — Versão e entrega

- **Resposta aprovada:** uma feature, um PR, bump **MINOR** (comportamento novo compatível; contrato só muda a
  descrição do host). PR fecha #37 e #39. IDs na faixa `1xx` (RF-121…, T121…) para caber no padrão `T\d{3}` do
  validador (ver issue #50).

## Resultado

CLOSED — C-121 a C-127 respondidas; nenhuma ambiguidade em aberto.
