# Analyze: Tela Cheia do Aluno sem Bordas

Feature: `049-tela-cheia-sem-bordas`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-4901 a C-4904) e plan concordam: Preencher (`cover`) por padrão em tela cheia, Ajustar
  (`contain`) a um toque, escolha em `mlab-video-fit`, painéis fechados na entrada, sem área segura inferior em tela
  cheia, MINOR.
- RF-22 (001) e RF-4305/RF-4306 (043) não mudam: o menu em tela cheia ganha um item no mesmo padrão.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-4901 a RF-4907 | T4901 |
| RNF-4901 | T4901 (testes existentes e e2e A10/A15 no converge) |
| RNF-4902 | T4901 |
| RNF-4903 | T4901 (re-export de ícones já instalados) |

## 3. Contratos

- Nenhum contrato muda. A chave `mlab-video-fit` é preferência local do navegador, como `mlab-theme`.

## 4. Tarefas fora do Scope Lock

Nenhuma. A T4901 toca só `Room.tsx`, `Room.test.tsx` e `packages/ui/src/index.ts`; a T4902 só documentos da feature;
a T4903 só os manifests, via `npm run bump`.

## 5. Riscos

- Corte de conteúdo, armazenamento bloqueado, fechamento repetido dos painéis e layout não medido no jsdom: mitigados
  no plan §3.

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T4901.
