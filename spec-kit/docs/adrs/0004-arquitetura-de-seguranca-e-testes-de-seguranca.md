# ADR 0004: Arquitetura de Segurança e Testes de Segurança

* **Status:** Aceito
* **Data:** 2026-09-14
* **Autores:** Antigravity AI & Equipe de Engenharia
* **Componentes Impactados:** `apps/backend`, `apps/desktop`, `apps/web`, `spec-kit`

---

## 1. Contexto

A plataforma ScreenShare Classroom lida com transmissão ao vivo de vídeo e áudio educacional, autenticação de professores e alunos, e troca de mensagens via chat em tempo real.

É fundamental proteger a plataforma contra acessos não autorizados, personificação de usuários, sequestro de sessões (session hijacking), vazamento de credenciais de infraestrutura (servidores TURN), injeção de scripts (XSS), ataques de negação de serviço (DoS/rate limit bypass) e tentativas de interceptação de tráfego.

---

## 2. Decisão

Decidimos implementar uma arquitetura de segurança em camadas acompanhada por uma suíte dedicada de **testes automatizados de segurança**.

### 2.1. Arquitetura de Segurança por Camada

#### A. Autenticação e Autorização (JWT)

> **Nota (2026-11-01):** o item "Hash de Senha (bcrypt)" foi superado pela [ADR 0006](0006-descontinuacao-do-login-e-sessao-local.md) — o login do professor foi descontinuado e a sessão passou a exigir chave de host. Os demais controles desta ADR permanecem.

- **Hash de Senha:** Professores são autenticados usando senhas tratadas com `bcrypt` (custo >= 10).
- **Claims Auditadas no JWT:** Os tokens contêm obrigatoriamente `sub`, `role` (`professor` ou `aluno`), `room_id` e data de expiração (`exp`).
- **Validação de Propriedade:** O backend verifica se o `owner_id` da sala corresponde ao `sub` do JWT em qualquer operação REST de gerenciamento ou `publish-request`.

#### B. Segurança de Transporte e Infraestrutura
- **Criptografia em Trânsito:** Obrigatoriedade de HTTPS e WSS em ambiente de produção com TLS 1.3.
- **Credenciais Epêmeras TURN (RFC 8489):** Não utilizar senhas estáticas de TURN. O backend gera credenciais temporárias baseadas em HMAC-SHA1 dinâmico derivadas de `TURN_SECRET` com validade máxima de 24 horas.
- **Isolamento de Redes UDP:** O SFU Pion opera em faixa estrita de portas UDP (`50000–50100`) para regras de firewall enxutas.

#### C. Proteção de Sessão e Abuso
- **Sessão Única por Aluno:** A tentativa de conexão de uma segunda sessão WebSocket com a mesma Matrícula e `room_id` desconecta sumariamente a sessão anterior com o código `4001 Duplicate Session`.
- **Rate Limiting no Chat:** Limite server-side de 5 mensagens/5s e 30 mensagens/minuto por participante com retorno `CHAT_RATE_LIMITED`.
- **Prevenção XSS:** Sanitização e escape estrito de HTML no servidor e no frontend antes do envio e renderização do chat.
- **Descarte de Payloads Nulos:** Mensagens vazias ou contendo apenas espaços em branco são descartadas antes da sinalização.

---

### 2.2. Suíte de Testes Automatizados de Segurança

Adicionamos testes de segurança obrigatórios automatizados para validar cada controle defensivo:

1. **Testes de Falsificação e Expiração de JWT (`auth_security_test.go`):**
   - Testar tentativa de acesso com JWT assinado por chave secreta inválida (deve retornar HTTP 401).
   - Testar tentativa de acesso com JWT expirado (deve retornar HTTP 401).
   - Testar manipulação de claims (ex: alterar `role: aluno` para `role: professor`) (deve falhar a verificação).

2. **Testes de Autorização de Sala (`room_security_test.go`):**
   - Testar aluno tentando chamar `POST /rooms/{id}/close` (deve retornar HTTP 403 Forbidden).
   - Testar professor tentando encerrar sala pertencente a outro professor (deve retornar HTTP 403 Forbidden).
   - Testar aluno tentando enviar `publish-request` no WebSocket (deve retornar erro WS `FORBIDDEN`).

3. **Testes de Sessão Única e Rate Limit (`signaling_security_test.go`):**
   - Testar conexão simultânea do mesmo aluno em duas abas/clientes (deve fechar a primeira conexão com código `4001`).
   - Testar envio de 6 mensagens de chat em menos de 5 segundos (a 6ª mensagem deve receber `CHAT_RATE_LIMITED`).

4. **Testes de Sanitização XSS (`chat_security_test.go`):**
   - Testar envio de payload `<script>alert('xss')</script>` no chat (deve ser escapado para `&lt;script&gt;...` no servidor e no client).

5. **Testes de HMAC TURN (`turn_security_test.go`):**
   - Validar se a senha do TURN gerada confere com a assinatura HMAC-SHA1 calculada pelo servidor e expira após a janela limite.

---

## 3. Consequências

### Positivas
- **Segurança Proativa:** Vulnerabilidades como elevação de privilégio, XSS e reutilização indevida de sessão são detectadas automaticamente durante o build.
- **Conformidade LGPD:** Garantia de que mídias e dados de navegação são epêmeros e isolados por sala.
- **Proteção contra DoS:** Rate limiting e descarte de mensagens vazias evitam sobrecarga nos Hubs da sala.

### Mitigações
- As rotinas de teste de segurança rodam integradas à suíte unitária de testes (`go test ./...`), garantindo execução sem impacto no fluxo de trabalho dos desenvolvedores.
