# Spec: Bloqueio de Executáveis no Upload e Headers de Download

Status: READY
Feature ID: `022-bloqueio-executaveis-upload`
Origem: issue #64. É o escopo retirado da #46 por decisão do responsável (`018-arquivos-arrastar/clarify.md`, C-181).

## 1. Objetivo

Impedir que o professor compartilhe, por engano ou por arquivo adulterado, programas que o sistema do aluno executa
com um duplo clique. Fazer o servidor decidir os headers do download em vez de repetir o que o cliente declarou
(AGENTS §8: nunca confiar em dados enviados pelo navegador ou pelo app desktop).

## 2. Contexto

Verificado em 2026-11-12 na `development` @ `3010573`:

- `uploadFile` (`apps/backend/internal/room/files.go`) checa papel, dono e tamanho, mas não o tipo. Um `.exe`
  recebe 201, e o aluno o vê e o baixa.
- O `Content-Type` salvo é o da parte multipart enviada pelo cliente (`header.Header.Get("Content-Type")`), e o
  download o devolve como veio.
- O `Content-Disposition` é `attachment; filename=%q` (escape do Go). Não tem `filename*` (RFC 6266/5987), então
  nomes acentuados podem chegar diferentes ao aluno.
- O download já envia `X-Content-Type-Options: nosniff`.
- A web dos alunos não usa `content_type`: só lista e baixa com `<a download>`.
- Todo envio do desktop passa pela fila `useRoomFileUploads.enqueue` (018), que já pré-valida pastas e o limite de
  50 MB.

## 3. Escopo

### Incluído

- recusar no upload (415) os executáveis e instaladores, por extensão e por assinatura binária;
- `Content-Type` definido pelo servidor a partir da extensão, já no upload;
- `Content-Disposition` RFC 6266 com `filename` ASCII e `filename*` UTF-8;
- `Content-Security-Policy: sandbox` e `Cache-Control: no-store` no download, mantendo o `nosniff`;
- pré-validação de extensão no desktop, com a mesma mensagem do servidor.

### Não incluído

- bloquear código-fonte (`.js`, `.ts`, `.py`, `.sh`, `.jar`, `.java`, `.c` e afins): é material de aula de
  programação;
- inspecionar o conteúdo de arquivos compactados (`.zip`, `.rar`, `.7z`);
- antivírus ou análise de malware;
- aviso de download inseguro por HTTP (#47);
- mudanças na web dos alunos e nos eventos WebSocket.

## 4. Atores

- **Professor:** envia arquivos pela aba Arquivos da sala (botão ou arrastar).
- **Aluno:** lista e baixa os arquivos no navegador.

## 5. User Stories

### US-2201 — Executável recusado no envio

Como professor, quero que o MLab recuse executáveis e instaladores, para não distribuir à turma um programa que roda
com um duplo clique.

- Dado um `.exe`, `.msi`, `.bat` ou outro tipo bloqueado, quando o envio, então o item da fila mostra a mensagem de
  bloqueio, o arquivo não é enviado e os demais itens seguem.
- Dado um executável renomeado (por exemplo `notas.pdf` com conteúdo de `.exe`), quando o envio, então o servidor
  responde 415 e o item mostra a mesma mensagem.
- Dado um arquivo de código-fonte (`.py`, `.js`, `.ts`, `.sh`, `.java`), quando o envio, então ele é aceito como
  hoje.

### US-2202 — Download com headers definidos pelo servidor

Como aluno, quero baixar os arquivos com o nome correto e sem que o navegador os execute, para abrir o material com
segurança.

- Dado um arquivo `revisão-ação.pdf`, quando o baixo, então o arquivo salvo se chama `revisão-ação.pdf`.
- Quando o baixo, então a resposta é sempre `attachment`, com o `Content-Type` decidido pelo servidor, `nosniff`,
  `Content-Security-Policy: sandbox` e `Cache-Control: no-store`.

## 6. Requisitos Funcionais

- RF-2201: o servidor recusa com **415** e
  `{"error": "tipo de arquivo bloqueado: executáveis e instaladores não podem ser compartilhados"}` o upload cuja
  extensão está na lista de bloqueio. A comparação ignora maiúsculas e minúsculas e também pontos e espaços no fim do
  nome (`setup.EXE`, `setup.exe.`, `setup.exe `). A lista está em C-2202.
- RF-2202: o servidor recusa com a mesma resposta o upload cujo conteúdo começa com uma assinatura de executável
  nativo, qualquer que seja a extensão:
  - PE/DOS: `MZ`;
  - ELF: `\x7fELF`;
  - Mach-O: `FE ED FA CE`, `FE ED FA CF`, `CE FA ED FE` e `CF FA ED FE`.
- RF-2203: o arquivo recusado não é guardado, não entra na listagem e não gera `file-shared`.
- RF-2204: o `content_type` guardado e devolvido no upload e na listagem é definido pelo servidor a partir da
  extensão, pelo mapa de C-2203. Fora do mapa, vale `application/octet-stream`. O `Content-Type` da parte multipart é
  ignorado.
- RF-2205: o download responde com:
  - `Content-Type` = o `content_type` do servidor (RF-2204);
  - `Content-Disposition: attachment; filename="<nome ASCII>"; filename*=UTF-8''<nome codificado>` (RFC 6266/5987),
    em que o nome ASCII troca cada caractere fora de ASCII imprimível, `"` e `\` por `_`;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Security-Policy: sandbox`;
  - `Cache-Control: no-store`.
- RF-2206: o desktop marca como erro, sem enviar, o arquivo cuja extensão está na lista de bloqueio, com a mesma
  mensagem do servidor. É a pré-validação no padrão da 018/RF-186.
- RF-2207: o desktop mostra no item da fila a mensagem do 415 recebida do servidor (comportamento da 018/RF-185, agora
  coberto por teste).

## 7. Requisitos Não Funcionais

- RNF-2201 — segurança: a decisão de bloqueio e os headers ficam no servidor (AGENTS §8). A pré-validação do desktop
  só antecipa a mensagem.
- RNF-2202 — compatibilidade: o payload de upload, de listagem e dos eventos WebSocket não muda de forma. O 415 é um
  código de erro novo no contrato. A web dos alunos não muda.
- RNF-2203 — dependências: nenhuma dependência nova (Go stdlib e o que o desktop já usa).
- RNF-2204 — desempenho: a checagem de assinatura lê só os primeiros bytes do conteúdo que já está em memória.

## 7.1 Regras de Negócio

- RN-2201: a lista de extensões bloqueadas e a mensagem são as mesmas no backend e no desktop.
- RN-2202: código-fonte e arquivos compactados não são bloqueados.

## 8. Estados e Erros

| Estado | Evento | Resultado |
|---|---|---|
| Item na fila do desktop | extensão bloqueada | item `erro` com a mensagem, sem requisição (RF-2206) |
| Upload recebido | extensão bloqueada | 415 + mensagem (RF-2201) |
| Upload recebido | assinatura de executável | 415 + mensagem (RF-2202) |
| Upload recebido | tipo permitido | 201 com `content_type` do servidor (RF-2204) |
| Download | arquivo existente | 200 com os headers de RF-2205 |

## 9. Edge Cases

- Nome sem extensão (`Makefile`, `LEIAME`): aceito, com `application/octet-stream`, salvo se tiver assinatura de
  executável.
- Extensão dupla (`trabalho.pdf.exe`): vale a última, então é bloqueado.
- Arquivo de texto que por acaso começa com `MZ`: é recusado. O risco é aceito, porque um texto assim é raro e o
  professor pode compactá-lo.
- Arquivo vazio: aceito. Não há assinatura a checar.
- Nome com caracteres não ASCII (`ação.pdf`): cada caractere (não cada byte) vira `_` no fallback,
  `filename="a__o.pdf"`, e `filename*=UTF-8''a%C3%A7%C3%A3o.pdf` preserva o nome.

## 10. Dados/Contratos impactados

- `003-classroom-interaction/contracts/files.md`: 415 no POST; `content_type` definido pelo servidor; headers do
  download.
- Nenhuma mudança em `packages/types`, nos eventos WebSocket nem na web.

## 11. Critérios de Sucesso

- Testes Go: 415 para cada extensão bloqueada e para cada assinatura; 201 para documentos, imagens e código-fonte;
  arquivo bloqueado fora da listagem; headers do download com nome acentuado; `Content-Type` falso do cliente
  ignorado.
- Testes do desktop: pré-validação da extensão e exibição do 415.
- Smoke manual: `.exe`, `.bat` e `.exe` renomeado recusados; `revisão-ação.pdf` baixado com o nome certo no navegador
  do aluno.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma — respondidas em `clarify.md` (C-2201 a C-2207).
