# ADR 0006 — Descontinuação do login e sessão local do professor vinculada ao host

Status: APROVADA
Data: 2026-11-01
Feature impactada: `001-screen-share-core`, `002-security-hardening`
Supersede parcialmente: clarify C-01 (autenticação do professor por credenciais), ADR 0004 §2.1.A ("Hash de Senha: bcrypt"), US-01, RF-12, RN-01

## Contexto

O login do professor por e-mail e senha não é mais viável para o produto: o app é instalado na máquina do professor,
opera offline na LAN (ADR 0005) e não existe cadastro central de professores.

A tela de login já foi removida do app desktop (`4f3caad`). O app passou a chamar `POST /auth/session`, que recebe
só o nome. Porém:

- `POST /auth/session` emite um JWT com `role: professor` para **qualquer** requisição, de qualquer máquina da rede,
  inclusive pelo túnel ngrok e pelo proxy do Vite em desenvolvimento;
- o backend ainda mantém `POST /auth/login`, bcrypt, um store de professores e credenciais semeadas (`professor123`);
- o segredo JWT tem valor fixo de fallback (`dev-secret-key-12345`) no backend e no app desktop.

## Problema

É preciso garantir que só o professor (a pessoa usando o app na máquina que hospeda o backend) obtenha um token de
professor, sem reintroduzir conta ou senha. Pelo AGENTS.md (§9), alteração de autenticação exige ADR.

## Opções consideradas

### Opção A — Manter o login por e-mail e senha
Descontinuado pelo produto. Exigiria cadastro e recuperação de senha sem servidor central.

### Opção B — Manter `/auth/login` só para desenvolvimento
Código morto que precisa ser mantido e testado, além de manter credenciais semeadas no binário.

### Opção C — Aceitar `/auth/session` só de requisições locais (loopback)
Insuficiente: requisições vindas do túnel ngrok e do proxy do Vite chegam ao backend como `127.0.0.1`.

### Opção D — Sessão por nome com prova de posse do host (escolhida)
O processo principal do Electron gera uma chave aleatória a cada execução e a entrega ao backend (variável de
ambiente) e ao renderer (IPC). Só quem tem a chave obtém o token de professor.

## Decisão

1. **O login é descontinuado e removido por completo**: `POST /auth/login`, handler, store de professores,
   credenciais semeadas, bcrypt, tipos `LoginRequest`, testes e contratos. Não existe conta de professor no sistema.
2. **Identidade do professor = posse do computador onde o app roda.** O professor informa só o nome.
   `POST /auth/session` exige o header `X-MLab-Host-Key` igual a `MLAB_HOST_KEY` (comparação em tempo constante).
   Sem `MLAB_HOST_KEY` configurado, o backend recusa a sessão (fail-closed).
3. `MLAB_HOST_KEY` é gerada pelo processo principal do Electron a cada execução (32 bytes aleatórios), ou pelo
   `scripts/dev.js` no modo de desenvolvimento do monorepo. Nunca é versionada nem registrada em log.
4. **O segredo JWT é gerado aleatoriamente a cada execução do backend** quando `JWT_SECRET` não for fornecido.
   Não existe valor fixo de fallback.
5. As claims do JWT do professor não mudam (`sub`, `role`, `email` fixo, `name`, `exp`, TTL 8h), para preservar a
   derivação do link fixo do professor (T032). **Substituído pela ADR 0009 (2026-11-10):** a claim `email` deixou
   de existir; as claims são `sub`, `role`, `name`, `iat` e `exp`.
6. Os controles da ADR 0004 continuam valendo, exceto o hash de senha (2.1.A), que deixa de existir.

## Consequências

### Positivas
- Fecha a emissão irrestrita de tokens de professor na LAN, via ngrok e via proxy do Vite.
- Remove credenciais semeadas e o segredo JWT fixo do binário distribuído.
- Mantém a experiência atual: o professor entra só com o nome.

### Negativas
- Reiniciar o app invalida os tokens emitidos (sem impacto prático: as salas já são perdidas no reinício, ADR 0005).
- Um backend executado manualmente, fora do app e do `npm run dev`, precisa receber `MLAB_HOST_KEY` para permitir sessão.

## Impacto em specs/contracts/tasks

- `001/spec.md`: US-01, RF-12 e RN-01 reescritos.
- `001/clarify.md`: nota de supersessão em C-01 (parte do professor).
- `001/contracts/auth.md`: remover `POST /auth/login`, documentar `POST /auth/session`.
- `001/contracts/room-api.md`: pré-condição passa a ser o token da sessão.
- ADR 0004: nota apontando para esta ADR.
- `docs/requirements/functionals/RF012-*.md`, `docs/requirements/business-rules/RN001-*.md`: reescritos.
- Código: `002-security-hardening` S1 (segredo), S2 (chave de host) e S3 (remoção do login).

## Aprovação humana

- Responsável: MateusARJ (aprovação do plano de remediação, decisões D4 e remoção do login)
- Data: 2026-11-01
