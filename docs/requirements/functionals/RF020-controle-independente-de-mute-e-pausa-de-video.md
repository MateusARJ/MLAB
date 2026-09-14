#  RF020 — Controle Independente de Mute e Pausa de Vídeo

> **Categoria:** Captura de Mídia
> **Prioridade:** Média
> **Status:**  Aprovado

---

##  Descrição

O professor pode silenciar o microfone ou interromper temporariamente o vídeo sem desconectar a sessão WebRTC.

---

##  Justificativa e Impacto

Conceder privacidade pontual ao professor (ex: atender uma chamada rápida ou tossir) sem precisar refazer a sala.

---

##  Detalhes de Implementação Técnicos

- O estado das tracks é alterado nativamente (`track.enabled = false/true`).
- O SFU repassa pacotes de silêncio ou quadros vazios aos alunos mantendo a `PeerConnection` ativa.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
