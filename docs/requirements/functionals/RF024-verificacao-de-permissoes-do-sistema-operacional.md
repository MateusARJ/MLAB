# 📋 RF024 — Permissões de Captura e Microfone no App Desktop

> **Categoria:** App Desktop
> **Prioridade:** Crítica
> **Status:** ✅ Aprovado (reescrito em 2026-11-06 para refletir a spec 001)

---

## 📌 Descrição

O processo principal do app desktop autoriza somente as permissões necessárias à transmissão: captura de
tela/janela e microfone. As demais solicitações de permissão são recusadas.

Não existe tela intermediária de permissões nem login (ADR 0006): o professor entra pelo nome e segue para o
Dashboard. Se a captura de tela ou o microfone não estiverem disponíveis no sistema operacional, a sala mostra um
aviso com o botão "Verificar Novamente".

---

## 🎯 Justificativa e Impacto

1. **Prevenção de falhas de transmissão**: o professor é avisado antes de transmitir tela preta ou sem áudio.
2. **Menor superfície de permissões**: o app só concede o que a transmissão usa.
3. **Conformidade com o SO**: Windows, macOS e Linux exigem consentimento para mídia e captura de tela.

---

## 🛠️ Detalhes Técnicos de Implementação

1. **Handlers de sessão no processo principal (`apps/desktop/src/main/main.ts`)**:
   - `session.defaultSession.setPermissionRequestHandler`: aprova só a lista permitida (ex.: `media`,
     `display-capture`) e recusa o resto.
   - `session.defaultSession.setPermissionCheckHandler`: responde às verificações de `media` e `display-capture`.
   - `session.defaultSession.setDisplayMediaRequestHandler`: trata as requisições de captura do Chromium via
     `desktopCapturer`.
2. **Aviso na sala (`apps/desktop/src/renderer/pages/Room.tsx`)**: quando as fontes de captura não são detectadas,
   mostra o alerta de permissões e permite verificar de novo.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Spec:** RF-24 em `spec-kit/specs/001-screen-share-core/spec.md` (a tela `Permissions.tsx` foi removida em
  `4f3caad`)
- **Documento Principal:** [requirements.md](../../requirements.md)
- **Requisitos Relacionados:** [RF010 — Captura e Controle do Microfone do Professor](RF010-captura-e-controle-do-microfone-do-professor.md), [RF026 — Captura Tela Cheia](RF026-captura-tela-cheia-display-tracking.md), [RF027 — Captura Janela Específica](RF027-captura-janela-especifica-application-isolation.md), [RF028 — Gravação Local de Aula](RF028-gravacao-local-de-aula.md).
