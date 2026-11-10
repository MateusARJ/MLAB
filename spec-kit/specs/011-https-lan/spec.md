# Spec: HTTPS na LAN com CA local (edição MLab HTTPS)

Status: READY
Feature ID: `011-https-lan`
Origem: issue #47 ("Download inseguro bloqueado" nos alunos). Decisão: ADR 0008 (aprovada só para esta edição).
Edição: **MLab HTTPS**, branch `edicao/https-lan`, isolada da `development`.

## 1. Objetivo

Servir a página dos alunos, a API, o WebSocket e os downloads por **HTTPS confiável na LAN**, sem internet, para o
navegador deixar de bloquear os downloads ("Download inseguro bloqueado"). O backend gera uma CA local por instalação
do professor. Cada aparelho de aluno instala o certificado dessa CA uma vez, por uma página de instalação servida no
link HTTP de sempre.

## 2. Escopo

### Incluído

- geração e reuso de uma CA local com Name Constraints (`.local`, `localhost`, IPs privados e loopback);
- certificados de servidor emitidos sob demanda, em memória, para o IP ou nome acessado;
- listener HTTPS (porta padrão 8443) com o mesmo conteúdo do HTTP;
- página de instalação do certificado no navegador do aluno, com teste de confiança, redirecionamento automático e
  botão "Continuar com HTTPS";
- no app do professor: impressão digital da CA e exportação do certificado;
- identidade própria da edição ("MLab HTTPS").

### Não incluído

- merge na `development` ou mudança no MLab principal;
- seguir a aula pelo HTTP nesta edição (ADR 0008, decisão 8);
- CA pública, domínio, ACME ou túnel;
- mudança na mídia WebRTC (já cifrada por DTLS-SRTP).

## 3. Atores

Professor (app desktop "MLab HTTPS") e aluno (navegador).

## 4. User Stories

### US-1101 — Aluno baixa materiais sem bloqueio
**Como** aluno, **quero** acessar a aula por HTTPS confiável, **para** baixar os materiais sem o navegador bloquear.
- Com a CA instalada, o link do professor abre a aula em `https://` sem aviso, e os downloads funcionam.

### US-1102 — Aluno instala o certificado na primeira vez
**Como** aluno, **quero** uma página que me guie na instalação do certificado do MLab, **para** fazer isso uma vez só.
- Sem a CA instalada, o link mostra o passo a passo do meu sistema, o botão de baixar o certificado, a impressão
  digital para conferir e o botão "Continuar com HTTPS".

### US-1103 — Professor confere e distribui o certificado
**Como** professor, **quero** ver a impressão digital da CA e exportar o certificado, **para** os alunos conferirem e
a TI instalar nos PCs do laboratório.

## 5. Requisitos

- RF-1101: na primeira execução com TLS ligado, o backend cria `tls/mlab-ca.crt` e `tls/mlab-ca.key` no diretório de
  trabalho (o `userData` do app) e reutiliza os dois nas execuções seguintes. A CA é ECDSA P-256, `IsCA`, com
  `MaxPathLen` 0 e Name Constraints críticas: DNS `local` e `localhost`; IPs `10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.0/8`, `::1/128`, `fc00::/7` e `fe80::/10`.
- RF-1102: no handshake TLS, o backend emite (ou reaproveita do cache) um certificado de servidor para o SNI ou, sem
  SNI, para o IP local da conexão. Ele é válido por 30 dias, com `serverAuth` e o nome no SAN, e é renovado quando
  faltar menos de 1 dia. Nomes fora das Name Constraints são recusados.
- RF-1103: com `MLAB_TLS=1`, o backend escuta HTTPS em `WEB_TLS_PORT` (padrão `8443`), com o mesmo roteador do HTTP,
  TLS 1.2 ou superior e HTTP/1.1.
- RF-1104: rotas novas.
  - `GET /tls/info` (HTTP e HTTPS) devolve `enabled`, `port`, `fingerprint` (curta), `fingerprint_sha256` (completa)
    e `ca_url`.
  - `GET /mlab-ca.crt` devolve o certificado da CA (`application/x-x509-ca-cert`, `attachment`).
  - `GET /tls/ok` responde 200 só por HTTPS, com CORS para a origem HTTP do mesmo host.

  Com TLS desligado, `/tls/info` devolve `enabled: false` e as outras duas rotas devolvem 404.
- RF-1105: no modo de desenvolvimento com redirecionamento para o Vite, `enabled` é `false` (a página de instalação
  não age), mesmo com o listener HTTPS ligado.
- RF-1106: no web do aluno, uma página aberta por `http://` consulta `/tls/info`. Se `enabled`, ela testa
  `https://<host>:<port>/tls/ok`: se responder, redireciona para o mesmo caminho em HTTPS; se falhar, mostra a página
  de instalação. Sem `enabled`, ou se `/tls/info` falhar, o app segue como hoje.
- RF-1107: a página de instalação detecta o sistema (Windows, Android, iOS/iPadOS, macOS, Linux/ChromeOS) e mostra:
  - o passo a passo do sistema detectado, com os demais acessíveis;
  - o aviso para o Firefox;
  - o botão "Baixar certificado do MLab";
  - a impressão digital curta;
  - a orientação de escolher "Manter" se o navegador avisar no download do certificado;
  - o botão **"Continuar com HTTPS"**, que testa de novo e redireciona, ou informa que o certificado ainda não é
    confiável.
- RF-1108: no app do professor, o Dashboard mostra a impressão digital curta, o aviso de instalação única pelos alunos
  e o botão "Exportar certificado".
- RF-1109: a edição usa `productName` "MLab HTTPS" e `appId` `com.mlab.classroom.https`, e liga `MLAB_TLS=1` e
  `WEB_TLS_PORT=8443` no backend embarcado.
- RNF-1101: nenhuma dependência nova (Go: `crypto/*`; web e desktop: sem bibliotecas novas).
- RNF-1102: a chave da CA é gravada com permissão `0600` e nunca é servida nem registrada em log; os certificados de
  servidor não são gravados em disco.
- RNF-1103: `tls/` fica no `.gitignore`.

## 6. Regras de Negócio

- RN-1101: o link compartilhado pelo professor continua o mesmo (HTTP). A página decide sozinha entre redirecionar e
  orientar a instalação.
- RN-1102: as regras de autorização (token de sala, chave de host) não mudam; valem igual nos dois listeners.

## 7. Critérios de Sucesso

- Testes Go:
  - Name Constraints presentes e críticas;
  - certificado de servidor válido para IP privado, `mlab.local` e `localhost`;
  - domínio público e IP público recusados;
  - CA reaproveitada entre execuções;
  - servidor TLS acessível com a CA no pool;
  - rotas `/tls/*` e `/mlab-ca.crt`.
- Testes do web: redireciona quando `/tls/ok` responde; mostra a instalação quando falha; "Continuar com HTTPS" testa
  de novo.
- Teste manual: aluno instala a CA e baixa PDF, docx, zip e .java sem "Download inseguro bloqueado".
