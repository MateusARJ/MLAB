# Template de Pull Request — MLab

<!--
REGRA OBRIGATÓRIA DE TÍTULO DO PR:
O título DEVE iniciar com um dos prefixos em inglês abaixo, e todo o restante da mensagem DEVE ser restritamente em português.

Formato: <tipo>(<escopo opcional>): <descrição sucinta em português>
Exemplos:
  - feat(desktop): implementa seletor de tela cheia e janela específica
  - fix(auth): corrige validação de credenciais do professor no backend
  - docs(spec): atualiza requisitos não-funcionais de gravação de tela
  - chore(turbo): atualiza scripts de build do monorepo
-->

## 📌 Título Sugerido
`tipo(escopo): descrição da alteração em português`

---

## 🎯 Tipo de Alteração
Selecione o tipo correspondente à sua contribuição (prefixo em inglês):
- [ ] `feat`: Nova funcionalidade para o usuário ou sistema
- [ ] `fix`: Correção de defeito / bug
- [ ] `docs`: Alterações exclusivamente em documentação ou especificações
- [ ] `style`: Formatação, lint, ponto e vírgula (sem alteração lógica de código)
- [ ] `refactor`: Refatoração de código sem alteração de comportamento público
- [ ] `perf`: Mudança focada em otimização de performance
- [ ] `test`: Adição, melhoria ou correção de testes automatizados
- [ ] `build`: Alterações que afetam o sistema de build ou dependências (Turbo, Vite, Go, npm)
- [ ] `ci`: Modificações em scripts e pipelines de integração contínua
- [ ] `chore`: Outras alterações operacionais, configurações ou manutenção

---

## 📝 Descrição da Mudança
<!-- Descreva de forma clara e detalhada o que foi alterado e a motivação técnica ou pedagógica. -->

---

## 🔗 Tarefas do Spec-Kit / Requisitos Relacionados
- **Feature ID:** `001-screen-share-core`
- **Tasks:** (ex: `T022`, `T023`, `T024`, `T025`, `T026`, `T027`, `T028`)
- **Requisitos Funcionais:** (ex: `RF-004`, `RF-026`, `RF-027`, `RF-028`, `RF-029`)
- **Requisitos Não Funcionais / Regras:** (ex: `RNF-016`, `RNF-018`, `RN-019`, `RN-020`)

---

## 🧪 Como Foi Testado (Plano de Verificação)
Descreva os testes automatizados e manuais realizados:
- [ ] Testes unitários do Desktop (`npm run test --workspace=apps/desktop`)
- [ ] Testes do Web App dos Alunos (`npm run test --workspace=apps/web`)
- [ ] Testes do Backend Go (`cd apps/backend && go test -v ./...`)
- [ ] Build completo do Turborepo (`npm run build`)
- [ ] Verificação manual em ambiente de desenvolvimento (`npm run dev`)

---

## 📋 Checklist de Conformidade com o AGENTS.md
- [ ] O prefixo do commit/PR está em inglês (`feat`, `fix`, `docs`, etc.) e o restante da mensagem está restritamente em português.
- [ ] A alteração respeita o **Scope Lock** definido no `plan.md`.
- [ ] Apenas os **Allowed Paths** da tarefa foram modificados.
- [ ] Nenhum comportamento foi inventado silenciosamente sem alinhamento com a spec.
- [ ] A barra de menus nativa do Electron permanece íntegra (caso aplicável).
- [ ] Todos os testes automatizados estão passando com 100% de sucesso.
