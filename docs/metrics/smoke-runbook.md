# Roteiro manual da matriz de smoke

Feature: `004-smoke-regression` (T407) · Matriz: Anexo A de `spec-kit/docs/plano-remediacao-speckit-seguranca.md`

Este roteiro cobre só os itens que dependem do app do professor, do app empacotado e da rede física. Os demais já
rodam sozinhos:

```bash
npm run test:smoke -w @mlab/backend
npm run test:e2e -w @mlab/web
```

Ao terminar cada item, registre o resultado em `docs/metrics/smoke-manual.json` (`"OK"`, `"FALHA"` ou `"N/E"`,
com uma observação curta e o nome do arquivo de evidência). Guarde prints ou vídeos curtos em
`docs/metrics/smoke-evidencias/` (crie a pasta). Depois rode `npm run smoke` para gerar o relatório.

## Preparação

Você precisa de: este PC com Windows, o WSL com Linux, o celular na **mesma Wi-Fi** do PC.

1. Builds:
   - Dev: `npm run dev` (abre backend, web e o app desktop).
   - Instalador Windows: `npm run make:win` → instale o `.exe` de `apps/desktop/dist/`.
     (`make:win` não altera a versão; só `npm run make` altera.)
   - Linux: `npm run make:linux:appimage` → rode o `.AppImage` no WSL (WSLg).
2. Antes de cada rodada, confira no Gerenciador de Tarefas que não sobrou `MLab.exe` nem `mlab-backend.exe`. Desde a
   feature 034 o app encerra o backend ao fechar e encerra sozinho um backend órfão do MLab na porta 8080; se sobrar
   algum processo, registre como desvio e anexe `mlab-main.log` e `mlab-backend.log`.
3. Anote no JSON qual build foi usado (dev, Windows empacotado, Linux empacotado).

Use a matrícula `2025116TADS0001` para os alunos.

---

## A1 — Professor entra por nome e chega ao Dashboard

Rodar em **dev**, **Windows empacotado** e **Linux empacotado**.

1. Abra o app.
2. Digite um nome e confirme.

**OK quando:** o Dashboard abre em menos de 10 s, sem tela de login/senha e sem erro na tela.
**FALHA quando:** aparece "sessão de professor permitida apenas pelo app" ou o Dashboard não abre.
Evidência: print do Dashboard em cada build.

## A2 — Link fixo funciona em outro dispositivo da LAN (celular)

1. No Dashboard, crie a sala e clique em copiar link.
2. Mande o link para o celular (ou digite o IP mostrado no link).
3. Abra no navegador do celular.

**OK quando:** a tela de entrada da sala abre no celular e, após nome + matrícula, mostra a página ao vivo.
Repita depois de fechar e abrir o app: o link continua o mesmo.

## A4 — Tela cheia imediata e troca para janela sem reconectar

1. Com um aluno assistindo (celular), inicie a transmissão de tela cheia.
2. Troque a fonte para uma janela específica (ex.: Bloco de Notas).

**OK quando:** o celular mostra a tela cheia em até 5 s e, após a troca, mostra só a janela, **sem** voltar para
"aguardando" e sem precisar recarregar. Rodar no Windows empacotado e no Linux empacotado (gate do sandbox).

## A5 — Múltiplas janelas, rastreamento e prevenção de oclusão

1. Transmita uma janela específica.
2. Coloque outra janela por cima dela; depois mova a janela transmitida.

**OK quando:** o aluno não vê o conteúdo da janela que ficou por cima (aviso ou bloqueio) e a transmissão continua
seguindo a janela correta.

## A6 — Microfone e áudio interno

1. Fale no microfone; depois toque um vídeo com som no PC.
2. Use mute/unmute do microfone e do áudio interno.

**OK quando:** o celular ouve voz e áudio do PC, e cada mute corta só o áudio correspondente.
Rodar também no Linux empacotado.

## A7 — Perfis 1080p 30 e 60 fps

1. Selecione 30 fps, transmita 30 s; troque para 60 fps, transmita 30 s.

**OK quando:** a troca funciona sem reconectar e o vídeo segue fluido no celular. Anote o FPS mostrado nas
métricas do app, se houver.

## A8 — Gravação local .webm e .mp4

1. Grave 20 s em `.webm`, pause, retome e salve pelo diálogo.
2. Repita em `.mp4`.

**OK quando:** os dois arquivos abrem num player e têm a duração esperada (sem o trecho pausado).

## A11 — Overlay de anotações e lupa

1. Abra o overlay de marcações fora do app e desenhe sobre outra janela.
2. Ative a lupa pelo botão e depois com duplo Ctrl.
3. Transmita em tela cheia e saia da janela do MLab para a barra flutuante aparecer; depois repita transmitindo uma
   janela específica.

**OK quando:** as marcações aparecem para o aluno, a lupa liga e desliga pelos dois caminhos e as ferramentas
não ficam selecionadas ao mesmo tempo. Em tela cheia a barra flutuante aparece no vídeo do aluno; em janela
específica a barra não aparece e as marcações continuam visíveis (003, US-19, nota #62).

## A12 — Cursor contextual, proteção de conteúdo e captura para a área de transferência

1. Transmita uma janela; passe o cursor por dentro e por fora dela.
   - Com a janela transmitida em foco, o cursor sobre ela deve aparecer para o aluno.
   - Arraste outra janela (ou o próprio MLab) por cima de parte da janela transmitida e passe o cursor sobre essa
     parte: o cursor **não** deve aparecer para o aluno (007, RF-701).
   - Clique no MLab (a janela transmitida perde o foco) e passe o cursor sobre a janela transmitida: o cursor não
     deve aparecer.
   - Em tela cheia o cursor aparece também sobre a área do MLab: comportamento esperado (007, C-702).
   - Ligue a lupa (`Alt+Z`) com a janela transmitida em foco: ela aparece para o aluno e acompanha o ponteiro. Foque
     outra janela (ou o MLab) com a lupa ligada, com o ponteiro longe e depois sobre a área da janela transmitida: a
     lupa **não** deve aparecer para o aluno; um traço já desenhado continua visível (007, RF-708, #70).
2. Ligue a proteção de conteúdo; tente tirar print da janela do app com Win+Shift+S.
3. Use "capturar para a área de transferência" e cole no Paint.

**OK quando:** o cursor e a lupa só aparecem para o aluno quando a janela transmitida está em foco e sob o ponteiro,
sem mancha visível onde o cursor foi apagado, o print da janela do app sai preto
com a proteção ligada, e a captura cola corretamente.

## A13b — Arrastar arquivos para a aba Arquivos

Requer MLab **1.12.0 ou posterior** (feature 018), no **instalador Windows** (`npm run make:win`): a navegação por
arquivo solto só acontecia no app empacotado. Um aluno no celular, na sala.

Prepare na Área de Trabalho: 5 arquivos pequenos (ex.: PDF, DOCX, PNG, TXT, ZIP), um arquivo **acima de 50 MB** e uma
pasta qualquer.

1. Abra a sala, inicie a transmissão e abra **Chat & Turma → Arquivos**.
2. Arraste **1** PDF do Explorador sobre a aba: aparece a zona tracejada "Solte para compartilhar". Tire o arquivo de
   cima da aba sem soltar: o destaque some.
3. Solte o PDF na aba: o item mostra "Enviando..." e depois "Enviado"; o arquivo entra em "Arquivos Compartilhados
   Nesta Aula", o contador da aba sobe e, uns 5 s depois, o item some da lista de envio.
4. Selecione os **5** arquivos e solte de uma vez: eles são enviados um por vez, na ordem, cada um com o próprio
   estado; o botão mostra "Enviando Arquivo..." enquanto isso.
5. Solte juntos o arquivo **> 50 MB**, a **pasta** e um arquivo pequeno: o grande mostra "arquivo acima do limite de
   50MB", a pasta mostra "pastas não são suportadas" e o pequeno é enviado. Dispense os dois erros pelo `×`.
6. Solte um PDF **fora** da aba (sobre a prévia da transmissão, o cabeçalho ou outra aba da barra lateral): nada é
   enviado e a janela **continua na sala** (não abre o PDF).
7. Clique em "Compartilhar Novo Arquivo" e escolha 2 arquivos com `Ctrl`: os dois são enviados pela mesma fila.
8. Saia do MLab clicando em outra janela e confira que a barra de marcação flutuante continua aparecendo (o guard de
   navegação novo não bloqueia o overlay).
9. No celular, o aluno vê os arquivos em "Arquivos da aula" e baixa pelo menos um.

**OK quando:** o destaque aparece só com arquivos sobre a aba, os envios seguem em ordem com estado por arquivo, os
limites mostram as mensagens acima, soltar fora da zona não tira a janela da sala, a barra de marcação abre e o
aluno recebe os arquivos.

## A15b — Mãos levantadas na barra de marcação (fora do MLab)

Requer MLab **1.11.0 ou posterior** (feature 017) e pelo menos dois alunos (celular e outro navegador ou aba anônima).

1. Transmita uma **janela** específica e clique nela, para o MLab perder o foco: a barra de marcação flutuante
   aparece, sem ícone de mão e com a borda azul de sempre.
2. Aluno 1 levanta a mão: a barra ganha a borda amarela e o ícone de mão com `1`. Passe o mouse no ícone: o
   tooltip diz "Mãos levantadas: 1". Na barra não aparece nenhum texto sobre mãos.
3. Aluno 2 levanta a mão: o número vai a `2`. Clique no ícone: nada acontece (a ferramenta e a barra não mudam).
4. Recolha a barra (`Alt+H` ou o botão): a borda amarela e o ícone com `2` continuam, abaixo do botão redondo.
5. Volte ao MLab e abaixe a mão do aluno 1 pela fila; saia do MLab de novo: a barra mostra `1`.
6. Aluno 2 sai da sala (fecha a aba): a borda amarela e o ícone somem.
7. Repita os passos 2 e 6 transmitindo a **tela cheia** e olhe o vídeo no celular de um aluno: registre se a barra,
   a borda e o número aparecem para os alunos (esperado em tela cheia, RN-171 da 017) e confirme que **não**
   aparecem transmitindo uma janela específica.
8. Opcional: com 10 alunos ou mais com a mão levantada, o número mostra `9+` e o tooltip, o número real.
9. Linux (se houver): com o ícone presente, os botões da barra continuam clicáveis e o clique fora dela atravessa
   para a janela de baixo (regressão da 009).

**OK quando:** o número acompanha a fila do MLab em todos os passos, a borda e o ícone somem com zero mãos, o
número é legível nas barras expandida e recolhida e o clique no ícone não faz nada. O item 7 só registra o que
acontece no vídeo; não reprova o item.

## A16 — Acesso por `mlab.local` e por IP (celular)

1. No celular, abra `http://mlab.local:8080` (ou o link `mdns_link` mostrado no app).
2. Abra também pelo IP (`ip_link`).

**OK quando:** os dois abrem a sala num Android 12+ com Chrome (obrigatório) e num iPhone com Safari (se houver;
senão "N/E"). Registre o modelo e a versão do sistema de cada aparelho.

Fora de escopo (registre "N/E" com o motivo e confirme que o IP funciona): Firefox, que não resolve `.local`;
Android anterior ao 12; Wi-Fi com isolamento de clientes ou filtro de mDNS na controladora (comum em rede
corporativa/escolar).

Se `mlab.local` não abrir num aparelho dentro do escopo, faça o diagnóstico antes de registrar falha:

1. No PC do professor: `Resolve-DnsName mlab.local -Type A` deve devolver o IP do link `ip_link`. Se houver `dig`
   (ex.: no WSL na mesma rede), `dig -p 5353 @224.0.0.251 mlab.local` simula a consulta do Android e deve responder.
2. Log do backend: precisa ter `[mDNS] Servidor mDNS ativo ... (Interface: Wi-Fi|Ethernet)`. Interface virtual
   (VMware, Hyper-V, WSL) ou aviso de porta 5353 indica problema no PC, não no celular.
3. Firewall do Windows: o backend precisa receber UDP 5353 no perfil de rede ativo (se a rede estiver como
   "Pública", libere o app nesse perfil).
4. Se o IP abre e os itens 1 a 3 estão ok, a rede provavelmente bloqueia multicast entre clientes: registre como
   fora de escopo, com o nome da rede.

## A16b — Dois professores na mesma rede (`mlab.local` e `mlab-2.local`)

Requer dois PCs com MLab **1.10.0 ou posterior** na mesma Wi-Fi (antes da 1.10.0 todo backend anuncia `mlab.local`;
antes da 1.9.1 o backend nem responde à sondagem) e um celular Android 12+ com Chrome (iPhone com Safari, se houver).

1. PC 1: crie uma sala. O Dashboard mostra o Link Fixo `http://mlab.local:8080`.
2. PC 2: crie outra sala. O Dashboard mostra `http://mlab-2.local:8080`. No log do backend do PC 2:
   `[mDNS] Nomes já em uso na rede: mlab.local=<IP do PC 1>; escolhido mlab-2.local`.
3. No PC 2: `Resolve-DnsName mlab-2.local -Type A` devolve o IP do PC 2, e `Resolve-DnsName mlab.local -Type A`
   devolve o do PC 1.
4. No celular, abra os dois links: cada um abre a sala do próprio professor.
5. Conflito: encerre as duas salas e crie-as ao mesmo tempo nos dois PCs. Em até ~10 s, um dos apps passa a mostrar
   `mlab-2.local` com o aviso "O link fixo da sala mudou…" (o PC de IP maior cede o nome).

**OK quando:** os dois professores veem links diferentes, cada link abre a própria sala no celular, e o conflito
termina com nomes diferentes e aviso no app que trocou. Fora de escopo e diagnóstico: os mesmos do A16.

## A17 — Acesso via ngrok

Sem conta ngrok: registre `"N/E"` com a justificativa "sem conta ngrok" (C-404).

Com conta:
1. `ngrok http 8080` e copie a URL `https://...ngrok-free.app`.
2. Inicie o app com `NGROK_URL=<url>`.
3. Abra a URL no celular **com o Wi-Fi desligado** (rede móvel).

**OK quando:** o aluno entra e assiste pela rede móvel.

## Confirmação em celular real (A10, A13, A15)

Os testes automáticos já cobrem esses itens em emulação mobile. No celular real, confirme:

- A10: o vídeo aparece; se aparecer "Clique para Ativar Som", o som liga ao tocar; tela cheia funciona.
- A13: "Arquivos da aula" lista o arquivo enviado e o download abre no celular.
- A15: "Levantar mão" aparece no professor como toast/fila e o professor consegue abaixar.

---

## Gate do sandbox (C-203)

Se A1, A4, A6, A11 ou A12 falharem **só** no app empacotado e o erro apontar para o preload/sandbox (por exemplo
`window.electronAPI` indefinido ou recurso nativo sem resposta), reverta só o commit `fc9f628`, gere o build de
novo, repita o item e registre a exceção em `spec-kit/specs/002-security-hardening/converge.md`.
