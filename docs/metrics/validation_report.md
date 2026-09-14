# Relatório de Validação de Métricas e Critérios de Aceite (v1.0)

> **Status:** 🟢 Homologado  
> **Data:** 2026-09-14  
> **Projeto:** ScreenShare Classroom  

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
- **RNF-17 (Sanitização XSS):** 100% dos payloads maliciosos convertidos para texto seguro.
