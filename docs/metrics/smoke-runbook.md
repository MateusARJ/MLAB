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
2. Feche qualquer instância antiga do MLab antes de cada rodada (o app sobe o backend na porta 8080).
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

**OK quando:** as marcações aparecem para o aluno, a lupa liga e desliga pelos dois caminhos e as ferramentas
não ficam selecionadas ao mesmo tempo.

## A12 — Cursor contextual, proteção de conteúdo e captura para a área de transferência

1. Transmita uma janela; passe o cursor por dentro e por fora dela.
2. Ligue a proteção de conteúdo; tente tirar print da janela do app com Win+Shift+S.
3. Use "capturar para a área de transferência" e cole no Paint.

**OK quando:** o cursor só aparece para o aluno dentro da janela transmitida, o print da janela do app sai preto
com a proteção ligada, e a captura cola corretamente.

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
