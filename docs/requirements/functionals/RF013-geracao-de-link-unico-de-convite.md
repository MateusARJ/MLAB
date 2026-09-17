#  RF013 — Geração de Link Único de Convite

> **Categoria:** Gestão de Sala
> **Prioridade:** Média
> **Status:**  Aprovado

---

##  Descrição

O professor deve poder gerar e copiar um link único e permanente de acesso contendo o slug legível fixo associado ao seu login. O link deve estar acessível tanto em redes locais quanto em redes externas (Internet / WAN) via túnel seguro (ngrok) ou IP de rede.

---

##  Justificativa e Impacto

Facilitar o compartilhamento direto da aula via e-mail, grupos de mensagens ou LMS sem que o endereço mude entre aulas, permitindo que alunos em redes distintas ingressem na aula ao vivo sem depender de estarem no mesmo Wi-Fi.

---

##  Detalhes de Implementação Técnicos

- **Slug Fixo por Login de Professor**: O identificador amigável da sala é derivado deterministicamente do login/email do professor autenticado (ex: `professor@screenshare.local` → `/sala/professor/entrar`). Ao reabrir a sala, o link e o slug permanecem inalterados.
- **Suporte a Túnel ngrok**: Suporte à variável `NGROK_URL` gerando links públicos com terminação segura HTTPS/WSS (ex: `https://<hash>.ngrok-free.app/sala/<slug>/entrar`), permitindo acesso remoto imediato de alunos em qualquer rede.
- **Resolução de IP de Rede Local**: Na ausência de túnel ou domínio público, o backend resolve dinamicamente o IP da interface primária de rede da máquina (ex: `http://192.168.X.X:3000/sala/<slug>/entrar`).
- Formato padrão do link: `https://<domain-ou-ip>/sala/<room-slug>/entrar`.
- Botão de atalho "Copiar Link" no painel do professor copia a URL formatada para a área de transferência.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
- **Regras de Negócio:** [RN006 — Geração de Slug Legível e Único](../business-rules/RN006-geracao-slug-legivel-e-unico.md)
- **Tarefas:** T009, T015, T030, T031
