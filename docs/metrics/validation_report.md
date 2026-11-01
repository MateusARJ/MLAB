# Relatório de Validação de Métricas e Critérios de Aceite (v1.0)

> **Status:** 🟢 Homologado  
> **Data:** 2026-09-14  
> **Projeto:** MLab  

---

## 1. Matriz de Homologação dos Critérios de Sucesso (CS-01 a CS-08)

| Item | Critério de Sucesso | Requisitos Vinculados | Status | Resultado Medido |
|---|---|---|:---:|---|
| **CS-01** | Suporte a 40+ espectadores simultâneos assistindo à aula. | RF-05, RF-06, RNF-03 | ✅ Aprovado | Validado com 40 assinantes simultâneos via Pion SFU. |
| **CS-02** | Consumo de upload fixo do professor entre 3 e 6 Mbps. | RF-05, RNF-09 | ✅ Aprovado | Medido em 4.2 Mbps constante (Upstream único). |
| **CS-03** | Transmissão Full HD 1080p a 30 FPS operacionais. | RNF-01, RNF-02 | ✅ Aprovado | Alvo mantido em 30 FPS estáveis em ambiente WAN controlada. |
| **CS-04** | Latência ponta a ponta menor que 500 ms. | RNF-08 | ✅ Aprovado | Latência de captura a renderização de 180 ms (RTT < 50ms). |
| **CS-05** | Encerramento limpo de mídias no SFU sem processos/tracks órfãos. | RF-15, RN-13 | ✅ Aprovado | Destruição total de conexões e memória limpa no `RoomClosed`. |
| **CS-06** | Ingressantes Web entram sem instalar programas ou plugins. | RF-11, RNF-06 | ✅ Aprovado | Acesso direto via navegador (Nome + Matrícula). |
| **CS-07** | Chat de texto em tempo real com sanitização e rate limit. | RF-09, RF-16, RF-17, RN-15 | ✅ Aprovado | Entrega em tempo real via WS, XSS escapado, limit 5/5s. |
| **CS-08** | Tolerância a desconexão do professor de até 30 segundos. | RF-18, RN-13 | ✅ Aprovado | Timer de 30s reestabelece a sala sem gerar nova sessão. |

---

## 2. Validação dos Requisitos Não Funcionais (RNFs)

- **RNF-14 (Portas UDP do SFU):** Faixa delimitada entre 50000 e 50100/UDP.
- **RNF-15 (Uso de CPU):** CPU do backend medida em **8.4%** durante pico de 40 alunos (alvo < 15%).
- **RNF-16 (Privacidade LGPD):** Repasse de mídia 100% epêmero em RAM sem gravações em disco.
- **RNF-17 (Sanitização XSS):** 100% dos payloads maliciosos convertidos para texto seguro (integrado ao `hub.onChatMessage` e `chat.Service`).

---

## 3. Matriz de Cobertura de Testes Automatizados (ADR 0003 & ADR 0004)

| Módulo / Pacote | Arquivos de Teste | Suíte / Casos de Teste | Status | Tempo de Execução |
|---|---|---|:---:|:---:|
| **Backend / Auth** | `auth_test.go`<br>`auth_security_test.go` | Tokens JWT (emissão, parsing, expiração), bcrypt, middleware, proteção contra segredos forjados, manipulação de claims e algoritmo `none`. | ✅ 10/10 PASS | < 1.0s |
| **Backend / Room** | `room_test.go`<br>`room_security_test.go` | Formato de slugs, geração de links, lifecycle de sala, limites de capacidade (429), sala fechada (409) e controle de propriedade (403). | ✅ 5/5 PASS | < 0.6s |
| **Backend / Signaling** | `hub_test.go`<br>`signaling_security_test.go` | Rate limit de chat (5/5s, 30/60s), credenciais efêmeras HMAC-SHA1 TURN (24h), upgrade WS auth, sanitização XSS e descarte de mensagens vazias. | ✅ 7/7 PASS | < 0.6s |
| **Backend / WebRTC** | `sfu_test.go`<br>`sfu_security_test.go` | Isolamento de mídias por sala, despejo de sessão duplicada de aluno e ciclo completo de upstream/downstream Pion SFU. | ✅ 3/3 PASS | < 2.6s |
| **Backend / Chat** | `chat_test.go`<br>`chat_security_test.go` | Formatação de mensagens, timestamps server-side e neutralização de injeções XSS (`html.EscapeString`). | ✅ 2/2 PASS | < 0.5s |
| **Frontend Web** | `Join.test.tsx`<br>`Room.test.tsx` | Formulário de identificação de aluno, Autoplay Policy banner, controles Fullscreen/PiP e renderização do chat sanitizado. | ✅ 5/5 PASS | < 2.0s |
| **Frontend Desktop** | `Login.test.tsx`<br>`Dashboard.test.tsx`<br>`Room.test.tsx` | Autenticação do professor, criação de sala, cópia de link, captura de tela via `electronAPI` e encerramento de transmissão. | ✅ 6/6 PASS | < 2.0s |

**Total de testes automatizados:** 38 testes executados e aprovados com 100% de sucesso.

---

> **Nota (2026-11-01):** este relatório é histórico. As menções a login, `bcrypt` e `Login.test.tsx` referem-se ao login do professor, descontinuado pela ADR 0006 (`spec-kit/docs/adrs/0006-descontinuacao-do-login-e-sessao-local.md`). As metas de desempenho devem ser remedidas após os commits `29c54d0` e `1ed55d1` (ver `spec-kit/specs/001-screen-share-core/converge.md`).
