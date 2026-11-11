# Clarify: Arrastar Arquivos para a Aba Arquivos da Sala

Feature: `018-arquivos-arrastar`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-10, na análise da issue #46 sobre a `development` @ `3d1e15a`.

## C-181 — Escopo: só arrastar ou também validar tipos e headers

- **Contexto:** a issue #46 propõe incluir na mesma feature o bloqueio de executáveis no upload (415) e o
  endurecimento dos headers de download. Isso muda o backend, o contrato `files.md` e o web app, e remover a
  capacidade de enviar certos tipos pode ser quebra de compatibilidade (MAJOR, `docs/versionamento.md`).
- **Opções:** (A) só drag-and-drop; (B) tudo junto.
- **Resposta aprovada:** **A**. O 415 e os headers viram issue própria, com a análise de MAJOR separada.
- **Impacto em spec:** seções 2 e 11; RNF-183.
- **Impacto em plan/contracts/tasks:** `apps/backend/**`, `apps/web/**` e `003/contracts/**` proibidos.

## C-182 — Como evitar navegar para `file://` ao soltar fora da zona

- **Contexto:** `isAppUrl` (`navigationGuard.ts:15`) aceita qualquer URL `file:`. No app empacotado, o drop padrão
  do Chromium navega até o arquivo, e o `will-navigate` deixa passar. Em desenvolvimento a origem é a do Vite, e o
  guard já bloqueia.
- **Opções:** (A) só `preventDefault` global no renderer; (B) renderer e guard restrito ao `index.html` do app.
- **Resposta aprovada:** **B**, defesa em profundidade.
- **Impacto em spec:** RF-190, RNF-181.
- **Impacto em plan/contracts/tasks:** `navigationGuard.ts`, `main.ts` e `annotationOverlayWindow.ts` (só a chamada
  do guard) entram no Scope Lock.

## C-183 — Nome e número da feature

- **Contexto:** a issue sugere `012-arquivos-arrastar-e-validar`, mas `012` já é `012-mdns-nome-unico`.
- **Resposta aprovada:** `018-arquivos-arrastar`; IDs `18x` (RF-181…, RNF-181…, RN-181…, T181…).
- **Impacto:** nenhum além dos IDs. A faixa `18x` não é usada em outra feature.

## C-184 — Pré-validação de 50 MB no app

- **Opções:** (A) só o servidor valida; (B) o app recusa antes de enviar e o servidor continua validando.
- **Resposta aprovada:** **B**. Evita mandar 50 MB+ pela rede local só para receber 413. A mensagem é a mesma do
  servidor.
- **Impacto em spec:** RF-186, RNF-182.

## C-185 — Pastas soltas

- **Opções:** (A) ignorar em silêncio; (B) marcar erro por item; (C) enviar o conteúdo recursivamente.
- **Resposta aprovada:** **B**, detectada por `DataTransferItem.webkitGetAsEntry().isDirectory`. C fica fora.
- **Impacto em spec:** RF-186; seção 11.

## C-186 — Soltar durante um envio

- **Opções:** (A) bloquear a zona durante o envio; (B) enfileirar no fim.
- **Resposta aprovada:** **B**. Nada é descartado.
- **Impacto em spec:** RF-187.

## C-187 — Erro num item

- **Resposta aprovada:** o erro marca só aquele item e a fila continua. Para o 413 de limite da sala, o app não
  infere nada: os próximos itens recebem o próprio 413 do servidor.
- **Impacto em spec:** RF-185; seção 8.

## C-188 — Botão e retorno

- **Resposta aprovada:** o seletor do botão ganha `multiple` e usa a mesma fila. O banner único vira uma lista de
  itens com estado. O item enviado some após 5 s (mesmo tempo do banner atual); o item com erro fica até ser
  dispensado ou até o próximo lote (fila vazia que recebe arquivos).
- **Impacto em spec:** RF-184, RF-188.

## C-189 — Zona de soltar e versão

- **Resposta aprovada:** a zona existe só com a aba Arquivos aberta; trocar de aba automaticamente é non-goal.
  Versão **MINOR** (funcionalidade nova compatível; contrato e backend sem mudança).
- **Impacto em spec:** RF-181, RF-190; seção 2.
- **Impacto em plan/contracts/tasks:** T186 faz `npm run bump -- minor`.
