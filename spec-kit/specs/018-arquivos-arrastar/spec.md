# Spec: Arrastar Arquivos para a Aba Arquivos da Sala

Status: READY
Feature ID: `018-arquivos-arrastar`
Origem: issue #46. Evolução da `003-classroom-interaction` (US-16 compartilhamento de arquivos, RF-306).

## 1. Objetivo

Na aba **Arquivos** da sala, o professor só compartilha material pelo botão "Compartilhar Novo Arquivo", que abre o
seletor do sistema e envia um arquivo por vez. Esta feature deixa o professor arrastar um ou vários arquivos do
Explorador/Finder para a aba, com envio em sequência e retorno por arquivo, sem mudar o backend nem o contrato.

Ela também impede que um arquivo solto fora da zona faça a janela do MLab navegar até ele. Hoje, no app empacotado, o
guard de navegação aceita qualquer `file://` como página do app (`apps/desktop/src/main/navigationGuard.ts`).

## 2. Escopo

### Incluído

- zona de soltar na aba Arquivos, com destaque "Solte para compartilhar" durante o arraste;
- envio sequencial de vários arquivos, com estado por arquivo (aguardando, enviando, enviado, erro);
- seleção múltipla também no botão "Compartilhar Novo Arquivo", com a mesma fila;
- pré-validação de 50 MB e de pastas no app, com o servidor ainda sendo a autoridade;
- bloqueio da navegação da janela ao soltar arquivo fora da zona (renderer e guard do main);
- rolagem automática das listas de arquivos até o último arquivo compartilhado, no mesmo padrão do chat, no web app
  do aluno e no app do professor (C-190).

### Não incluído

- bloqueio de tipos de arquivo (ex.: executáveis, resposta 415) e mudança nos headers de download (issue própria);
- mudança no backend, no contrato `003/contracts/files.md` ou em `packages/types`;
- mudança no web app dos alunos além da rolagem automática da lista de arquivos (RF-191);
- envio paralelo, barra de progresso em bytes, cancelamento e reenvio de um item;
- envio do conteúdo de pastas;
- troca automática para a aba Arquivos ao arrastar sobre outra aba;
- centralização do endereço `http://localhost:8080` usado pelos services do desktop.

## 3. Atores

- **Professor:** usa o app desktop com a sala aberta.
- **Aluno:** recebe os arquivos pelo web app (comportamento da 003, sem mudança).

## 4. User Stories

### US-181 — Arrastar arquivos para compartilhar

**Como** professor, **quero** arrastar arquivos do Explorador/Finder para a aba Arquivos, **para** compartilhar
material sem abrir o seletor arquivo por arquivo.

**Critérios de aceitação**

- Dado que a aba Arquivos está aberta, quando o professor arrasta arquivos sobre ela, então aparece a zona destacada
  "Solte para compartilhar"; ao sair da aba sem soltar, o destaque some.
- Dado que o professor solta 3 arquivos, então os 3 aparecem na lista de envio e são enviados um por vez, na ordem
  em que vieram; cada um mostra "enviando" e depois "enviado" ou o erro.
- Dado que um dos arquivos falha (ex.: 413), então só ele fica com erro e os demais continuam.
- Dado que o envio terminou com sucesso, então o arquivo entra em "Arquivos Compartilhados Nesta Aula" e os alunos o
  recebem, como no botão.

### US-182 — Soltar no lugar errado não tira o professor da sala

**Como** professor, **quero** que soltar um arquivo fora da zona não faça nada, **para** não perder a janela da sala
durante a aula.

**Critérios de aceitação**

- Dado o app empacotado, quando o professor solta um arquivo em qualquer ponto da janela fora da zona de soltar,
  então a janela continua na sala e nada é enviado.
- Dado que a aba aberta não é a de Arquivos, quando o professor solta um arquivo, então nada acontece.

### US-183 — Ver o último arquivo sem rolar a lista

**Como** aluno (e professor), **quero** que a lista de arquivos da aula role sozinha até o último arquivo
compartilhado, como o chat faz com as mensagens, **para** não precisar descer a lista a cada material novo.

**Critérios de aceitação**

- Dado que o aluno está com a lista "Arquivos da Aula" aberta (gaveta no desktop ou aba Arquivos no celular), quando
  o professor compartilha um arquivo novo, então a lista rola até ele.
- Dado que o aluno abre a lista de arquivos, então ela já mostra o último arquivo.
- Dado que o professor está na aba Arquivos, quando um envio termina, então "Arquivos Compartilhados Nesta Aula" rola
  até o arquivo enviado.

## 5. Requisitos Funcionais

- RF-181: com a aba Arquivos aberta, a área da aba aceita arquivos soltos do sistema operacional.
- RF-182: enquanto um arraste com arquivos está sobre a área, ela mostra um destaque com o texto "Solte para
  compartilhar". O destaque some ao sair da área, ao soltar ou ao cancelar o arraste. Arrastes sem arquivos (texto,
  links) não mostram o destaque.
- RF-183: os arquivos soltos entram numa fila e são enviados um por vez, na ordem recebida, pelo mesmo endpoint e
  com o mesmo campo do botão (`POST /rooms/{roomId}/files`, multipart `file`).
- RF-184: cada item da fila mostra nome e estado: `aguardando`, `enviando`, `enviado` ou `erro`, com a mensagem do
  erro. O item enviado some da lista de envio após 5 s; o item com erro fica até ser dispensado pelo professor ou até
  o próximo lote.
- RF-185: o erro de um item não interrompe a fila. A mensagem exibida é o campo `error` da resposta do servidor
  (ex.: 413 "arquivo acima do limite de 50MB", 413 "limite de arquivos da sala atingido", 403) ou "Erro ao enviar
  arquivo" quando não houver.
- RF-186: arquivo acima de 50 MB é marcado com erro "arquivo acima do limite de 50MB" sem ser enviado. Item que é
  pasta é marcado com erro "pastas não são suportadas" sem ser enviado.
- RF-187: arquivos soltos ou escolhidos durante um envio entram no fim da fila.
- RF-188: o botão "Compartilhar Novo Arquivo" continua existindo. O seletor passa a aceitar vários arquivos e usa a
  mesma fila e o mesmo retorno. Enquanto houver item `enviando`, o botão mostra "Enviando Arquivo..." e continua
  desabilitado, como hoje.
- RF-189: o arquivo enviado com sucesso entra em "Arquivos Compartilhados Nesta Aula", como no botão (003, US-16).
- RF-190: soltar arquivos fora da zona, ou com outra aba aberta, não envia nada e não muda a página da janela.
- RF-191: as listas de arquivos (web do aluno: gaveta "Arquivos da Aula" e aba Arquivos do celular; desktop do
  professor: "Arquivos Compartilhados Nesta Aula") rolam automaticamente até o último arquivo quando a quantidade de
  arquivos muda e quando a lista é aberta, no mesmo padrão do chat (marcador no fim da lista e `scrollIntoView` com
  `behavior: 'smooth'`). A ordem da lista não muda: o arquivo mais novo continua no fim.

## 6. Requisitos Não Funcionais

- RNF-181 — segurança: a janela principal e a janela do overlay só navegam para o `index.html` do próprio app (com
  qualquer query ou hash) ou, em desenvolvimento, para a origem do servidor do electron-vite. Qualquer outro
  `file://` é bloqueado e não é aberto externamente.
- RNF-182 — segurança: limites e autorização continuam no servidor (Princípio II). A pré-validação do app só evita um
  envio inútil e não substitui o 413/403 do backend.
- RNF-183 — compatibilidade: sem mudança de contrato HTTP/WebSocket, de `packages/types` ou do backend; o aluno
  recebe os arquivos como hoje. No web app muda só a rolagem da lista de arquivos (RF-191).
- RNF-184 — arquitetura: o envio HTTP fica num service do renderer, a fila num hook e a zona de soltar num componente
  de apresentação (AGENTS §6).
- RNF-185 — dependências: nenhuma dependência nova.

## 6.1 Regras de Negócio

- RN-181: os limites são os da 003 (50 MB por arquivo; 300 MB e 50 arquivos por sala), aplicados pelo servidor.
- RN-182: só o professor dono da sala envia arquivos (003, US-16); a zona de soltar existe só no app do professor.

## 7. Estados e Erros

| Estado | Evento | Resultado esperado |
|---|---|---|
| aba Arquivos aberta | arraste com arquivos entra na área | destaque "Solte para compartilhar" |
| destaque visível | arraste sai da área ou é cancelado | destaque some |
| fila vazia | solta N arquivos | N itens `aguardando`; o primeiro passa a `enviando` |
| item `enviando` | servidor responde 201 | item `enviado`; arquivo entra na lista da aula; próximo item começa |
| item `enviando` | servidor responde 413/403/400 ou falha de rede | item `erro` com a mensagem; próximo item começa |
| item aguardando > 50 MB | chega a vez dele | `erro` sem requisição |
| item é pasta | entra na fila | `erro` "pastas não são suportadas" sem requisição |
| fila em andamento | solta ou escolhe mais arquivos | entram no fim da fila |
| item `enviado` | 5 s depois | sai da lista de envio |
| item `erro` | professor dispensa ou novo lote começa | sai da lista de envio |
| qualquer | arquivo solto fora da zona ou em outra aba | nada é enviado; a janela não navega |
| lista de arquivos aberta (aluno ou professor) | chega um arquivo novo ou a lista é aberta | a lista rola até o último arquivo |

## 8. Edge Cases

- Arraste passando por elementos filhos da área: o destaque não pisca (contagem de entrada e saída).
- Soltar o mesmo arquivo duas vezes: são dois envios, como com o botão (sem deduplicação).
- Arquivo de 0 byte: é enviado; o servidor decide.
- O professor fecha a sala ou troca de aba no meio da fila: os envios em andamento terminam ou falham sem travar a
  tela; a fila não continua depois que a sala é desmontada.
- A sala já tem 50 arquivos: cada item recebe o 413 do servidor; o app não infere o limite.

## 9. Dados/Contratos impactados

- Nenhum contrato muda. `003/contracts/files.md` (POST, 201, 400/403/404/413) é consumido como está.
- `003/spec.md` (US-16) recebe uma nota de referência à 018.

## 10. Critérios de Sucesso

- Testes do guard: `file://` fora do `index.html` bloqueado e não aberto externamente; `index.html` com
  `?overlay=annotation` aceito; dev e http/https como hoje.
- Teste do bloqueio no renderer: drop com arquivos fora da zona fica com `defaultPrevented`.
- Testes do service e da fila: envio sequencial, estado `enviando`, 413 com a mensagem do servidor e a fila
  continuando, arquivo acima de 50 MB e pasta sem requisição, enfileiramento durante o envio.
- Testes da sala: destaque no arraste; drop de 1 e de 3 arquivos com estados e lista da aula; botão com seleção
  múltipla.
- Testes da rolagem: no web (gaveta e celular) e no desktop, `scrollIntoView` é chamado no marcador do fim da lista
  quando chega um arquivo novo.
- Smoke manual `A13b` no app empacotado.
- Suíte do desktop e `spec:check` verdes.

## 11. Fora de Escopo explícito

- Bloqueio de executáveis (415) e endurecimento dos headers de download: issue própria, fora da #46.
- Progresso em bytes, cancelamento, reenvio e envio paralelo.
- Envio de pastas.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma — as ambiguidades foram resolvidas em `clarify.md` (C-181 a C-190).
