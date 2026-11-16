# Spec: Mãos Levantadas na Barra de Marcação

Status: READY
Feature ID: `017-maos-na-barra-marcacao`
Origem: issue #45. Evolução da `003-classroom-interaction` (US-11 levantar a mão, US-19 barra de marcação).
Desvio relacionado: #62 (comentário do preload diz que o overlay é invisível na captura).

## 1. Objetivo

Quando um aluno levanta a mão, o professor só fica sabendo se estiver olhando a janela do MLab: a contagem aparece no
botão "Chat & Turma", na aba da turma e na fila da barra lateral. Durante a aula, porém, o professor costuma estar na
janela que transmite ou na tela cheia que compartilha, e aí não há nenhum sinal.

É justamente nesse momento que a barra de marcação flutuante aparece (MLab fora de foco). Esta feature faz a barra
mostrar que há mãos levantadas e quantas são, para o professor perceber sem voltar ao MLab.

## 2. Escopo

### Incluído

- indicador de mãos levantadas (ícone de mão com número) na barra de marcação flutuante, expandida e recolhida;
- borda de destaque na barra enquanto houver mão levantada;
- descrição acessível do indicador (`title` e `aria-label`);
- atualização do indicador em tempo real, acompanhando a mesma contagem da fila do painel da turma;
- envio da quantidade da janela do MLab para a janela da barra, com registro no contrato IPC do desktop.

### Não incluído

- notificação do sistema operacional, som, `flashFrame` e badge no ícone da barra de tarefas;
- ação ao clicar no indicador (ex.: abrir o MLab com a fila);
- nomes, matrículas ou ordem da fila na barra;
- mudança nos avisos que já existem dentro da janela do MLab;
- esconder a barra de marcação (ou o indicador) do vídeo transmitido em tela cheia;
- backend, web app dos alunos e protocolo `raise-hand`/`hand-updated`.

## 3. Atores

- **Professor:** usa o app desktop durante a transmissão, fora da janela do MLab.
- **Aluno:** levanta e abaixa a mão pelo web app (comportamento da 003, sem mudança).

## 4. User Stories

### US-171 — Saber que há mãos levantadas fora do MLab

**Como** professor transmitindo fora da janela do MLab, **quero** ver na barra de marcação quantas mãos estão
levantadas, **para** atender os alunos sem precisar voltar ao MLab para conferir.

**Critérios de aceitação**

- Dado que a barra flutuante está visível e nenhum aluno está com a mão levantada, quando um aluno levanta a mão,
  então a barra ganha a borda de destaque e mostra o ícone de mão com o número `1`.
- Dado que há 3 mãos levantadas, quando um aluno abaixa a mão, então o número passa a `2`.
- Dado que há 1 mão levantada, quando o professor abaixa essa mão pela fila, ou o aluno sai da sala, então a borda e
  o indicador somem.
- Dado que a barra está recolhida, quando há mão levantada, então a borda de destaque e o indicador aparecem também
  na barra recolhida.

### US-172 — Indicador discreto e acessível

**Como** professor, **quero** que o aviso seja só o ícone e o número, **para** a barra continuar compacta e sem
texto sobre a área que transmito.

**Critérios de aceitação**

- A barra não mostra texto visível sobre mãos levantadas; só o ícone e o número.
- Ao passar o mouse sobre o indicador, o professor lê "Mãos levantadas: N"; leitores de tela anunciam o mesmo texto.
- Acima de 9 mãos, o número exibido é `9+`, e a descrição informa o número real.

## 5. Requisitos Funcionais

- RF-171: com pelo menos uma mão levantada, a barra de marcação flutuante mostra um ícone de mão com um badge
  numérico com a quantidade de mãos levantadas. Vale para a barra expandida e para a recolhida, sempre dentro da
  própria barra.
- RF-172: enquanto houver pelo menos uma mão levantada, a borda da barra (expandida ou recolhida) muda para uma cor de
  destaque, diferente da borda normal. A borda é fixa: sem piscar nem pulsar.
- RF-173: o badge mostra `1` a `9`; a partir de 10, mostra `9+`.
- RF-174: o indicador tem `title` e `aria-label` "Mãos levantadas: N", com N sendo a quantidade real (também acima
  de 9). Nenhum outro texto visível sobre mãos levantadas aparece na barra.
- RF-175: com zero mãos levantadas, o ícone, o badge e a borda de destaque não aparecem, e a barra fica igual à atual.
- RF-176: a quantidade é a mesma da fila "Mãos Levantadas" do painel da turma no MLab: alunos com a mão levantada
  entre os participantes da sala. Ela muda quando o aluno levanta ou abaixa a mão, quando o professor abaixa a mão de
  um aluno e quando o aluno sai da sala.
- RF-177: o indicador só informa: clicar nele não troca de ferramenta, não recolhe nem expande a barra e não abre o
  MLab.
- RF-178: o indicador segue a visibilidade atual da barra flutuante: aparece sempre que a barra aparece (MLab fora
  de foco, ou durante o arraste), em qualquer janela onde o professor esteja, transmitida ou não.
- RF-179: a janela do MLab envia à barra só a quantidade de mãos levantadas. Nomes, matrículas e identificadores de
  participantes não saem da janela do MLab.
- RF-180: dentro da janela do MLab nada muda: os badges do botão "Chat & Turma", da aba da turma e a fila continuam
  como hoje (003, US-11).

## 6. Requisitos Não Funcionais

- RNF-171 — desempenho: uma mudança de quantidade não reenvia traços nem o estado de marcação, e não altera o
  caminho do vídeo transmitido.
- RNF-172 — segurança: a quantidade só é aceita quando vem da janela do MLab; a barra de marcação não consegue
  alterá-la. Valor inválido (não inteiro, negativo ou não numérico) é descartado, e o indicador mantém o último valor
  válido.
- RNF-173 — Linux: no Linux, a área que recebe cliques na barra (009, RF-902) continua cobrindo a barra inteira com
  o indicador; nenhuma parte do indicador fica fora dela.
- RNF-174 — legibilidade: o número do badge é legível com 1 e com 2 caracteres (`9+`) sobre o fundo escuro da barra.
- RNF-175 — dependências: nenhuma dependência nova; o ícone vem do pacote de ícones já usado pelo desktop.

## 6.1 Regras de Negócio

- RN-171: no modo **tela cheia**, a barra de marcação já aparece no vídeo dos alunos, porque o overlay é capturado
  pelo sistema (ver #62). Com esta feature, a borda de destaque e o número de mãos também aparecem. O comportamento é
  aceito: o indicador não mostra nomes, e os alunos já sabem quando levantaram a mão. No modo **janela específica**, a
  barra não entra no vídeo.
- RN-172: a fila e a ação de abaixar a mão continuam só dentro do MLab; a barra é um aviso, não uma segunda fila.

## 7. Estados e Erros

| Estado | Evento | Resultado esperado |
|---|---|---|
| 0 mãos, barra visível | aluno levanta a mão | borda de destaque, ícone e badge `1` |
| N mãos | aluno levanta a mão | badge N+1 |
| N ≥ 2 mãos | aluno abaixa, professor abaixa ou aluno sai | badge N−1 |
| 1 mão | aluno abaixa, professor abaixa ou aluno sai | borda, ícone e badge somem |
| 9 mãos | aluno levanta a mão | badge `9+`; descrição "Mãos levantadas: 10" |
| N ≥ 1, barra oculta (MLab em foco) | qualquer mudança | barra continua oculta; ao reaparecer, mostra a quantidade atual |
| N ≥ 1, barra expandida | professor recolhe a barra | borda e indicador continuam na barra recolhida |
| N ≥ 1 | janela da barra recriada (troca de fonte ou de modo) | indicador volta com a quantidade atual |
| qualquer | sessão ao vivo encerrada | barra sai; numa nova sessão, o indicador começa da quantidade real da sala |
| qualquer | valor inválido recebido | descartado; indicador mantém o último valor válido |

## 8. Edge Cases

- Vários alunos levantam a mão quase ao mesmo tempo: o número final é igual ao da fila no MLab.
- O professor arrasta a barra para o topo, a base ou as laterais (horizontal ou vertical): o indicador continua dentro
  da barra e legível.
- Aluno com sessão duplicada (close code 4001, 005): a contagem segue os participantes da sala, sem contar duas vezes.
- A barra está visível sobre outra janela que não é a transmitida (RF-178): o indicador aparece igual.
- No Linux, com o indicador presente, os cliques nos botões da barra continuam funcionando e o clique fora dela
  continua atravessando o overlay.

## 9. Dados/Contratos impactados

- `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`: entrada nova, compatível, para enviar a
  quantidade de mãos levantadas da janela do MLab à barra (forma definida no plan; ver C-177).
- `packages/types`: tipo da mensagem nova, se o plan precisar.
- Sem mudança em contratos HTTP ou WebSocket.

## 10. Critérios de Sucesso

- Testes de componente da barra: 0, 1, 9 e 10+ mãos; barra expandida e recolhida; `title`/`aria-label`; ausência de
  texto visível sobre mãos; o retângulo da barra enviado ao main contém o indicador.
- Testes da janela do MLab: a quantidade é enviada quando muda (levantar, abaixar, sair) e não leva dados pessoais.
- Teste do main: aceita só da janela do MLab, descarta valor inválido e reenvia a quantidade quando a barra é recriada.
- Smoke manual: aluno no celular levanta e abaixa a mão com o professor na janela transmitida e depois na tela
  cheia; a barra mostra a borda e o número, e tudo some ao abaixar. Regressão da barra no Windows e no Linux (009).
- Suíte do desktop e `spec:check` verdes.

## 11. Fora de Escopo explícito

- Notificação do sistema, som, `flashFrame` e badge na barra de tarefas (possível feature futura).
- Clique no indicador abrindo o MLab ou a fila.
- Animação de chamada de atenção.
- Retirar a barra de marcação do vídeo em tela cheia.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma — as ambiguidades foram resolvidas em `clarify.md` (C-171 a C-179).
