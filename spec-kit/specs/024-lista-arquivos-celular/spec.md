# Spec: Lista de Arquivos do Celular na Altura da Gaveta

Status: READY
Feature ID: `024-lista-arquivos-celular`
Origem: issue #65 (desvio da 018/T186, smoke A13b). Evolução da `003-classroom-interaction` (US-16, RF-306) e da
`018-arquivos-arrastar` (RF-191).

## 1. Objetivo

Fazer a lista de arquivos da aba **Arquivos** da gaveta do aluno, no celular, ocupar toda a altura disponível da
gaveta, em vez de parar na metade da tela.

## 2. Contexto

Verificado em 2026-11-12 na `development` @ `90ec64a`:

- No celular (largura < 768px), a gaveta (`chatDrawerMobile` em `apps/web/src/pages/Room.tsx`) é `position: fixed`
  de cima a baixo, em coluna. Abaixo do cabeçalho Chat/Arquivos, a aba Arquivos renderiza `mobileFilesContent`
  (`flex: 1`, `overflowY: auto`, padding 14px) e, dentro dele, a lista com o estilo `filesList`.
- `filesList` foi pensado para a gaveta flutuante "Arquivos da Aula" do desktop (`filesDrawer`, `maxHeight: 450px`) e
  tem `maxHeight: '380px'`. No celular esse teto corta a lista em cerca de metade da tela; o espaço abaixo fica vazio.
- Há dois contêineres roláveis (a moldura e a lista) e padding duplicado (14px + 12px).

## 3. Escopo

### Incluído

- Estilo próprio da lista da aba Arquivos do celular, sem teto de altura, com rolagem interna.
- Moldura da aba Arquivos do celular sem rolagem própria.

### Não incluído

- Gaveta "Arquivos da Aula" do desktop (continua igual).
- Trocar o texto `⬇ Baixar` do celular pelo ícone do desktop; mudanças no chat; extrair componente da lista.
- Backend, app desktop, `packages/**`.

## 4. Atores

- **Aluno no celular:** abre a gaveta e a aba Arquivos para baixar material.

## 5. User Stories

### US-2401 — Lista de arquivos em tela cheia no celular

Como aluno no celular, quero ver a lista de arquivos ocupando a gaveta inteira, para enxergar mais arquivos de uma vez
e rolar só quando precisar.

- Dado que estou no celular com a gaveta aberta na aba Arquivos e há mais arquivos do que cabem, então a lista vai do
  cabeçalho até o fim da gaveta e rola dentro desse espaço.
- Dado que estou no desktop com a gaveta "Arquivos da Aula" aberta, então ela tem a mesma altura de hoje.
- Dado que estou com a lista aberta (celular ou desktop), quando o professor compartilha um arquivo novo, então a lista
  rola até ele, como hoje (018, RF-191).

## 6. Requisitos Funcionais

- RF-2401: no celular, a lista da aba Arquivos ocupa toda a altura da gaveta abaixo do cabeçalho Chat/Arquivos, sem
  altura máxima fixa, e é o único contêiner rolável da aba.
- RF-2402: a lista da gaveta "Arquivos da Aula" do desktop mantém a altura máxima atual (380px).
- RF-2403: a rolagem automática até o último arquivo (018, RF-191) continua no celular e no desktop.

## 7. Requisitos Não Funcionais

- RNF-2401 — compatibilidade: nenhum contrato, payload ou endpoint muda.
- RNF-2402 — dependências: nenhuma dependência nova.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| celular, aba Arquivos, sem arquivos | mensagem "Nenhum arquivo compartilhado…" no topo da gaveta, como hoje |
| celular, aba Arquivos, poucos arquivos | lista no topo; o espaço restante fica livre |
| celular, aba Arquivos, muitos arquivos | lista até o fim da gaveta, com rolagem interna (RF-2401) |
| desktop, gaveta "Arquivos da Aula" | altura máxima de 380px na lista (RF-2402) |

## 9. Edge Cases

- Celular com barra de navegação/gestos (safe area): a gaveta já vai até `bottom: 0`; a lista acompanha.
- Giro do aparelho: a gaveta muda de altura e a lista acompanha, sem valor fixo.
- Largura ≥ 768px: vale o layout de desktop (RF-2402).

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- Teste do web: no celular, a lista da aba Arquivos não tem `max-height` de 380px, tem `flex: 1` e `overflow-y: auto`,
  e a moldura não rola; no desktop, a lista mantém `max-height: 380px`; os testes de RF-191 continuam verdes.
- Manual: no celular (ou emulação 375×812 e 412×915) com 10+ arquivos, a lista vai até o fim da gaveta e rola; o último
  arquivo aparece quando um novo chega; desktop 1280px sem mudança.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2401 a C-2403).
