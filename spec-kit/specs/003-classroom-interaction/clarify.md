# Clarify: Interação em Sala de Aula

Feature: `003-classroom-interaction`
Status: CLOSED

Como a feature é retroativa, cada resposta registra o comportamento já entregue, aprovado pelo dono do produto
junto com o plano de remediação (2026-11-01). Nenhuma resposta altera comportamento.

---

## C-301 — Histórico de chat contradiz a RN-18 da 001

- **Contexto:** a RN-18 da 001 proibia histórico retroativo; o código envia `chat-history`.
- **Resposta aprovada:** manter o histórico. Somente mensagens públicas, no máximo 200, em memória. A RN-18 da 001 foi movida para esta feature como RN-304.
- **Impacto:** spec 001 (RN-18), `contracts/signaling-classroom.md`.

## C-302 — Compartilhamento de arquivos estava fora do escopo da 001

- **Contexto:** a 001 listava "upload de arquivos" como não incluído; o código permite envio pelo professor.
- **Resposta aprovada:** manter. Só o professor dono envia; alunos só listam e baixam. Limite de 50 MB por arquivo.
  Limites por sala (300 MB e 50 arquivos, configuráveis), autenticação na listagem/download e liberação da memória no
  encerramento entram em `002-security-hardening`/S4 (decisão D6).
- **Impacto:** `contracts/files.md`, 002/S4.

## C-303 — Formato da matrícula

- **Resposta aprovada:** `^[0-9]+[A-Za-z]{1,4}[0-9]+$` (dígitos + sigla de 1 a 4 letras + dígitos). Validação no backend; o front exibe o erro retornado.
- **Impacto:** `001/contracts/room-api.md` (erro 400 no join).
- **Emenda 046 (2026-11-16):** substituída pela `046-formato-matricula`/C-4601: exatamente 7 dígitos, 4 letras e 4 dígitos, normalizada em maiúsculas.

## C-304 — Duplo Ctrl fora do Windows

- **Contexto:** o detector usa a API nativa do Windows.
- **Resposta aprovada:** o duplo Ctrl é exclusivo do Windows. Nos demais sistemas a lupa é acionada pelo botão e por `Alt+Z`. Não é bug.

## C-305 — Escopo do chat privado

- **Resposta aprovada:** aluno → professor(es); professor → um aluno (`target_id`). O remetente recebe eco da própria mensagem. Não existe chat privado aluno ↔ aluno.

## C-306 — Persistência

- **Resposta aprovada:** nada desta feature é persistido (ADR 0005). Chat, fixações, mãos e arquivos se perdem no encerramento da sala ou no reinício do app.

---

## Resultado

CLOSED — C-301 a C-306 respondidas; nenhuma ambiguidade em aberto.
