# /speckit.analyze

Modo estritamente READ-ONLY.

Compare `spec.md`, `clarify.md`, `plan.md`, `tasks.md` e `constitution.md`.

Procure:
- contradições;
- requisitos sem tarefa;
- tarefas sem requisito;
- contratos desconectados;
- paths fora do Scope Lock;
- riscos não tratados.

Só pode terminar em PASS quando não houver bloqueador.
