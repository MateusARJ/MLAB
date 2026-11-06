# Clarify: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-06.

## C-101 — Por que o link não resolve no celular

- **Contexto:** `internal/room/mdns.go` usa `github.com/pion/mdns v0.0.12`. No código da biblioteca
  (`conn.go`, `start`/`sendAnswer`/`createAnswer`), toda resposta sai por multicast para `224.0.0.251:5353`, com ID 0,
  sem a pergunta original e com registro A para qualquer tipo de pergunta. O resolvedor `.local` do Android 12+ e
  outros resolvedores *one-shot* perguntam de porta efêmera e só aceitam resposta unicast nessa porta (RFC 6762
  §6.7). A resposta multicast na 5353 nunca chega a eles. No computador funciona porque o Windows, o macOS e o
  Chrome desktop perguntam a partir da porta 5353 e aceitam a resposta multicast.
- **Referência:** no macOS, `DNSServiceRegisterRecord` (API `dnssd`) registra um nome `.local` no mDNSResponder do
  sistema, que implementa a RFC 6762 inteira. A API só existe no macOS; o MLab roda em Windows e Linux.
- **Alternativas consideradas:** (A) atualizar para `github.com/pion/mdns/v2`, que trata QU e *legacy unicast*
  (v2.0.0 #176, v2.0.1 #178), ecoa a pergunta (v2.1.0) e filtra o tipo da pergunta; (B) registrar o nome no
  responder nativo do sistema (`DnsServiceRegister` no Windows, Avahi no Linux), o que exige ADR
  por mudar a infraestrutura de rede; (C) manter e documentar só o link por IP.
- **Resposta aprovada:** alternativa **A**. A **B** fica como plano B, com ADR própria, se o smoke A16 mostrar que a
  v2 não basta.

## C-102 — Matriz de aceite

- **Resposta aprovada:** Android 12+ com Chrome é obrigatório no smoke A16; iOS com Safari quando houver aparelho
  (senão "N/E" com justificativa). Firefox, Android anterior ao 12 e redes com isolamento de multicast ficam fora
  (spec §2).

## C-103 — Porta 5353 ocupada e nomes anunciados

- **Resposta aprovada:** mantém o comportamento da 003: aviso em log e link por IP (RNF-101). Continuam anunciados
  `mlab.local` e `mlab-<professor>.local` (compatibilidade com links já distribuídos).

## Resultado

CLOSED — C-101 a C-103 respondidas; nenhuma ambiguidade em aberto.
