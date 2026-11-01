# Spec: Endurecimento de Segurança

Status: READY-FOR-PLAN
Feature ID: `002-security-hardening`
Origem: análise de 2026-10-31 e `spec-kit/specs/001-screen-share-core/converge.md`; decisões nas ADRs 0005 e 0006.

## 1. Objetivo

Corrigir as falhas de segurança encontradas no MLab sem remover nem alterar nenhuma funcionalidade em uso, exceto
o login do professor, descontinuado pela ADR 0006.

## 2. Escopo

### Incluído

- segredo JWT sem valor fixo (S1);
- emissão de sessão de professor só com chave de host (S2);
- remoção completa do login do professor (S3);
- autenticação e limites de memória dos arquivos da sala (S4);
- seleção determinística da sala ativa (S5);
- allowlist de origem no WebSocket e no CORS (S6);
- endurecimento do Electron: navegação, janelas externas, sandbox (S7);
- remoção de caminho absoluto local no app desktop (S8).

### Não incluído

- qualquer mudança de UX;
- remoção de outra funcionalidade;
- troca de stack, persistência, renomear claims do JWT;
- checagem de papel em `request-keyframe` (achado registrado em `001/converge.md`; aguarda decisão — C-204).

## 3. Atores

Professor (app desktop), aluno (navegador), atacante na mesma rede local, atacante via túnel ngrok.

## 4. User Stories

### US-S1 — Tokens não forjáveis
**Como** professor, **quero** que ninguém consiga forjar tokens da minha sala.
- O backend nunca usa segredo JWT fixo; sem `JWT_SECRET`, gera 32 bytes aleatórios por execução.
- O segredo nunca aparece em log.

### US-S2 — Só o professor obtém token de professor
**Como** professor, **quero** que só o app na minha máquina consiga abrir sessão de professor.
- `POST /auth/session` exige `X-MLab-Host-Key` válido; sem ele, `403`.
- O professor continua entrando só com o nome.

### US-S3 — Sem credenciais embutidas
**Como** responsável pelo produto, **quero** que o binário não contenha login, senha ou conta de professor.
- `POST /auth/login` responde `404`; não há store de professores nem bcrypt.

### US-S4 — Arquivos só para a turma
**Como** professor, **quero** que só alunos da minha sala listem e baixem os arquivos.
- Listagem e download exigem token da sala; limites de memória por sala; arquivos liberados no encerramento.

### US-S5 — Aluno cai na sala certa
**Como** aluno, **quero** ser redirecionado sempre para a sala ativa correta.

### US-S6 — Conexões só de origens conhecidas
**Como** professor, **quero** que páginas de terceiros não abram WebSocket nem chamem a API da minha sala pelo navegador do aluno.

### US-S7 — Renderer isolado
**Como** professor, **quero** que o app não navegue nem abra janelas para sites externos dentro do próprio app.

### US-S8 — Build portátil
**Como** mantenedor, **quero** que o app não dependa de caminhos da máquina de um desenvolvedor.

## 5. Requisitos Não Funcionais de Segurança

- RNF-SEC-01 (S1): segredo JWT aleatório por execução quando não fornecido; nunca registrado.
- RNF-SEC-02 (S2): sessão de professor exige chave de host comparada em tempo constante; fail-closed.
- RNF-SEC-03 (S3): nenhum endpoint, store ou credencial de login no backend.
- RNF-SEC-04 (S4): listagem/download de arquivos exigem token da sala; teto de 300 MB e 50 arquivos por sala; `413` acima; `X-Content-Type-Options: nosniff`; liberação no encerramento.
- RNF-SEC-05 (S5): `/rooms/active` determinístico (publishing > waiting mais recente).
- RNF-SEC-06 (S6): WebSocket e CORS aceitam só origens da allowlist; nunca `*` nem `true` incondicional.
- RNF-SEC-07 (S7): bloqueio de navegação e de janelas externas; links externos abertos no navegador do sistema; sandbox do renderer quando compatível.
- RNF-SEC-08 (S8): nenhum caminho absoluto de máquina de desenvolvedor no código.

## 6. Regras de Negócio

- RN-S01: o caminho legítimo (app desktop local, alunos na LAN, `mlab.local`, ngrok, celular) continua funcionando sem passo extra.
- RN-S02: toda correção é validada pela suíte completa e pela matriz de smoke do plano de remediação.

## 7. Critérios de Sucesso

- Requisição a `POST /auth/session` de outra máquina retorna `403`.
- `POST /auth/login` retorna `404`.
- Download de arquivo sem token retorna `401`.
- Página de origem desconhecida não consegue abrir o WebSocket.
- Todas as suítes verdes e matriz de smoke sem regressão em relação à baseline.
