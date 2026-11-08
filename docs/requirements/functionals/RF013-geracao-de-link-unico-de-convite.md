#  RF013 — Geração de Link Único de Convite

> **Categoria:** Gestão de Sala
> **Prioridade:** Média
> **Status:**  Aprovado

---

##  Descrição

O professor deve poder gerar e copiar um link único de acesso à sala, com um slug legível derivado do título da sala e do nome do professor. O link funciona na rede local (nome `mlab.local` via mDNS ou IP de rede) e, opcionalmente, fora dela via túnel (ngrok) ou URL pública.

---

##  Justificativa e Impacto

Facilitar o compartilhamento direto da aula via e-mail, grupos de mensagens ou LMS sem que o endereço mude entre aulas, permitindo que alunos em redes distintas ingressem na aula ao vivo sem depender de estarem no mesmo Wi-Fi.

---

##  Detalhes de Implementação Técnicos

- **Slug legível (RN-06)**: o slug tem o formato `{titulo-da-sala}/{nome-do-professor}`, derivado do título informado e do nome com que o professor entrou no app (não há login — ADR 0006). Criar uma nova sala encerra a sala anterior do mesmo professor.
- **Link na rede local**: `http://mlab.local:8080/<titulo>/<professor>/entrar` (mDNS) e `http://<ip-da-rede>:8080/<titulo>/<professor>/entrar` (IP da interface física, descartando adaptadores virtuais).
- **Vários professores na mesma rede**: cada backend anuncia o primeiro nome livre entre `mlab.local`, `mlab-2.local` … `mlab-20.local`, e o app mostra o link com o nome realmente anunciado. Sem anúncio mDNS, só o link por IP aparece (012, RF-121 a RF-128).
- **Fora da rede local (opcional)**: com `NGROK_URL`, `PUBLIC_URL` ou `BASE_URL`, o link principal usa esse endereço (ex.: `https://<hash>.ngrok-free.app/<titulo>/<professor>/entrar`).
- Botão de atalho "Copiar Link" no painel do professor copia a URL formatada para a área de transferência.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
- **Regras de Negócio:** [RN006 — Geração de Slug Legível e Único](../business-rules/RN006-geracao-de-slug-legivel-e-unico.md)
- **Link `mlab.local`:** RF-312 (`003-classroom-interaction`); nome único por professor: RF-121 a RF-128 (`012-mdns-nome-unico`)
- **Tarefas:** T009, T015, T030, T031
