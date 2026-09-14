#  RF024 — Verificação de Permissões do Sistema Operacional

> **Categoria:** App Desktop
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

O App Desktop deve verificar previamente se possui permissões de gravação de tela e áudio no sistema operacional (macOS/Windows).

---

##  Justificativa e Impacto

Evitar que o professor inicie uma transmissão e envie uma tela preta ou silenciosa devido a bloqueios do SO.

---

##  Detalhes de Implementação Técnicos

- Uso da API `systemPreferences.getMediaAccessStatus()` no Electron.
- Exibição de dialog orientando o professor a conceder permissões nas Configurações do Sistema caso necessário.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
