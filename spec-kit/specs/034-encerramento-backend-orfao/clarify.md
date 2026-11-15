# Clarify: Encerramento Completo do App e do Backend Embarcado

Feature: `034-encerramento-backend-orfao`
Status: CLOSED

C-3404 a C-3407 foram aprovadas pelo responsável em 2026-11-15, na análise da base anterior (plano aprovado com
"todos os itens opcionais e log de diagnóstico"). C-3401 a C-3403 surgiram na nova análise da `development` e foram
aprovadas pelo responsável em 2026-11-15, com as respostas recomendadas.

## C-3401 — Como identificar o dono da porta 8080 (backend órfão)

- **Contexto:** na partida, o app precisa decidir se o processo na 8080 é um backend do MLab (encerrar) ou de
  terceiros (não encerrar). O plano aprovado na base anterior estendia o `/health` com `service`, `pid` e `managed`.
  Na `development`: o `/health` não tem contrato em `contracts/`; a 021 deixou "versão do backend em `/health`" fora
  do escopo; e `docs/versionamento.md` §2 classifica "campo opcional novo em contrato" como **MINOR**.
- **Opções:**
  - (A) estender o `/health` com `service`, `pid`, `ppid`, `managed`; criar o contrato do `/health`; versão MINOR.
    Identifica órfãos em todos os sistemas.
  - (B) **não** mudar o `/health`: o watchdog (RF-3407) já impede que backends desta versão em diante fiquem órfãos;
    para os demais casos, o app identifica o dono da porta pelo SO **no Windows** (`netstat -ano` ⇒ PID;
    `tasklist` ⇒ nome da imagem `mlab-backend.exe` ou `server.exe`). No Linux/macOS, porta ocupada ⇒ não encerra,
    registra o conflito no log (comportamento atual + log). Versão PATCH.
- **Resposta proposta:** **(B)**. Cobre o alvo do relato (Windows), não cria contrato público nem capacidade nova
  (KISS/YAGNI) e mantém PATCH. A identificação por nome é segura porque `mlab-backend.exe` é exclusivo do MLab
  (C-3404) e `server.exe` só é aceito quando a porta 8080 respondeu ao `/health` do MLab.
- **Resposta aprovada (2026-11-15):** **(B)**.
- **Impacto em spec:** RF-3409, RNF-3405, §10.
- **Impacto em plan/contracts/tasks:** (A) acrescenta contrato do `/health` e muda a versão para MINOR; (B) nenhum.

## C-3402 — Fechar a janela principal com outras janelas do MLab abertas

- **Contexto:** hoje o app só encerra em `window-all-closed`. O overlay de marcação é uma janela independente e
  invisível; com ele aberto, fechar a janela principal deixa o `MLab.exe` vivo (R-1).
- **Opções:**
  - (A) a janela principal é a única que mantém o app: ao fechá-la, o main encerra o overlay e, no Windows/Linux,
    finaliza o app.
  - (B) só encerrar o overlay no `closed` da janela principal e deixar `window-all-closed` cuidar do resto.
  - (C) criar o overlay com `parent` = janela principal.
- **Resposta proposta:** **(A)**. É explícita e não depende de o overlay ser a única outra janela. (B) funciona hoje,
  mas volta a falhar com qualquer janela auxiliar futura. (C) altera a ordem de empilhamento e o comportamento de
  foco/captura do overlay (features 009, 017, 026), fora do escopo.
- **Resposta aprovada (2026-11-15):** **(A)**.
- **Impacto em spec:** RF-3401, RF-3402.

## C-3403 — Comportamento no macOS ao fechar a janela

- **Contexto:** no macOS o app continua no Dock após fechar a janela (convenção da plataforma), mas hoje
  `window-all-closed` encerra o backend: reabrir pelo Dock cria uma janela sem backend (R-7). Não faz parte do relato.
- **Opções:**
  - (A) manter a convenção: fechar a janela encerra sala, overlay e rastreador, mas o backend continua para a próxima
    janela; Cmd+Q encerra tudo pelo procedimento único (RF-3403).
  - (B) fechar a janela encerra o app também no macOS.
  - (C) fora de escopo: manter como está.
- **Resposta proposta:** **(A)**. Corrige o defeito com uma condição, sem mudar a convenção da plataforma. (C) deixaria
  o procedimento único com uma exceção que hoje é um bug.
- **Resposta aprovada (2026-11-15):** **(A)**.
- **Impacto em spec:** RF-3402.

## C-3404 — Renomear o binário do backend

- **Resposta aprovada (2026-11-15):** renomear para `mlab-backend.exe` (Windows), `mlab-backend-linux` e
  `mlab-backend-darwin` no build, `mlab-backend` no pacote Linux/macOS. O app ainda localiza os nomes legados como
  último recurso, com aviso no log.
- **Motivo:** nome reconhecível no Gerenciador de Tarefas e encerramento seguro por nome (instalador, RF-3409).
- **Impacto em spec:** RF-3411.

## C-3405 — Instalador NSIS encerra órfãos

- **Resposta aprovada (2026-11-15):** script incluído pelo electron-builder (`nsis.include`) com `customInit` e
  `customUnInit`; só age se o `MLab.exe` **não** estiver em execução (a verificação padrão do electron-builder cuida
  dele); `server.exe` legado só quando em `<pasta>\resources\bin\` com `MLab.exe` em `<pasta>`.
- **Local do script:** `apps/desktop/installer/installer.nsh` (`build/` está no `.gitignore` da raiz).
- **Impacto em spec:** RF-3412.

## C-3406 — Logs de diagnóstico

- **Resposta aprovada (2026-11-15):** `mlab-main.log` (já existe) passa a registrar o ciclo de vida (RF-3413);
  novo `mlab-backend.log` na mesma pasta `logs/` do `userData`, escrito pelo próprio backend (RF-3414). Nenhum segredo
  em log (RNF-3402).
- **Impacto em spec:** RF-3413, RF-3414.

## C-3407 — Testes, IDs e versão

- **Testes:** sem Playwright/Electron E2E (dependência nova); módulo de gestão do backend com dependências injetadas e
  testes vitest; watchdog e encerramento gracioso com testes Go, incluindo um teste com processo auxiliar (o próprio
  binário de teste) para matar o pai real; verificação manual no Windows.
- **Faixa de IDs:** `US-340x`, `RF-340x`/`RF-341x`, `RNF-340x`, `C-340x`, `T340x`.
- **Impacto de versão:** **PATCH** (C-3401 B): correção sem capacidade nova nem mudança de contrato público.

## Perguntas resolvidas

- [x] C-3401
- [x] C-3402
- [x] C-3403
- [x] C-3404
- [x] C-3405
- [x] C-3406
- [x] C-3407

## Resultado

CLOSED — C-3401 a C-3407 respondidas; nenhuma ambiguidade em aberto.
