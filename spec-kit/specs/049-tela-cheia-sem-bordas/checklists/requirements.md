# Checklist de Requisitos: Tela Cheia do Aluno sem Bordas

Feature: `049-tela-cheia-sem-bordas`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4901 a RF-4907, RNF-4901 a RNF-4903) tem task.
- [x] Ambiguidades fechadas (C-4901 a C-4904): modo de preenchimento, controle, persistência, painéis, área segura e
  versão.
- [x] Evidência registrada: `Room.tsx` (`video`, `videoSection`, `videoSectionMobile`, `pseudoFullscreen`,
  `isChatOpen`) e `useScreenCapture.ts` (limite 1920×1080 com proporção da fonte).
- [x] Edge cases cobertos: mesma proporção, painel aberto pelo menu, tela mais alta que o vídeo, armazenamento
  indisponível.

## Coerência

- [x] RF-22 (001, tela cheia e PiP) não muda: os botões e suas ações continuam; muda só a exibição em tela cheia.
- [x] 043 (RF-4305, RF-4306): o gatilho e o menu em tela cheia continuam; o item novo segue o padrão dos demais.
- [x] Testes existentes que abrem Chat/Arquivos pelo menu em tela cheia continuam válidos (RF-4906 fecha só na entrada).
- [x] Preferência local segue o padrão do tema (`mlab-theme`, 028); sem dado no servidor (ADR 0005).
- [x] MINOR coerente com `docs/versionamento.md` §2 (nova opção).

## Viabilidade

- [x] `Expand` e `Shrink` existem no `lucide-react` instalado (1.73.0).

## Resultado

APPROVED
