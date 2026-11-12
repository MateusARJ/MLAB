# Spec: Nome mDNS Único por Professor

Status: READY
Feature ID: `012-mdns-nome-unico`
Origem: issues #37 (nome mDNS único na rede) e #39 (link do professor com o nome realmente anunciado), registradas
depois da `010-mdns-celular` (seção 6 do `010-mdns-celular/converge.md`).

## 1. Objetivo

Com dois ou mais professores na mesma rede local, cada backend MLab passa a anunciar um nome mDNS diferente,
numerado na ordem de entrada: `mlab.local`, `mlab-2.local`, `mlab-3.local`… O link que o professor vê e copia no app
desktop usa sempre o nome que o backend dele **realmente** anuncia. Hoje todos anunciam `mlab.local`, e o celular do
aluno cai aleatoriamente no backend de outro professor ("sala não encontrada" ou a sala errada, sem aviso).

## 2. Escopo

### Incluído

- sondagem dos nomes candidatos na rede antes de anunciar;
- escolha do menor nome livre na sequência `mlab.local`, `mlab-2.local` … `mlab-20.local`;
- anúncio de um único nome por backend (sai o alias `mlab-<professor>.local`);
- detecção de conflito depois do anúncio, com desempate e troca de nome;
- links da API (`link`, `mdns_link`, `short_mdns_link`) montados com o nome anunciado, ou sem link `.local` quando não
  há anúncio;
- app desktop (Dashboard e sala) mostrando, copiando e atualizando o link com o nome anunciado, com aviso de mudança;
- atualização do contrato `001/contracts/room-api.md` e dos documentos derivados.

### Não incluído

- registro do nome no responder mDNS nativo do sistema operacional (`DnsServiceRegister`, Avahi);
- IPv6 (registro AAAA);
- detecção de backends MLab anteriores à 010 (`pion/mdns` v0.0.12), que não respondem a consulta *legacy unicast*;
- DNS-SD (`_mlab._tcp`), QR code e mudanças no web app dos alunos;
- os limites de rede e aparelho já fora de escopo da 010 (Firefox, Android < 12, isolamento de AP).

## 3. Atores

Professor (app desktop com backend embarcado); aluno (navegador na LAN); outro professor na mesma rede.

## 4. User Stories

### US-121 — Vários professores na mesma rede
**Como** professor numa rede com outros professores usando o MLab, **quero** que meu backend use um nome `.local`
só dele, **para** que meus alunos entrem na minha sala e não na de outro professor.
- O 1º professor a criar sala na rede fica com `mlab.local`; o 2º com `mlab-2.local`; e assim por diante.
- O nome não muda enquanto a sala existir, exceto quando houver conflito (RF-125).

### US-122 — Link certo na tela do professor
**Como** professor, **quero** ver e copiar o link com o nome que meu backend anuncia, **para** distribuir aos alunos
um link que abre a minha sala.
- O Dashboard e a sala mostram `http://<nome-anunciado>:8080`.
- Se o nome mudar durante a sessão, o link na tela é atualizado e aparece um aviso para reenviar aos alunos.
- Se não houver anúncio mDNS, o app não mostra link `.local`; o link por IP continua.

## 5. Requisitos

- RF-121: antes de anunciar, o backend sonda os nomes candidatos com consultas mDNS do tipo A (3 rodadas com
  250 ms de intervalo, após atraso aleatório de 0 a 250 ms; RFC 6762 §8.1). Um nome está ocupado quando chega
  resposta A com IPv4 diferente do IP que o backend vai anunciar.
- RF-122: os candidatos são `mlab.local` e `mlab-N.local` com N de 2 a 20, nessa ordem. O backend escolhe o primeiro
  livre. A escolha é refeita a cada criação de sala, sempre a partir de `mlab.local`.
- RF-123: o nome é decidido antes da resposta de `POST /rooms`; `link`, `mdns_link` e `short_mdns_link` usam esse
  nome, e `GET /rooms/{id}/link` e `GET /rooms/active` devolvem o nome anunciado no momento.
- RF-124: o backend anuncia somente o nome escolhido. O alias `mlab-<professor>.local` deixa de ser anunciado.
- RF-125: depois de anunciar, o backend reconsulta o próprio nome após 2 s, após 5 s e depois a cada 60 s. Se outra
  máquina responder pelo mesmo nome, o IPv4 numericamente menor mantém o nome; o outro backend sonda de novo, passa
  para o menor nome livre (excluindo o atual) e registra a troca em log. O backend que mantém o nome só registra o
  conflito em log.
- RF-126: sem anúncio ativo (porta UDP 5353 indisponível, sem IP de LAN, ou os 20 nomes ocupados),
  `mdns_link`/`short_mdns_link` não são devolvidos e `link` passa a ser o link por IP. `NGROK_URL`, `PUBLIC_URL` e
  `BASE_URL` continuam com precedência sobre `link`.
- RF-127: o app desktop mostra e copia o link `mdns_link` recebido, no Dashboard e na sala. Sem `mdns_link`, o bloco
  "Link Fixo" não aparece e fica só o link por IP.
- RF-128: enquanto os links estiverem na tela, o app desktop relê `GET /rooms/{id}/link` a cada 10 s. Se `mdns_link`
  mudar, a tela é atualizada sem reiniciar a transmissão e o professor vê o aviso "O link fixo da sala mudou para
  `<link>`. Reenvie aos alunos." Se `mdns_link` deixar de vir, o aviso diz que o link fixo não está mais disponível
  e que deve usar o link por IP.
- RNF-121: a sondagem acrescenta no máximo 1,5 s à criação da sala.
- RNF-122: sem dependência nova e sem mudança da stack mDNS (`pion/mdns/v2` continua como responder); só IPv4.
- RNF-123: falha na sondagem ou no anúncio só gera log; a sala é criada e o link por IP funciona (como RNF-101 da 010).

## 6. Regras de Negócio

- RN-121: o link `.local` é uma conveniência; o link por IP continua sendo devolvido e mostrado sempre.
- RN-122: o formato dos campos da API não muda; só o host do `mdns_link` varia e o campo pode faltar (já é opcional).

## 7. Critérios de Sucesso

- Teste automatizado em `internal/room`: com outro responder anunciando `mlab.local` na mesma rede, o backend fica
  com `mlab-2.local`, `mlab-2.local` resolve para o IP do backend e `mlab.local` continua com o IP do outro. O teste
  falha antes da correção e passa depois.
- Testes de unidade para a escolha do nome, o desempate e os links com `mlab.local`, `mlab-2.local` e sem anúncio.
- Testes do desktop: renderização e cópia do link recebido, bloco escondido sem `mdns_link`, atualização com aviso.
- Smoke A16b com dois PCs na mesma Wi-Fi: cada professor vê um link diferente e cada link abre a própria sala no
  celular (Chrome Android obrigatório; Safari iOS se houver aparelho).
- Suítes do backend e do desktop e `spec:check` verdes.
