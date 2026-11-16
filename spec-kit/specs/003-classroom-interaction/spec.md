# Spec: Interação em Sala de Aula

Status: READY-FOR-PLAN
Feature ID: `003-classroom-interaction`
Origem: **retroativa** — documenta funcionalidades já entregues (versões até 1.5.7) sem spec/task, conforme
`spec-kit/specs/001-screen-share-core/converge.md` §4. Esta spec descreve o comportamento observado no código e nos
testes; ela não autoriza mudanças de comportamento.

## 1. Objetivo

Registrar formalmente as ferramentas de interação e apoio didático do MLab — participação dos alunos, moderação do
chat, materiais da aula, anotação sobre a tela e privacidade da transmissão — para que passem a ter requisitos,
contratos, testes e tarefas rastreáveis.

## 2. Escopo

### Incluído

- levantar e abaixar a mão com fila ordenada;
- fixação de mensagens pelo professor;
- chat privado aluno ↔ professor;
- máscara de palavrões no chat;
- histórico de chat público para quem entra depois;
- compartilhamento de arquivos do professor com a turma;
- validação do formato da matrícula;
- transmissão do áudio interno do computador do professor;
- overlay de anotações sobre a tela, lupa (zoom) e destaque (spotlight), com atalhos;
- ocultação contextual do cursor e rastreamento nativo de janelas;
- proteção de conteúdo da janela do MLab e captura de janela para a área de transferência;
- link institucional `mlab.local` via mDNS e detecção do IP físico da rede.

### Não incluído

- persistência de chat ou arquivos após o encerramento da sala ou o reinício do app (ADR 0005);
- upload de arquivos por alunos;
- anotações feitas por alunos;
- moderação automática além da máscara de palavrões (banimento, silenciamento);
- histórico de mensagens privadas para quem entra depois.

## 3. Atores

- **Professor** — app desktop (`apps/desktop`).
- **Aluno** — navegador (`apps/web`).

## 4. User Stories

### US-11 — Levantar a mão

**Como** aluno, **quero** levantar a mão, **para** pedir a palavra sem interromper a aula.

**Critérios de aceitação**
- Somente alunos levantam a mão (`raise-hand`); professor que tenta recebe `FORBIDDEN`.
- O aluno pode abaixar a própria mão; o professor pode abaixar a mão de qualquer aluno informando `participant_id`.
- Toda mudança gera `hand-updated` e `participants-update` para a sala, com `hand_raised_at` em UTC (RFC 3339).
- O professor vê a fila ordenada por horário de levantamento (`#1`, `#2`, ...) e um aviso quando a barra lateral está fechada.
  - **Nota (017-maos-na-barra-marcacao):** fora da janela do MLab, a barra de marcação flutuante mostra a quantidade
    de mãos levantadas (ícone com número, até `9+`) e uma borda de destaque; a fila continua só dentro do MLab
    (RF-171 a RF-180 da 017).
  - **Nota (031-aviso-mao-levantada, #90):** o aviso fica acima do canvas de marcação, então "Ver Turma" e o X
    respondem ao clique com qualquer ferramenta; ele some quando a mão que mostra é abaixada pelo aluno, pelo
    professor ou pela saída do aluno, mesmo com outras mãos na fila (RF-3101 a RF-3106 da 031).

### US-12 — Fixar mensagens

**Como** professor, **quero** fixar mensagens importantes, **para** que fiquem visíveis para a turma.

**Critérios de aceitação**
- Somente o professor fixa ou desafixa (`pin-message`); outros recebem `FORBIDDEN`.
- Limite de 3 mensagens fixadas no chat público e 3 por conversa privada; acima disso, `PIN_LIMIT_REACHED`.
- Fixação pública é notificada a todos; fixação privada só ao professor e ao aluno da conversa.
- Para o aluno, mensagens fixadas são somente leitura.

### US-13 — Chat privado

**Como** aluno, **quero** mandar uma dúvida só para o professor, **para** perguntar sem expor a dúvida à turma.

**Critérios de aceitação**
- Mensagem privada de aluno é entregue somente ao(s) professor(es) da sala e ao remetente.
- Mensagem privada do professor é entregue somente ao aluno indicado em `target_id` e ao remetente.
- Mensagens privadas seguem as mesmas regras de sanitização, máscara e rate limit do chat público (RN-15, RN-16, RN-17).

### US-14 — Máscara de palavrões

**Como** professor, **quero** que palavras ofensivas sejam mascaradas, **para** preservar o ambiente acadêmico.

**Critérios de aceitação**
- O backend substitui palavras do dicionário por asteriscos antes de distribuir a mensagem, no chat público e no privado.
- A detecção cobre variações de caixa, acentuação, repetição de letras e substituições leetspeak.
- A mensagem não é bloqueada; só o trecho ofensivo é mascarado.

### US-15 — Histórico de chat para quem entra depois

**Como** aluno que entrou atrasado, **quero** ver as mensagens públicas anteriores, **para** acompanhar a conversa.

**Critérios de aceitação**
- Ao conectar, o participante recebe `chat-history` com as mensagens **públicas** da sala.
- O histórico guarda no máximo as 200 mensagens públicas mais recentes, em memória.
- Mensagens privadas não entram no histórico.
- O histórico é descartado quando a sala é encerrada ou o backend reinicia (ADR 0005).

### US-16 — Compartilhamento de arquivos

**Como** professor, **quero** enviar arquivos para a turma, **para** distribuir material da aula sem internet.

**Critérios de aceitação**
- Somente o professor dono da sala envia arquivos (multipart, campo `file`, até 50 MB por arquivo).
- Cada envio gera `file-shared` para a sala; quem entra depois recebe `files-history`.
- Alunos listam e baixam os arquivos da sala pelo navegador, inclusive no celular.
- Os arquivos ficam em memória e não sobrevivem ao reinício do backend (ADR 0005).
  - **Nota (018-arquivos-arrastar):** o professor também pode arrastar arquivos para a aba Arquivos, com envio em
    sequência e estado por arquivo; o botão aceita vários arquivos. Endpoint, limites e contrato não mudam
    (RF-181 a RF-190 da 018).
  - **Nota (024-lista-arquivos-celular):** no celular, a lista da aba Arquivos ocupa toda a altura da gaveta e rola
    dentro dela; a gaveta do desktop não muda (RF-2401 a RF-2403 da 024).

### US-17 — Validação da matrícula

**Como** professor, **quero** que a matrícula siga o padrão institucional, **para** identificar corretamente os alunos.

**Critérios de aceitação**
- A matrícula deve ter dígitos, seguidos de 1 a 4 letras (sigla do curso), seguidos de dígitos (ex.: `2025116TADS0000`, `20241INFO1234`).
- Fora do padrão, o join responde `400` e o formulário exibe o erro.

### US-18 — Áudio interno do computador

**Como** professor, **quero** transmitir o som do computador, **para** exibir vídeos e demonstrações com áudio.

**Critérios de aceitação**
- O professor ativa ou silencia o áudio interno de forma independente do microfone; o padrão é silenciado.
- O áudio interno segue na mesma PeerConnection, sem reconexão dos alunos.

### US-19 — Anotações, lupa e destaque

**Como** professor, **quero** desenhar sobre a tela e ampliar regiões, **para** guiar a atenção da turma.

**Critérios de aceitação**
- Overlay de anotação sobre a tela, inclusive fora da janela do MLab, com ferramentas: cursor, caneta, marcador, seta, retângulo e borracha; seleção exclusiva de ferramenta.
  - **Nota (#62):** em tela cheia, a janela do overlay é capturada pelo sistema: marcações, Lupa e a barra de
    marcação aparecem no vídeo dos alunos. Em janela específica, a janela do overlay não é capturada; marcações e
    Lupa entram no vídeo compostas pelo app (Lupa sob a regra da 007, RF-708) e a barra não aparece.
- Lupa com níveis de zoom cíclicos e destaque (spotlight).
  - **Nota (007-mascara-cursor-janela, C-705, RF-708):** na transmissão de janela específica, a lupa só entra no
    vídeo dos alunos quando o cursor deve aparecer (janela transmitida em foco e sob o ponteiro, US-20) ou quando foi
    posicionada no visualizador do MLab. Os traços continuam no vídeo como antes (ver #70).
- Atalhos globais: `Alt+H` (recolher), `Alt+V`, `Alt+P`, `Alt+M`, `Alt+A`, `Alt+R`, `Alt+E` (ferramentas), `Alt+L` (spotlight), `Alt+Z` (zoom), com variantes `Alt+Shift+…`.
- Duplo toque em `Ctrl` (até 600 ms entre toques, sem outra tecla combinada) alterna a lupa — **somente no Windows**; nos demais sistemas a lupa é acionada pelo botão e por `Alt+Z`.
- A barra do overlay adapta a orientação à posição na tela.
  - **Nota (017-maos-na-barra-marcacao):** com mão levantada, a barra mostra o indicador de mãos levantadas e a
    borda de destaque, expandida ou recolhida. Em tela cheia, a barra e o indicador entram no vídeo dos alunos
    (RN-171 da 017; ver a nota #62 acima).
  - **Nota (026-barra-flutuante-cantos, #78):** a barra recolhida (bolinha) e a barra aberta guardam posições
    independentes na sessão; ao expandir, a barra abre ancorada à bolinha e inteira na tela, e ao recolher a bolinha
    volta ao ponto dela.

### US-20 — Cursor contextual e rastreamento de janelas

**Como** professor, **quero** que o cursor só apareça quando faz sentido, **para** a transmissão não mostrar o ponteiro sobre o próprio MLab.

**Critérios de aceitação**
- Tela cheia: a captura vai direto ao WebRTC e o cursor **não** é ocultado sobre a área do MLab (emenda de
  2026-11-02, `007-mascara-cursor-janela`, C-702; a troca dinâmica de faixa fica como estudo futuro).
- Janela específica: o cursor só aparece quando a janela transmitida está em foco e diretamente sob o ponteiro. A
  ocultação é suspensa temporariamente quando ameaça o FPS (`007-mascara-cursor-janela`, C-701).
- O rastreamento nativo identifica a janela ativa e sinaliza quando a janela transmitida fica encoberta; em ambientes sem suporte, degrada sem erro.
- A ocultação vale também para a gravação local.
- Nota (032): com várias janelas autorizadas, o professor pode fixar uma; enquanto fixada, a transmissão não segue o
  foco e o cursor/lupa usam a janela fixada como alvo (`032-fixar-janela-transmissao`, RF-3203 e RF-3208).

### US-21 — Proteção de conteúdo e captura para a área de transferência

**Como** professor, **quero** que a janela do MLab não apareça na transmissão e que eu possa copiar uma captura da janela.

**Critérios de aceitação**
- A janela do MLab usa proteção de conteúdo durante a transmissão; o estado é mantido ao trocar de modo de captura.
- O professor copia uma captura da janela transmitida para a área de transferência.

### US-22 — Link institucional e rede local

**Como** professor, **quero** um link fixo e fácil de digitar, **para** os alunos entrarem sem copiar IPs.

**Critérios de aceitação**
- O backend anuncia `mlab.local` (e `mlab-<professor>.local`) via mDNS na porta UDP 5353; se a porta estiver ocupada, o link por IP continua funcionando.
  - **Nota (012-mdns-nome-unico):** o nome passou a ser único por backend na rede (`mlab.local`, `mlab-2.local` …
    `mlab-20.local`, o primeiro livre) e o alias `mlab-<professor>.local` deixou de ser anunciado (RF-121 a RF-126
    da 012).
- O IP anunciado é o da interface física (Ethernet/Wi-Fi), descartando adaptadores virtuais (VMware, VirtualBox, WSL, Hyper-V, Docker, ZeroTier, VPN).

## 5. Requisitos Funcionais

- RF-301: levantar/abaixar a mão com fila ordenada (US-11).
- RF-302: fixação de até 3 mensagens por escopo pelo professor (US-12).
- RF-303: chat privado aluno ↔ professor (US-13).
- RF-304: máscara de palavrões no chat público e privado (US-14).
- RF-305: histórico das 200 mensagens públicas mais recentes para novos participantes (US-15).
- RF-306: compartilhamento de arquivos do professor com listagem e download pelos alunos (US-16).
- RF-307: validação do formato da matrícula (US-17).
- RF-308: transmissão opcional do áudio interno (US-18).
- RF-309: overlay de anotação, lupa, spotlight e atalhos (US-19).
- RF-310: cursor contextual e rastreamento nativo de janelas (US-20); ocultação só no modo janela específica
  (emenda 007, C-702).
- RF-311: proteção de conteúdo e captura para área de transferência (US-21).
- RF-312: anúncio mDNS e seleção do IP físico (US-22).

## 6. Requisitos Não Funcionais

- RNF-301: chat, histórico e arquivos ficam somente em memória (ADR 0005).
- RNF-302: listagem e download de arquivos exigem token da própria sala; uso de memória por sala é limitado (a partir de `002-security-hardening`/S4).
- RNF-303: overlay e rastreamento não podem derrubar a transmissão quando o recurso nativo não estiver disponível.

## 7. Regras de Negócio

- RN-301: só alunos levantam a mão; o professor só abaixa.
- RN-302: só o professor fixa mensagens; limite 3 por escopo (público; cada conversa privada).
- RN-303: mensagem privada nunca é entregue a outro aluno.
- RN-304: o histórico (substitui a antiga RN-18 da 001) contém só mensagens públicas, no máximo 200.
- RN-305: só o professor dono da sala envia arquivos; limite de 50 MB por arquivo.
- RN-306: matrícula no formato `^[0-9]+[A-Za-z]{1,4}[0-9]+$`.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| Professor envia `raise-hand` | `error FORBIDDEN` |
| Aluno envia `pin-message` | `error FORBIDDEN` |
| 4ª mensagem fixada no mesmo escopo | `error PIN_LIMIT_REACHED` |
| Upload por não-dono | `403` |
| Upload acima de 50 MB | `400` (`413` após 002/S4) |
| Matrícula fora do padrão | `400` |

## 9. Dados/Contratos impactados

- `contracts/signaling-classroom.md` — mão, fixação, chat privado, histórico, arquivos via WebSocket.
- `contracts/files.md` — endpoints REST de arquivos.
- `contracts/desktop-ipc.md` — canais IPC do app desktop.

## 10. Critérios de Sucesso

- Todas as funcionalidades listadas continuam funcionando como na versão 1.5.7 (matriz de smoke A5, A6, A11–A16).
- Cada RF desta spec tem task com evidência (arquivo, teste ou commit).
- Lacunas de teste viram tasks explícitas.
