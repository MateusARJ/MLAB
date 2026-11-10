# Spec: Link `mlab.local` no Celular

Status: READY
Feature ID: `010-mdns-celular`
Origem: relato do responsável (2026-11-06): "o link fixo `mlab.local:8080` não funciona no celular"; smoke A16
(`docs/metrics/smoke-runbook.md`) pendente.

## 1. Objetivo

Fazer o link institucional `http://mlab.local:8080/...` (003, US-22, RF-312) abrir a sala no navegador do celular do
aluno, na mesma rede local do professor. Hoje ele abre no computador, mas não resolve no celular. O link por IP
continua igual e segue como alternativa.

## 2. Escopo

### Incluído

- resolução de `mlab.local` e `mlab-<professor>.local` por celulares na mesma LAN (Android 12+ com Chrome; iOS com
  Safari);
- resposta mDNS conforme a RFC 6762 para consultas *legacy unicast* (porta de origem diferente de 5353), consultas
  com o bit QU e consultas multicast comuns;
- teste automatizado que reproduz o defeito;
- atualização do roteiro do smoke A16.

### Não incluído

- Firefox (Android e desktop), que não resolve nomes `.local`;
- Android anterior ao 12, que não resolve `.local` no sistema;
- redes que bloqueiam multicast entre clientes Wi-Fi (isolamento de AP, filtro mDNS na controladora);
- descoberta de serviço (DNS-SD, `_mlab._tcp`), QR code e registro pelo responder mDNS nativo do sistema operacional;
- mudança nos links devolvidos pela API (`link`, `ip_link`, `mdns_link`), no web app ou no app desktop.

## 3. Atores

Aluno (navegador do celular na LAN); professor (app desktop que inicia o backend embarcado).

## 4. User Stories

### US-101 — Abrir a aula pelo link fixo no celular
**Como** aluno, **quero** abrir `http://mlab.local:8080/...` no navegador do celular, **para** entrar na aula sem
digitar o IP do professor.
- Na mesma Wi-Fi, com Android 12+ (Chrome) ou iOS (Safari), o link abre a tela de entrada da sala.
- Se o celular não resolver `.local` (casos fora de escopo), o link por IP continua funcionando.

## 5. Requisitos

- RF-101: o backend responde à consulta mDNS do tipo A para `mlab.local` e `mlab-<professor>.local` com o IP
  anunciado, por unicast para o IP e a porta de origem, com o mesmo ID e a pergunta original, quando a consulta vier
  de porta diferente de 5353 (*legacy unicast*, RFC 6762 §6.7) ou tiver o bit QU (RFC 6762 §5.4).
  - **Nota (012-mdns-nome-unico):** o nome anunciado passou a ser um só por backend (`mlab.local` ou
    `mlab-N.local`); o alias `mlab-<professor>.local` saiu (012, RF-124). A forma da resposta descrita aqui não muda.
- RF-102: consultas multicast comuns (porta de origem 5353, sem QU) continuam respondidas por multicast, como hoje.
- RF-103: o backend não responde com registro A a perguntas de outro tipo (ex.: AAAA, HTTPS).
- RNF-101: se a porta UDP 5353 estiver ocupada ou o anúncio falhar, o backend registra o aviso em log e o link por
  IP continua funcionando (comportamento atual da 003).

## 6. Regras de Negócio

- RN-101: as regras da 003 para o link (RF-312) valem como estão; esta feature só corrige a resolução do nome.

## 7. Critérios de Sucesso

- Teste automatizado em `internal/room` envia uma consulta A de porta efêmera com ID diferente de zero e recebe
  resposta unicast nessa porta, com o mesmo ID, a pergunta ecoada e o IP anunciado. O teste falha antes da correção
  e passa depois.
- Smoke A16: o link `mlab.local` abre a sala num Android 12+ (Chrome) na mesma Wi-Fi; iOS (Safari) se houver
  aparelho; o link por IP segue funcionando.
- Suítes do backend e `spec:check` verdes.
