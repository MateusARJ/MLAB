# Plan: Tela Cheia do Aluno sem Bordas

Feature: `049-tela-cheia-sem-bordas`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4901 a C-4904)

## 1. Summary

```text
estado videoFit: 'cover' | 'contain'   (inicial: localStorage 'mlab-video-fit' válido, senão 'cover')
                     │
<video style={{ ...styles.video, objectFit: effectiveFullscreen ? videoFit : 'contain' }} />
                     │
menu da transmissão (tela cheia): [ Mostrar tela inteira | Preencher a tela ] → alterna e salva

entrada em tela cheia (nativa ou pseudo) → fecha Chat e Arquivos
videoSection no celular: padding-bottom --sab só fora da tela cheia
```

1. `apps/web/src/pages/Room.tsx`:
   - funções puras no módulo: `readVideoFit()` (lê e valida a chave, `try/catch`) e `saveVideoFit(fit)`
     (`try/catch`);
   - estado `videoFit` inicializado por `readVideoFit()`; `toggleVideoFit()` alterna e salva;
   - `<video>` com `objectFit` calculado (RF-4901, RF-4902) e `data-fit` para teste;
   - item novo no `fullscreenActionsGroup`, entre "Picture-in-Picture" e "Sair da Tela Cheia", sem fechar o menu
     (RF-4904);
   - efeito em `effectiveFullscreen`: na transição para `true`, `setIsChatOpen(false)` e `setIsFilesOpen(false)`
     (RF-4906);
   - `videoSectionMobile` só quando `isMobile && !effectiveFullscreen` (RF-4907).
2. `packages/ui/src/index.ts`: exporta `Expand` e `Shrink` do `lucide-react` com os nomes `FillScreen` e `FitScreen`,
   no padrão de um import por ícone.
3. `apps/web/src/pages/Room.test.tsx`: `describe` novo da 049.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Modo do vídeo | `object-fit` calculado no `<video>`; fora da tela cheia sempre `contain` | C-4901 |
| Persistência | `localStorage` `mlab-video-fit`, valores `cover`/`contain`, leitura e escrita em `try/catch` | C-4902 |
| Controle | item do menu em tela cheia; título e descrição pelo estado; `aria-label` = título | C-4902, RNF-4902 |
| Ícones | `FillScreen` (Lucide `Expand`) para "Preencher a tela", `FitScreen` (Lucide `Shrink`) para "Mostrar tela inteira" | RNF-4903 |
| Painéis | fecham na entrada em tela cheia, por efeito na borda de subida de `effectiveFullscreen` | C-4903 |
| Área segura | `videoSectionMobile` desligado em tela cheia | C-4903 |
| Versão | MINOR (2.1.5 → 2.2.0) | C-4904 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `cover` corta conteúdo do professor | aluno perde texto nas bordas | modo Ajustar a um toque, salvo no dispositivo (C-4901) |
| `localStorage` bloqueado (aba privada, política) | exceção ao abrir a sala | `try/catch` na leitura e na escrita; padrão `cover` |
| Fechar Chat/Arquivos em todo render de tela cheia | painel não abre pelo menu | efeito só na transição `false → true` (ref do valor anterior) |
| jsdom não mede layout | teste não prova ausência de faixas | testes do `object-fit` e da estrutura + verificação visual no converge |
| Ícones novos em `packages/ui` | build do `@mlab/ui` | só re-export de ícones já instalados; `turbo build` no check |

## Scope Lock

### IN

- exibição do vídeo em tela cheia, item do modo no menu da transmissão, fechamento de Chat/Arquivos ao entrar em tela
  cheia e área segura inferior em tela cheia no web do aluno; dois ícones re-exportados em `packages/ui`.

### OUT

- exibição fora da tela cheia; PiP; captura do professor; backend; SFU; drawers de Chat e Arquivos (conteúdo).

### Allowed Paths

- `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
- `packages/ui/src/index.ts`
- `spec-kit/specs/049-tela-cheia-sem-bordas/**`
- só na T4903, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/e2e/**`, `apps/desktop/**`, `apps/backend/**`
- `packages/types/**`, `packages/ui/src/*.tsx`
- `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- zoom ou arrastar a imagem em tela cheia;
- mudar a proporção ou a resolução enviadas pelo professor;
- mudar a exibição fora da tela cheia.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada; o servidor não processa a imagem.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita ao `Room` do aluno e a dois re-exports de ícones.
- [ ] Princípio VIII: converge ao final (T4902).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-18 | Preencher (`cover`) por padrão, Ajustar (`contain`) a um toque | C-4901 |
| 2026-11-18 | Controle no menu da transmissão, escolha em `mlab-video-fit` | C-4902 |
| 2026-11-18 | Chat/Arquivos fecham ao entrar em tela cheia; sem área segura inferior em tela cheia | C-4903 |
| 2026-11-18 | Uma feature, um PR, IDs `490x`, MINOR | C-4904 |
