# Spec: Versão e Informações do MLab no App Desktop

Status: READY
Feature ID: `021-sobre-versao-desktop`
Origem: issue #52 (pedido do responsável): o app desktop não mostra a versão nem as informações do MLab.

## 1. Objetivo

Permitir que o professor veja, dentro do app, qual versão do MLab está usando, com a descrição e os direitos autorais
do produto. Isso ajuda no suporte e na conferência de atualização. Os metadados do instalador e do executável devem
mostrar as mesmas informações, sempre derivadas da versão única do monorepo (ADR 0007), sem valor escrito à mão.

## 2. Contexto

Verificado em 2026-11-12 na `development` @ `3010573` (versão 1.12.2):

- nenhum uso de `app.getVersion()` em `apps/desktop/src`, e nenhuma tela "Sobre";
- `apps/desktop/package.json` tem duas descrições diferentes: `description` ("MLab - App Desktop do Professor") e
  `build.linux.description` ("Sistema de Transmissão e Interação de Salas de Aula MLab");
- `build.copyright` é `Copyright © 2024 MLab`, com o ano fixo, e vai para o `LegalCopyright` do `MLab.exe`.

## 3. Escopo

### Incluído

- versão no rodapé das telas de identificação e de criação de sala (dashboard) do app desktop;
- diálogo "Sobre" aberto a partir desse rodapé, com nome, versão, descrição e direitos autorais;
- canal IPC para o renderer obter essas informações;
- descrição única do produto e direitos autorais sem ano fixo nos metadados do pacote.

### Não incluído

- versão na web dos alunos;
- versão na tela da sala (transmissão);
- versão do backend em `/health`;
- licença, link do repositório ou indicação de edição (MLab × MLab HTTPS);
- verificação ou aviso de atualização.

## 4. Atores

- **Professor:** usa o app desktop e consulta a versão.

## 5. User Stories

### US-2101 — Ver a versão do app

Como professor, quero ver a versão do MLab nas telas iniciais do app, para saber qual versão estou usando sem procurar
nos arquivos do sistema.

- Dado que abri o app, quando estou na tela de identificação ou na de criação de sala, então vejo "MLab vX.Y.Z" no
  rodapé, com a versão do pacote instalado.

### US-2102 — Ver as informações do MLab

Como professor, quero abrir um diálogo "Sobre", para ver o nome, a versão, a descrição e os direitos autorais do MLab.

- Dado que estou numa das telas acima, quando aciono "Sobre" no rodapé, então vejo um diálogo com nome, versão,
  descrição e direitos autorais.
- Quando fecho o diálogo (botão "Fechar" ou tecla Esc), volto à tela sem perder o que já tinha digitado.

## 6. Requisitos Funcionais

- RF-2101: as telas de identificação e de dashboard mostram no rodapé "MLab v" seguido da versão
  `MAJOR.MINOR.PATCH` do app (US-2101).
- RF-2102: o rodapé tem a ação "Sobre", que abre um diálogo com nome, versão, descrição e direitos autorais (US-2102).
- RF-2103: o diálogo fecha pelo botão "Fechar" e pela tecla Esc, sem alterar o estado da tela.
- RF-2104: a versão exibida é a do app em execução (`app.getVersion()`), que o `npm run bump` mantém igual à versão
  única do monorepo. Nenhuma versão é escrita à mão no código.
- RF-2105: o pacote declara uma única descrição do produto, usada no app, no `description` e no
  `build.linux.description`.
- RF-2106: os direitos autorais não têm ano fixo. O app e os metadados do executável mostram
  `Copyright © <ano do build> MLab`.
- RF-2107: se as informações não puderem ser obtidas, o rodapé e o diálogo não aparecem, e o resto da tela funciona
  normalmente.

## 7. Requisitos Não Funcionais

- RNF-2101 — segurança: o renderer obtém as informações só pelo `window.electronAPI` (contextBridge), sem acesso
  direto ao Electron ou ao Node (AGENTS §6 e §8). O canal não recebe parâmetros e não expõe dados sensíveis.
- RNF-2102 — contrato: o canal novo fica registrado em `003-classroom-interaction/contracts/desktop-ipc.md`, e o
  tipo do payload em `packages/types`.
- RNF-2103 — dependências: nenhuma dependência nova.
- RNF-2104 — acessibilidade: o diálogo usa `role="dialog"`, `aria-modal` e um título rotulado, e a ação "Sobre" é um
  botão alcançável pelo teclado.

## 7.1 Regras de Negócio

- RN-2101: a versão exibida e a versão do instalador vêm da mesma fonte (o `version` do `package.json`, alterado só
  por `npm run bump`).

## 8. Estados e Erros

| Estado | Evento | Resultado |
|---|---|---|
| Tela carregada | IPC responde | rodapé "MLab vX.Y.Z · Sobre" |
| Tela carregada | IPC falha | rodapé não aparece; a tela segue normal (RF-2107) |
| Rodapé visível | clique em "Sobre" | diálogo aberto |
| Diálogo aberto | "Fechar" ou Esc | diálogo fechado, sem perder o estado da tela |

## 9. Edge Cases

- App em desenvolvimento (`npm run dev`): mostra a versão do `apps/desktop/package.json`, igual à da raiz.
- Troca de tela (identificação → dashboard): o rodapé reaparece na tela nova com a mesma versão.

## 10. Dados/Contratos impactados

- Novo canal IPC `get-app-info` (Renderer → Main) em `contracts/desktop-ipc.md` da 003.
- Novo tipo `AppInfo` em `packages/types`.
- Nenhuma mudança HTTP/WebSocket.

## 11. Critérios de Sucesso

- Testes do desktop cobrem o rodapé com a versão, a abertura e o fechamento do diálogo, e a falha do IPC.
- Build Windows: `MLab.exe` → Propriedades → Detalhes mostra a versão X.Y.Z e o direito autoral com o ano do build.
- Smoke manual: rodapé e "Sobre" nas duas telas, com a versão igual à do `package.json` raiz.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma — respondidas em `clarify.md` (C-2101 a C-2107).
