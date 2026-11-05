# Clarify: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Feature: `008-dev-entrada-unica-web`
Status: CLOSED

## C-801 — Acessar pela 8080 é uma falha de segurança?

- **Contexto:** no `npm run dev`, a transmissão abre pela 8080 e pela 5173.
- **Análise:** não. A 8080 é o próprio backend; a página servida por ela usa as mesmas rotas (`/rooms/{id}/join`,
  `/ws/...`) e as mesmas validações do servidor que a página da 5173. No app empacotado, a 8080 é a porta oficial do
  aluno. A porta não é mecanismo de controle de acesso (AGENTS.md §8: autorização sempre no servidor).
- **Resposta:** o problema é de ambiente de desenvolvimento: a 8080 serve o build antigo de `apps/web/dist`
  (encontrado pelo `resolveWebDir` a partir de `apps/backend`), e não o código em edição.

## C-802 — Redirecionar ou recusar?

- **Alternativas consideradas:**
  - `404` com aviso: elimina a segunda entrada, mas quebra quem digitar a 8080 por hábito (é a porta do app
    empacotado);
  - não servir `dist` em dev, sem resposta definida: mesmo efeito do `404`, sem explicação;
  - redirecionar para a 5173: uma só versão servida (a atual), e a URL antiga continua chegando ao lugar certo.
- **Resposta (decisão técnica do agente, a confirmar no review do PR):** redirecionar com `307` para o mesmo caminho
  e query na porta do web, mantendo o host da requisição. Métodos diferentes de `GET`/`HEAD` fora das rotas de API
  recebem `404`.

## Resultado

CLOSED — C-801 e C-802 respondidas; nenhuma ambiguidade em aberto.
