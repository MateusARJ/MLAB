# Spec: Transmissão de Tela em Sala

Status: READY-FOR-PLAN
Feature ID: `001-screen-share-core`

## 1. Objetivo

Permitir que um professor crie uma sala via app desktop e transmita sua tela e áudio ao vivo para uma turma com 40 ou mais alunos que acessam via navegador web, com boa qualidade visual, FPS estável e baixa latência.

## 2. Escopo

### Incluído

- login do professor no app desktop;
- criação e entrada em sala;
- professor iniciando/parando compartilhamento de tela;
- professor transmitindo áudio pelo microfone;
- controle independente de mute e áudio/vídeo;
- alunos se identificando com Nome Completo e Matrícula;
- alunos acessando via link único gerado pelo professor;
- alunos entrando como espectadores via navegador web;
- transmissão de uma única tela do professor para múltiplos alunos via SFU Pion;
- chat de texto em tempo real para todos os participantes da sala;
- estado de sala e presença em tempo real via WebSocket;
- tratamento de perda de conexão, ICE restart e reconexão em 30s;
- suporte a credenciais TURN HMAC-SHA1 epêmeras;
- coleta dos indicadores básicos necessários para validar qualidade da transmissão.

### Não incluído

- câmera do professor ou dos alunos;
- microfone dos alunos;
- gravação da aula;
- upload de arquivos;
- edição de vídeo;
- transcodificação por espectador;
- integração com banco de dados da instituição;
- painel administrativo completo.

## 3. Atores

### Professor

Acessa o sistema exclusivamente via **app desktop** instalável (Windows, macOS, Linux).
Pode fazer login, criar uma sala, gerar o link único para os alunos, iniciar/parar o
compartilhamento de tela e transmitir áudio pelo microfone, e encerrar a sala.

### Aluno

Acessa o sistema via **navegador web** (sem instalação) através do link único fornecido
pelo professor. Deve se identificar com Nome Completo e Matrícula antes de entrar.
Pode assistir à tela transmitida e participar do chat de texto. Não transmite vídeo nem áudio.

## 4. User Stories

### US-01 — Login do professor no app desktop

**Como** professor, **quero** fazer login no app desktop, **para** acessar minhas salas e funcionalidades.

**Critérios de aceitação**

- O professor informa credenciais (e-mail e senha) no app.
- O backend valida e emite um JWT com `role: professor`.
- O app armazena a sessão de forma segura (não em localStorage exposto).
- Logout encerra a sessão e invalida o token localmente.

### US-02 — Criar sala e gerar link único

**Como** professor, **quero** criar uma sala e obter um link único, **para** compartilhar com os alunos.

**Critérios de aceitação**

- Ao criar a sala, o professor recebe um identificador único (slug) e um link de acesso.
- A sala inicia em estado aguardando transmissão (`waiting`).
- O professor pode copiar o link facilmente da interface.

### US-03 — Iniciar compartilhamento de tela e áudio

**Como** professor, **quero** selecionar minha tela/janela e iniciar a transmissão com áudio, **para** que os alunos possam acompanhar a aula.

**Critérios de aceitação**

- O app usa `desktopCapturer` (Electron) para capturar a tela.
- O app verifica permissões do sistema operacional para gravação de tela e áudio.
- O professor pode ativar/desativar o microfone durante a transmissão sem derrubar o vídeo.
- A transmissão de tela e áudio segue em paralelo por tracks WebRTC independentes.
- O professor consegue interromper a transmissão a qualquer momento.

### US-04 — Identificação do aluno e entrada na sala

**Como** aluno, **quero** inserir meu Nome Completo e Matrícula ao acessar o link, **para** ser identificado na sala e no chat.

**Critérios de aceitação**

- A página web solicita Nome Completo e Matrícula antes de exibir a transmissão.
- O backend emite um JWT de aluno com `name`, `student_id` e `room_id`.
- Um aluno com dados inválidos (campos vazios) não pode entrar na sala.
- O nome e matrícula são exibidos no chat ao lado das mensagens.

### US-05 — Assistir à transmissão

**Como** aluno, **quero** entrar na sala e assistir à tela do professor, **para** acompanhar a aula em tempo real.

**Critérios de aceitação**

- Alunos podem entrar sem publicar câmera/microfone.
- Uma transmissão ativa é exibida sem exigir atualização manual da página.
- O player web lida com Autoplay Policy do navegador (exibe botão "Clique para Ativar Som" se o áudio for bloqueado).
- Suporte aos modos Fullscreen e Picture-in-Picture no player web.
- O encerramento da transmissão é refletido para os alunos.

### US-06 — Escala da sala

**Como** professor, **quero** transmitir para uma turma de 40 ou mais alunos, **sem** precisar manter uma conexão P2P independente para cada aluno.

**Critérios de aceitação**

- A arquitetura de mídia usa SFU (Pion WebRTC).
- O professor publica uma única upstream de mídia (tela + áudio).
- A distribuição é feita pela SFU para todos os espectadores sem transcoding.
- Faixa de portas UDP do SFU delimitada entre 50000 e 50100.
- O limite operacional inicial é 50 participantes por sala (configurável).

### US-07 — Chat de texto em tempo real

**Como** participante, **quero** enviar e receber mensagens de texto na sala, **para** comunicar dúvidas ou comentários sem interromper a transmissão.

**Critérios de aceitação**

- Todos os participantes (professor e alunos) podem enviar e ler mensagens.
- Mensagens exibem o nome e papel (`[Professor]` ou `[Aluno]`) do remetente.
- Mensagens chegam em tempo real via WebSocket com timestamp server-side.
- Rate limit de 5 msgs/5s e 30 msgs/min por participante; extrapolação gera alerta sem desconectar.
- Sanitização contra injeção de HTML/XSS.

### US-08 — Recuperação de conexão

**Como** aluno/professor, **quero** que uma perda temporária de conexão seja tratada sem quebrar a sala.

**Critérios de aceitação**

- O cliente sinaliza o estado de reconexão.
- Professor possui janela de 30 segundos para reconectar antes do encerramento da sala.
- Aluno utiliza backoff exponencial para reconexão automática.
- Suporte a ICE Restart em caso de falha de rota na conexão WebRTC.

## 5. Requisitos Funcionais

- RF-01: o sistema deve identificar o papel do participante (`professor` ou `aluno`) via JWT.
- RF-02: somente o professor autorizado e dono da sala pode publicar a tela.
- RF-03: alunos possuem permissão apenas de espectador por padrão.
- RF-04: a captura no app desktop usa `desktopCapturer` (Electron API) com seletor de janelas/monitores.
- RF-05: a transmissão usa WebRTC via SFU (Pion Go).
- RF-06: a topologia usa SFU para distribuição a múltiplos alunos sem transcoding.
- RF-07: o sistema sinaliza estado de sala (`waiting`, `publishing`, `reconnecting`, `closed`) via WebSocket.
- RF-08: o sistema registra e expõe métricas de qualidade (bitrate, FPS, RTT, loss).
- RF-09: o sistema suporta chat de texto em tempo real via WebSocket.
- RF-10: o professor pode transmitir áudio do microfone junto com a tela.
- RF-11: o aluno deve informar Nome Completo e Matrícula ao entrar na sala.
- RF-12: o professor deve se autenticar com e-mail e senha no app desktop (JWT 8h).
- RF-13: o professor pode gerar um link único de acesso à sala para os alunos.
- RF-14: criação e encerramento de sala são operações REST exclusivas do professor.
- RF-15: encerramento da sala fecha conexões WebRTC e notifica clientes via WS (`room-closed`).
- RF-16: mensagens de chat exibem o nome e o papel (`[Professor]` / `[Aluno]`) do remetente.
- RF-17: timestamp das mensagens é gerado pelo servidor (`sent_at`) e mensagens vazias são descartadas.
- RF-18: perda de conexão do professor coloca a sala em `reconnecting` por 30 segundos.
- RF-19: reconexão do aluno utiliza algoritmo de backoff exponencial (1s a 30s).
- RF-20: controle independente de mute de áudio e pausa de vídeo pelo professor.
- RF-21: tratamento de Autoplay Policy no player web com opção interativa para un-mute.
- RF-22: suporte aos modos Fullscreen e Picture-in-Picture no player web.
- RF-23: credenciais epêmeras HMAC-SHA1 para acesso ao servidor TURN (válidas por 24h).
- RF-24: verificação de permissões do sistema operacional no app desktop antes da captura.
- RF-25: monitoramento de `iceConnectionState` e disparo automático de ICE Restart.

## 6. Requisitos Não Funcionais

- RNF-01: resolução alvo de até 1920×1080 (Full HD).
- RNF-02: taxa alvo de 30 FPS para o cenário principal de aula.
- RNF-03: escalabilidade validada para 40 a 50 espectadores simultâneos por sala.
- RNF-04: exposição contínua de dados de bitrate, FPS, RTT e perda de pacotes.
- RNF-05: nenhum segredo exposto ao cliente fora do estritamente necessário (HTTPS/WSS obrigatórios).
- RNF-06: interface web responsiva (desktop-first >= 1280px; mobile funcional < 768px).
- RNF-07: app desktop distribuível para Windows, macOS e Linux (electron-builder).
- RNF-08: latência ponta a ponta menor que 500ms em redes com RTT < 100ms.
- RNF-09: consumo de upload do professor fixo entre 3 e 6 Mbps.
- RNF-10: stack tecnológica homologada em Go 1.22+, Pion WebRTC, React e PostgreSQL.
- RNF-13: keepalive e heartbeat WebSocket via Ping (15s) e Pong (30s).
- RNF-14: faixa de portas UDP do SFU delimitada entre 50000 e 50100.
- RNF-15: processamento eficiente em memória com uso de CPU do backend < 15%.
- RNF-16: transmissão 100% epêmera sem gravação de vídeo/áudio em disco.
- RNF-17: sanitização estrita de XSS no chat de texto.

## 7. Regras de Negócio

- RN-01: emissão de JWT de professor após validação de senha bcrypt (TTL 8h).
- RN-02: emissão de JWT de aluno após envio de Nome e Matrícula válidos (TTL 6h).
- RN-03: isolamento de JWT por sala (`room_id` verificado em requisições WS).
- RN-04: restrição de sessão única por aluno (`4001 Duplicate Session` se a mesma matrícula reconectar).
- RN-05: apenas o professor proprietário (`owner_id`) pode gerar convites e encerrar a sala.
- RN-06: slug da sala gerado aleatoriamente no padrão legível `palavra-palavra-numero`.
- RN-07: capacidade máxima inicial de 50 alunos por sala (HTTP 429 se exceder).
- RN-08: salas encerradas (`closed`) rejeitam novas entradas com HTTP 409.
- RN-09: apenas um publisher de mídia por sala (`FORBIDDEN` para tentativas de outros participantes).
- RN-10: transmissão em tracks de áudio e vídeo independentes.
- RN-11: validade máxima de credenciais TURN de 24h geradas via HMAC-SHA1.
- RN-12: alteração da janela/tela capturada pelo professor realizada na mesma PeerConnection.
- RN-13: janela de reconexão do publisher de 30 segundos antes do encerramento da sala.
- RN-14: sequência de backoff exponencial do aluno: 1s, 2s, 4s, 8s, 16s, 30s.
- RN-15: rate limit do chat de 5 mensagens/5s e 30 mensagens/minuto por participante.
- RN-16: estouro de rate limit gera erro `CHAT_RATE_LIMITED` sem desconectar o participante.
- RN-17: mensagens vazias descartadas e tags HTML escapadas no servidor.
- RN-18: ausência de histórico retroativo de chat para novos ingressantes.

## 8. Estados e Erros

| Estado | Evento | Resultado esperado |
|---|---|---|
| Waiting | professor ainda não publicou | aluno vê estado de espera |
| Publishing | professor autorizou captura e transmite | alunos recebem mídia e áudio |
| Reconnecting | perda de conexão do professor | alunos veem alerta; timer de 30s ativo |
| Closed | sala terminada pelo professor ou por timeout | acesso à mídia é revogado; WS desconectado |
| Erro de permissão | aluno sem autorização ou token corrompido | acesso negado com 401/403 |
| Sala cheia | limite de 50 atingido | aluno recebe erro 429 |

## 9. Dados/Contratos impactados

- `contracts/auth.md` — autenticação JWT (professor e aluno);
- `contracts/room-api.md` — criação/entrada de sala, geração de link único;
- `contracts/signaling.md` — sinalização WebRTC, ICE restart, heartbeat e mensagens de chat;
- `contracts/media-session.md` — publicação/assinatura de tela e áudio, TURN credentials HMAC;
- `data-model.md` — entidades Room, Participant, ChatMessage.

## 10. Critérios de Sucesso

- uma sala com 40+ espectadores recebe tela e áudio de um único professor;
- a arquitetura não cria uma conexão upstream individual do professor para cada aluno;
- alvo operacional de 1080p/30 FPS é mensurável em uma rede adequada;
- latência ponta a ponta menor que 500ms;
- métricas permitem identificar degradação de bitrate, FPS, RTT e packet loss;
- interrupção da captura encerra a publicação sem deixar uma track órfã;
- alunos conseguem se identificar e entrar via link único sem instalação de software;
- chat entrega mensagens em tempo real com sanitização e rate limit para todos os participantes.
