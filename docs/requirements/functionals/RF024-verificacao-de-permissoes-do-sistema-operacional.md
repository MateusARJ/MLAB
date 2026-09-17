# 📋 RF024 — Verificação e Solicitação de Permissões do Sistema Operacional no Pós-Login

> **Categoria:** App Desktop
> **Prioridade:** Crítica
> **Status:** ✅ Aprovado (Atualizado para fluxo obrigatório pós-login)

---

## 📌 Descrição

O App Desktop do professor deve obrigatoriamente solicitar, verificar e validar as permissões de acesso ao **Microfone** e à **Captura e Transmissão de Tela** no Sistema Operacional (Windows/macOS) imediatamente após o login do professor, antes de permitir o acesso ao Dashboard e à Sala de Transmissão.

O sistema deve disparar requisições nativas ao SO/Chromium para que o professor conceda as autorizações necessárias e só permita o avanço caso as permissões estejam ativas, prevenindo transmissões com tela preta ou ausência de áudio.

---

## 🎯 Justificativa e Impacto

1. **Prevenção de Falhas Críticas de Transmissão e Gravação**:
   - Evita que o professor acerte as configurações de uma aula e inicie a transmissão apenas para descobrir tardiamente que o SO bloqueou o microfone ou a captura de tela.
2. **Conformidade com Políticas de Privacidade do SO**:
   - Windows 10/11 e macOS impõem controles rigorosos de acesso a dispositivos de mídia e captura de tela que exigem consentimento explícito.
3. **Experiência do Usuário (UX Guiada)**:
   - Apresenta feedback visual claro em tempo real dos status de Microfone e Tela, com instruções de desbloqueio caso as configurações do SO estejam restritivas.

---

## 🛠️ Detalhes Técnicos de Implementação

1. **Handlers de Sessão no Electron Main Process (`apps/desktop/src/main/main.ts`)**:
   - `session.defaultSession.setPermissionRequestHandler`: aprova explicitamente requisições de `'media'` e `'display-capture'`.
   - `session.defaultSession.setPermissionCheckHandler`: valida autorizações da janela.
   - `session.defaultSession.setDisplayMediaRequestHandler`: trata requisições de captura do Chromium.
2. **Canais IPC de Permissões**:
   - `check-media-permissions`: consulta `systemPreferences.getMediaAccessStatus('microphone')` e status de tela.
   - `request-media-permissions`: aciona `systemPreferences.askForMediaAccess('microphone')` e validação de desktop capturer.
3. **Pós-Login Gate no Renderer (`Permissions.tsx`)**:
   - Transição obrigatória pós-login: `Login` → `Permissions` → `Dashboard` → `Room`.
   - Disparo nativo de permissão de microfone via `navigator.mediaDevices.getUserMedia({ audio: true })`.
   - Validação de fontes de tela via `window.electronAPI.getScreenSources()`.
   - Badges de status: `Pendente` (amarelo), `Concedido` (verde), `Negado` (vermelho).
   - Botão de avanço habilitado somente após validação.
   - Guia de instrução para Windows Settings em caso de bloqueio.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
- **Requisitos Relacionados:** [RF010 — Captura e Controle do Microfone do Professor](RF010-captura-e-controle-do-microfone-do-professor.md), [RF026 — Captura Tela Cheia](RF026-captura-tela-cheia-display-tracking.md), [RF027 — Captura Janela Específica](RF027-captura-janela-especifica-application-isolation.md), [RF028 — Gravação Local de Aula](RF028-gravacao-local-de-aula.md).
