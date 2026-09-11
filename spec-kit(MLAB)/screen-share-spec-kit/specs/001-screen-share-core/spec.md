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
- alunos se identificando com Nome Completo e Matrícula;
- alunos acessando via link único gerado pelo professor;
- alunos entrando como espectadores via navegador web;
- transmissão de uma única tela do professor para múltiplos alunos;
- chat de texto em tempo real para todos os participantes da sala (estilo Jitsi);
- estado de sala e presença básica;
- tratamento de perda de conexão e encerramento da transmissão;
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

- Ao criar a sala, o professor recebe um identificador único e um link de acesso.
- A sala inicia em estado aguardando transmissão.
- O professor pode copiar o link facilmente da interface.

### US-03 — Iniciar compartilhamento de tela e áudio

**Como** professor, **quero** selecionar minha tela/janela e iniciar a transmissão com áudio, **para** que os alunos possam acompanhar a aula.

**Critérios de aceitação**

- O app usa `desktopCapturer` (Electron) para capturar a tela.
- O professor pode ativar/desativar o microfone durante a transmissão.
- A transmissão de tela e áudio segue em paralelo pelo mesmo fluxo WebRTC.
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
- O áudio do professor é reproduzido automaticamente (respeitando políticas do navegador).
- O encerramento da transmissão é refletido para os alunos.

### US-06 — Escala da sala

**Como** professor, **quero** transmitir para uma turma de 40 ou mais alunos, **sem** precisar manter uma conexão P2P independente para cada aluno.

**Critérios de aceitação**

- A arquitetura de mídia usa SFU (Pion WebRTC).
- O professor publica uma única upstream de mídia (tela + áudio).
- A distribuição é feita pela SFU para todos os espectadores.
- O limite operacional inicial é 50 participantes por sala (configurável).

### US-07 — Chat de texto em tempo real

**Como** participante, **quero** enviar e receber mensagens de texto na sala, **para** comunicar dúvidas ou comentários sem interromper a transmissão.

**Critérios de aceitação**

- Todos os participantes (professor e alunos) podem enviar e ler mensagens.
- Mensagens exibem o nome e papel (professor/aluno) do remetente.
- Mensagens chegam em tempo real via WebSocket.
- O chat é acessível na interface web e no app desktop.

### US-08 — Recuperação de conexão

**Como** aluno, **quero** que uma perda temporária de conexão seja tratada sem quebrar a sala, **para** voltar a receber a transmissão quando possível.

**Critérios de aceitação**

- O cliente sinaliza o estado de reconexão.
- Quando a sessão puder ser recuperada, a mídia volta a aparecer sem criar uma segunda sala.

## 5. Requisitos Funcionais

- RF-01: o sistema deve identificar o papel do participante (professor/aluno).
- RF-02: somente o professor autorizado pode publicar a tela da sala.
- RF-03: alunos devem possuir permissão apenas de espectador por padrão.
- RF-04: a captura no app desktop deve usar `desktopCapturer` (Electron API).
- RF-05: a transmissão deve usar WebRTC via SFU (Pion).
- RF-06: a topologia deve usar SFU para distribuição a múltiplos alunos.
- RF-07: o sistema deve sinalizar estado de sala e de transmissão via WebSocket.
- RF-08: o sistema deve registrar métricas mínimas de qualidade da sessão.
- RF-09: o sistema deve suportar chat de texto em tempo real via WebSocket para todos os participantes.
- RF-10: o professor deve poder transmitir áudio do microfone junto com a tela.
- RF-11: o aluno deve informar Nome Completo e Matrícula ao entrar na sala.
- RF-12: o professor deve se autenticar com credenciais no app desktop.
- RF-13: o professor deve poder gerar um link único de acesso à sala para os alunos.

## 6. Requisitos Não Funcionais

- RNF-01: resolução alvo de até 1920×1080.
- RNF-02: taxa alvo de 30 FPS para o cenário principal de aula.
- RNF-03: a arquitetura deve ser validada com pelo menos 40 espectadores simultâneos.
- RNF-04: a sessão deve expor dados de bitrate, FPS, RTT e perda de pacotes para diagnóstico.
- RNF-05: nenhum segredo deve ser exposto ao cliente fora do que for estritamente necessário para a sessão.
- RNF-06: a web app dos alunos deve ser responsiva (desktop-first ≥1280px; mobile funcional <768px).
- RNF-07: o app desktop deve ser distribuível para Windows, macOS e Linux.

## 7. Estados e Erros

| Estado | Evento | Resultado esperado |
|---|---|---|
| Aguardando | professor ainda não publicou | aluno vê estado de espera |
| Publicando | professor autorizou captura e transmite | alunos recebem mídia e áudio |
| Áudio mudo | professor desativou microfone | alunos recebem vídeo sem áudio |
| Interrompida | professor para a captura | alunos recebem estado encerrado |
| Reconectando | transporte perdeu conectividade | cliente informa reconexão |
| Encerrada | sala terminada | acesso à mídia é revogado |
| Erro de permissão | aluno sem autorização | acesso é negado claramente |
| Sala cheia | limite de 50 atingido | aluno recebe erro com mensagem clara |

## 8. Edge Cases

- professor cancela o diálogo de seleção da tela;
- professor fecha a janela compartilhada;
- professor desativa o microfone durante a transmissão;
- aluno entra antes de o professor iniciar;
- aluno entra durante a transmissão;
- professor perde conectividade;
- SFU fica temporariamente indisponível;
- aluno perde conectividade;
- dois usuários tentam assumir a função de professor;
- sala atingiu o limite configurado (50 por padrão);
- token inválido ou expirado;
- aluno tenta entrar com campos de identificação vazios;
- link único inválido ou sala encerrada.

## 9. Dados/Contratos impactados

- `contracts/auth.md` — autenticação JWT (professor e aluno);
- `contracts/room-api.md` — criação/entrada de sala, geração de link único;
- `contracts/signaling.md` — sinalização WebRTC e eventos de chat;
- `contracts/media-session.md` — publicação/assinatura de tela e áudio;
- `data-model.md` — entidades Room, Participant, ChatMessage.

## 10. Critérios de Sucesso

- uma sala com 40+ espectadores pode receber a tela e o áudio de um único professor;
- a arquitetura não cria uma conexão upstream individual do professor para cada aluno;
- alvo operacional de 1080p/30 FPS é mensurável em uma rede adequada;
- métricas permitem identificar degradação de bitrate, FPS, RTT e packet loss;
- interrupção da captura encerra a publicação sem deixar uma track órfã;
- alunos conseguem se identificar e entrar via link único sem instalação de software;
- chat entrega mensagens em tempo real para todos os participantes da sala.

## 11. Perguntas que bloqueavam a implementação

- [x] Qual mecanismo de autenticação será usado na primeira versão? → JWT (C-01 CLOSED).
- [x] O limite máximo inicial de participantes será fixo ou configurável? → 50, configurável (C-02 CLOSED).
- [x] A SFU será implementada diretamente com Pion ou baseada em um servidor SFU externo? → Pion (C-03 CLOSED).
- [x] O TURN será obrigatório no primeiro deploy? → Sim (C-04 CLOSED).
- [x] Estrutura do repositório? → Monorepo Turborepo (C-05 CLOSED).
- [x] Framework do app desktop? → Electron (C-06 CLOSED).
