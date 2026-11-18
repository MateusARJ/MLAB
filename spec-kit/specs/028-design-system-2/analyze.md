# Analyze: Design System 2.0 com Tema Claro e Escuro

Feature: `028-design-system-2`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma em aberto.

- Spec, clarify (C-2801 a C-2809) e plan concordam: só interface, padrões mantidos, rótulos novos, sem amarelo,
  favicon com a logo, #89 corrigida aqui, versão MAJOR.
- A US-09 da 001 cita "Tela Cheia" e "Janela Específica" como rótulos. A nota de emenda entra no mesmo commit dos
  artefatos da 028, antes do código (AGENTS §11). O comportamento da US-09 não muda. Os espelhos `RF026` e `RF027`
  em `docs/requirements/` usam esses termos como nome do modo de captura, não como rótulo de tela, e ficam como
  estão.
- A 025 exige um favicon SVG vetorial (RF-2501, RNF-2502). O RF-2814 o substitui por decisão do responsável (C-2806);
  a 025 recebe nota de emenda. O RF-2502 (quadrado escuro `#0f172a`) continua valendo.
- A 026 deixa a barra interna do `Room.tsx` fora do escopo dela; o RF-2815 não a contradiz.
- A 017 e a 026 fixam cor e geometria da barra flutuante fora do MLab; a 028 não toca nesse componente.
- O plano aprovado na conversa previa remover o Carbon na T2801. A remoção foi para a T2803, junto com a troca dos
  ícones, para que cada commit compile. O resultado final é o mesmo.
- A faixa `28xx` não colide: busca por `RF-28`, `C-28` e `T28` em `spec-kit/` só acha esta feature.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2801 | T2802 |
| RF-2802 | T2802, T2804, T2806 |
| RF-2803 | T2801, T2802 |
| RF-2804 | T2801, T2803 |
| RF-2805 | T2803 |
| RF-2806 | T2803, T2804, T2806 |
| RF-2807 | T2802, T2805, T2806 |
| RF-2808 | T2804 |
| RF-2809 | T2804 |
| RF-2810 | T2805 |
| RF-2811 | T2805 |
| RF-2812 | T2806 |
| RF-2813 | T2806 |
| RF-2814 | T2807 |
| RF-2815 | T2808 |
| RF-2816 | T2809 |
| RNF-2801 | T2804, T2805, T2806 (paths proibidos), T2808 (única lógica) |
| RNF-2802 | T2802, T2809 |
| RNF-2803 | T2801, T2802 |
| RNF-2804 | T2801, T2803 |
| RNF-2805 | T2804 a T2808 |

## 3. Contratos

- Nenhum contrato muda. `packages/types`, IPC, HTTP e WebSocket ficam como estão.

## 4. Tarefas fora do Scope Lock

Nenhuma. As T2801 a T2803 tocam só `packages/ui` e o lockfile; as T2804, T2805 e T2808 só páginas e dois componentes
do renderer; as T2806 e T2807 só a web; a T2809 só documentos; a T2810 só mexe em `package.json` via `npm run bump`.

## 5. Riscos

- Regressão ao reescrever a marcação das páginas: mitigada pelas suítes e pela validação manual do responsável.
- O PR espera a promoção da 1.15.0 para a `main`: pode exigir refazer o commit de release se a `development` mudar.
- O e2e do aluno depende do backend; se não rodar, fica registrado no converge.
