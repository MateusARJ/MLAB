#  Índice Central de Requisitos — ScreenShare Classroom

> **Versão:** 1.2.0
> **Status:**  Aprovado para Desenvolvimento
> **Arquitetura:** WebRTC SFU (Pion Go) + Electron Desktop + React Web
> **Estrutura:** Arquivos individuais por Requisito e Regra de Negócio
>
> **Fonte de verdade:** este índice e `docs/requirements/**` são um espelho derivado das specs em
> `spec-kit/specs/<feature>/spec.md`. Em caso de conflito, vale a spec (ver `AGENTS.md` §1).

---

##  Estrutura de Pastas da Documentação

A documentação do projeto está organizada de forma modular nas seguintes pastas:

```
docs/requirements/
├──  functionals/       -> Requisitos Funcionais individuais (RF001.md, RF002.md, ...)
├──  non-functionals/   -> Requisitos Não Funcionais individuais (RNF001.md, RNF002.md, ...)
└──  business-rules/    -> Regras de Negócio individuais (RN001.md, RN002.md, ...)
```

---

##  1. Requisitos Funcionais (RF)

| ID | Nome do Requisito | Categoria | Link para Arquivo |
|---|---|---|:---:|
| **RF001** | Identificação de Papéis via JWT | Autenticação e Autorização | [ RF001](requirements/functionals/RF001-identificacao-de-papeis-via-jwt.md) |
| **RF002** | Publicação Exclusiva pelo Professor | Transmissão de Mídia | [ RF002](requirements/functionals/RF002-publicacao-exclusiva-pelo-professor.md) |
| **RF003** | Perfil Estritamente Espectador dos Alunos | Transmissão de Mídia | [ RF003](requirements/functionals/RF003-perfil-estritamente-espectador-dos-alunos.md) |
| **RF004** | Captura Nativa de Tela e Janela no Desktop | Captura de Mídia | [ RF004](requirements/functionals/RF004-captura-nativa-de-tela-e-janela-no-desktop.md) |
| **RF005** | Transmissão WebRTC via SFU Pion | Arquitetura de Mídia | [ RF005](requirements/functionals/RF005-transmissao-webrtc-via-sfu-pion.md) |
| **RF007** | Sinalização de Estado da Sala em Tempo Real | Sinalização & Protocolo | [ RF007](requirements/functionals/RF007-sinalizacao-de-estado-da-sala-em-tempo-real.md) |
| **RF008** | Coleta e Exposição de Métricas WebRTC | Observabilidade | [ RF008](requirements/functionals/RF008-coleta-e-exposicao-de-metricas-webrtc.md) |
| **RF009** | Chat de Texto em Tempo Real | Comunicação | [ RF009](requirements/functionals/RF009-chat-de-texto-em-tempo-real.md) |
| **RF010** | Captura e Controle do Microfone do Professor | Captura de Mídia | [ RF010](requirements/functionals/RF010-captura-e-controle-do-microfone-do-professor.md) |
| **RF011** | Identificação Obrigatória de Aluno (Nome e Matrícula) | Autenticação e Acesso | [ RF011](requirements/functionals/RF011-identificacao-obrigatoria-de-aluno-nome-e-matricula.md) |
| **RF012** | Autenticação de Professor no App Desktop | Autenticação e Acesso | [ RF012](requirements/functionals/RF012-autenticacao-de-professor-no-app-desktop.md) |
| **RF013** | Geração de Link Único de Convite | Gestão de Sala | [ RF013](requirements/functionals/RF013-geracao-de-link-unico-de-convite.md) |
| **RF014** | Operações REST Exclusivas do Professor | Autorização & API | [ RF014](requirements/functionals/RF014-operacoes-rest-exclusivas-do-professor.md) |
| **RF015** | Encerramento de Sala e Conexões | Gestão de Sala | [ RF015](requirements/functionals/RF015-encerramento-de-sala-e-conexoes.md) |
| **RF016** | Formatação de Identificação no Chat | Comunicação | [ RF016](requirements/functionals/RF016-formatacao-de-identificacao-no-chat.md) |
| **RF017** | Timestamp Server-Side e Descarte de Mensagens Vazias | Comunicação & Segurança | [ RF017](requirements/functionals/RF017-timestamp-server-side-e-descarte-de-mensagens-vazias.md) |
| **RF018** | Gestão de Reconexão do Professor (Timeout 30s) | Resiliência | [ RF018](requirements/functionals/RF018-gestao-de-reconexao-do-professor-timeout-30s.md) |
| **RF019** | Backoff Exponencial na Reconexão do Aluno | Resiliência | [ RF019](requirements/functionals/RF019-backoff-exponencial-na-reconexao-do-aluno.md) |
| **RF020** | Controle Independente de Mute e Pausa de Vídeo | Captura de Mídia | [ RF020](requirements/functionals/RF020-controle-independente-de-mute-e-pausa-de-video.md) |
| **RF021** | Tratamento de Autoplay Policy no Web Player | Player Web | [ RF021](requirements/functionals/RF021-tratamento-de-autoplay-policy-no-web-player.md) |
| **RF022** | Suporte aos Modos Fullscreen e Picture-in-Picture | Player Web | [ RF022](requirements/functionals/RF022-suporte-aos-modos-fullscreen-e-picture-in-picture.md) |
| **RF023** | Credenciais Epêmeras HMAC-SHA1 para TURN | Segurança & Rede | [ RF023](requirements/functionals/RF023-credenciais-epemeras-hmac-sha1-para-turn.md) |
| **RF024** | Verificação de Permissões do Sistema Operacional | App Desktop | [ RF024](requirements/functionals/RF024-verificacao-de-permissoes-do-sistema-operacional.md) |
| **RF025** | Monitoramento de Conexão e ICE Restart | Resiliência & Mídia | [ RF025](requirements/functionals/RF025-monitoramento-de-conexao-e-ice-restart.md) |

---

##  2. Requisitos Não Funcionais (RNF)

| ID | Nome do Requisito | Categoria | Meta / Alvo | Link para Arquivo |
|---|---|---|---|:---:|
| **RNF001** | Resolução Máxima Full HD 1080p | Qualidade de Vídeo | 1920x1080 @ 30 FPS | [ RNF001](requirements/non-functionals/RNF001-resolucao-maxima-full-hd-1080p.md) |
| **RNF002** | Taxa de Quadros Alvo de 30 FPS | Qualidade de Vídeo | 30 FPS contínuos | [ RNF002](requirements/non-functionals/RNF002-taxa-de-quadros-alvo-de-30-fps.md) |
| **RNF003** | Escalabilidade de 40 a 50 Alunos Simultâneos | Escalabilidade | 40–50 alunos / sala | [ RNF003](requirements/non-functionals/RNF003-escalabilidade-de-40-a-50-alunos-simultaneos.md) |
| **RNF004** | Observabilidade e Telemetria WebRTC | Observabilidade | Coleta a cada 2s | [ RNF004](requirements/non-functionals/RNF004-observabilidade-e-telemetria-webrtc.md) |
| **RNF005** | Segurança de Comunicação e Proteção de Segredos | Segurança | HTTPS, WSS, TLS 1.3 | [ RNF005](requirements/non-functionals/RNF005-seguranca-de-comunicacao-e-protecao-de-segredos.md) |
| **RNF006** | Interface Web Responsiva | Usabilidade | Desktop e Mobile | [ RNF006](requirements/non-functionals/RNF006-interface-web-responsiva.md) |
| **RNF007** | Distribuição Multi-Plataforma do App Desktop | Portabilidade | Windows, macOS, Linux | [ RNF007](requirements/non-functionals/RNF007-distribuicao-multi-plataforma-do-app-desktop.md) |
| **RNF008** | Latência Ponta a Ponta Menor que 500ms | Desempenho | < 500 ms | [ RNF008](requirements/non-functionals/RNF008-latencia-ponta-a-ponta-menor-que-500ms.md) |
| **RNF009** | Consumo Fixo de Upload do Professor | Desempenho de Rede | 3–6 Mbps constante | [ RNF009](requirements/non-functionals/RNF009-consumo-fixo-de-upload-do-professor.md) |
| **RNF010** | Homologação da Stack Tecnológica | Manutenibilidade | Go 1.22+, Pion, React | [ RNF010](requirements/non-functionals/RNF010-homologacao-da-stack-tecnologica.md) |
| **RNF013** | Keepalive e Heartbeat WebSocket | Confiabilidade | Ping 15s / Pong 30s | [ RNF013](requirements/non-functionals/RNF013-keepalive-e-heartbeat-websocket.md) |
| **RNF014** | Faixa Restrita de Portas UDP do SFU | Infraestrutura | Portas 50000–50100/UDP | [ RNF014](requirements/non-functionals/RNF014-faixa-restrita-de-portas-udp-do-sfu.md) |
| **RNF015** | Processamento Eficiente de CPU no Backend | Desempenho | Uso de CPU < 15% | [ RNF015](requirements/non-functionals/RNF015-processamento-eficiente-de-cpu-no-backend.md) |
| **RNF016** | Mídia Epêmera sem Retenção em Disco | Privacidade & LGPD | 0 bytes em disco | [ RNF016](requirements/non-functionals/RNF016-midia-epemera-sem-retencao-em-disco.md) |
| **RNF017** | Sanitização XSS no Chat de Texto | Segurança Web | Sanitização 100% | [ RNF017](requirements/non-functionals/RNF017-sanitizacao-xss-no-chat-de-texto.md) |

---

##  3. Regras de Negócio (RN)

| ID | Nome da Regra | Categoria | Link para Arquivo |
|---|---|---|:---:|
| **RN001** | Emissão JWT de Professor | Autenticação | [ RN001](requirements/business-rules/RN001-emissao-jwt-de-professor.md) |
| **RN002** | Emissão JWT de Aluno | Autenticação | [ RN002](requirements/business-rules/RN002-emissao-jwt-de-aluno.md) |
| **RN003** | Isolamento e Validação de JWT por Sala | Autorização | [ RN003](requirements/business-rules/RN003-isolamento-e-validacao-de-jwt-por-sala.md) |
| **RN004** | Restrição de Sessão Única por Aluno | Controle de Acesso | [ RN004](requirements/business-rules/RN004-restricao-de-sessao-unica-por-aluno.md) |
| **RN005** | Propriedade Exclusiva da Sala | Gestão de Sala | [ RN005](requirements/business-rules/RN005-propriedade-exclusiva-da-sala.md) |
| **RN006** | Geração de Slug Legível e Único | Gestão de Sala | [ RN006](requirements/business-rules/RN006-geracao-slug-legivel-e-unico.md) |
| **RN007** | Capacidade Máxima da Sala | Controle de Acesso | [ RN007](requirements/business-rules/RN007-capacidade-maxima-da-sala.md) |
| **RN008** | Rejeição de Acesso a Salas Encerradas | Ciclo de Vida da Sala | [ RN008](requirements/business-rules/RN008-rejeicao-de-acesso-a-salas-encerradas.md) |
| **RN009** | Editoria Única de Publicação de Mídia | Mídia & WebRTC | [ RN009](requirements/business-rules/RN009-editoria-unica-de-publicacao-de-midia.md) |
| **RN010** | Transmissão em Tracks Independentes | Mídia & WebRTC | [ RN010](requirements/business-rules/RN010-transmissao-em-tracks-independentes.md) |
| **RN011** | Validade Máxima de Credenciais TURN | Segurança & Infraestrutura | [ RN011](requirements/business-rules/RN011-validade-maxima-de-credenciais-turn.md) |
| **RN012** | Alteração de Fonte de Captura sem Desconexão | App Desktop | [ RN012](requirements/business-rules/RN012-alteracao-de-fonte-de-captura-sem-desconexao.md) |
| **RN013** | Janela de Reconexão do Publisher (30s) | Resiliência | [ RN013](requirements/business-rules/RN013-janela-de-reconexao-do-publisher-30s.md) |
| **RN014** | Estratégia de Backoff do Aluno | Resiliência | [ RN014](requirements/business-rules/RN014-estrategia-de-backoff-do-aluno.md) |
| **RN015** | Rate Limiting de Mensagens do Chat | Chat | [ RN015](requirements/business-rules/RN015-rate-limiting-de-mensagens-do-chat.md) |
| **RN016** | Penalidade por Rate Limit | Chat | [ RN016](requirements/business-rules/RN016-penalidade-por-rate-limit.md) |
| **RN017** | Sanitização e Descarte de Espaços em Branco | Chat | [ RN017](requirements/business-rules/RN017-sanitizacao-e-descarte-de-espacos-em-branco.md) |
| **RN018** | Ausência de Histórico Retroativo de Chat | Chat | [ RN018](requirements/business-rules/RN018-ausencia-de-historico-retroativo-de-chat.md) |
