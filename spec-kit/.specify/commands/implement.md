# /speckit.implement

Pré-requisitos:
- analyze = PASS;
- checklist = APPROVED;
- feature possui spec/clarify/plan/tasks;
- tarefa corrente está pendente.

Execute somente UMA tarefa pendente por ciclo.

Antes de editar:
1. confirme que está em branch dedicada `<tipo>/<descricao>` criada a partir da `main` atualizada; se não
   estiver, crie-a (`AGENTS.md` §15) — nunca edite na `main`;
2. leia a tarefa;
3. valide Allowed Paths e Prohibited Paths;
4. leia apenas o contexto necessário.

Durante a tarefa — desvios (`AGENTS.md` §14):
- todo bug, erro ou teste instável fora do escopo da tarefa vira issue pelo template
  `.github/ISSUE_TEMPLATE/bug-desvio.md`, com as labels de tipo, `desvio` e `area:*` (pesquise duplicatas antes);
- **não bloqueante**: registre a issue e continue a tarefa; não corrija o desvio aqui;
- **bloqueante** (impede cumprir ou verificar a tarefa): pare imediatamente, sem commit parcial, abra a issue com
  `bloqueante` e informe ao usuário o que fazia, por que parou, a evidência e o número da issue.

Ao concluir:
1. execute os checks da tarefa;
2. só então marque a tarefa como concluída;
3. faça o commit atômico pelo `.gitmessage` (`Ref: Txxx`; `Refs #N` quando houver issue relacionada);
4. liste as issues de desvio abertas para o PR e o `converge.md`.
