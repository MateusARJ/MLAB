# ADR 0008 — HTTPS na LAN com autoridade certificadora (CA) local

Status: APROVADA — somente para a edição isolada "MLab HTTPS" (branch `edicao/https-lan`)
Data: 2026-11-06
Feature impactada: `003-classroom-interaction` (links da sala, download de arquivos), nova feature `011-https-lan`
Complementa: ADR 0005 (LAN offline), com exceção pontual à regra "sem persistência" (só material criptográfico)
Issue: #47

> **Escopo da aprovação:** esta decisão vale só para a edição **MLab HTTPS**, mantida na branch `edicao/https-lan` e
> **não mergeada na `development`**. O MLab principal continua em HTTP como define a ADR 0005. O professor escolhe
> qual das duas edições instalar.

## Contexto

O backend Go embarcado no app do professor entrega a página dos alunos, a API, o WebSocket e os arquivos
compartilhados **só por HTTP** (`apps/backend/cmd/server/main.go`, `http.ListenAndServe`). Os alunos entram por
`http://<IP>:8080` ou `http://mlab.local` (mDNS), e os links são montados com `http://` em
`apps/backend/internal/room/handler.go` (`buildRoomLinks`, `resolveBaseURL`).

Os alunos relataram que o Chrome e o Edge mostram **"Download inseguro bloqueado"** ao baixar PDF, documentos Office,
código-fonte e zip compartilhados pelo professor. O bloqueio vem do transporte: o navegador trata como inseguro o
download entregue por `http://`, independente do tipo do arquivo. Mudar headers (`Content-Type`,
`Content-Disposition`) não remove o aviso.

O único HTTPS existente hoje é pelo túnel ngrok (`NGROK_URL`), que exige internet e fere o modo primário da ADR 0005.

## Problema

Como entregar a página e os arquivos dos alunos por HTTPS **confiável pelo navegador**, sem internet e sem
infraestrutura da escola? Pelo AGENTS.md §9, introduzir TLS, nova porta e material criptográfico persistido é
decisão de segurança e infraestrutura e exige ADR.

## Opções consideradas

### Opção A — Manter HTTP
- Sem custo. Os downloads continuam bloqueados ou alertados, e alunos deixam de receber o material.

### Opção B — HTTPS na LAN com CA local por instalação (escolhida)
- O app do professor gera uma CA própria; cada aparelho de aluno instala o certificado dela uma vez.
- Funciona offline, sem domínio e sem serviço externo.
- Exige uma instalação única por aparelho, com atrito maior no celular (iOS) e em PCs gerenciados.

### Opção C — HTTPS com domínio público (hostname que codifica o IP e certificado wildcard)
- Dispensa a instalação no aluno, mas exige DNS público (internet) para resolver o nome, um domínio, renovação
  automática e distribuição da chave do certificado dentro do app. Conflita com a ADR 0005 e pode ser barrado pela
  proteção contra *DNS rebinding* dos roteadores.

### Opção D — Túnel HTTPS (ngrok ou equivalente)
- Já suportado, mas exige internet e passa o tráfego da aula por terceiros. Continua como alternativa opcional.

## Decisão

1. **CA por instalação.**
   - Na primeira execução, o backend gera uma CA raiz ECDSA P-256 própria daquela instalação do professor, com a
     biblioteca padrão do Go (`crypto/x509`, `crypto/ecdsa`, `crypto/tls`) e sem dependência nova.
   - Arquivos: `tls/mlab-ca.crt` e `tls/mlab-ca.key`, dentro do diretório de dados do app (`userData`; o backend já
     roda com `cwd = userData`).
   - A chave privada é gravada com permissão só do usuário e **nunca sai da máquina do professor**.
2. **Name Constraints críticas na CA.** A CA só pode emitir certificados para:
   - nomes `.local` e `localhost`;
   - endereços IP privados e loopback: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`.

   Se a chave vazar, ela não consegue personificar sites da internet.
3. **Certificados de servidor sob demanda.**
   - O certificado folha é emitido em memória, no handshake TLS (`tls.Config.GetCertificate`), para o nome SNI ou o
     IP local da conexão, com validade curta (≈30 dias) e cache em memória.
   - Ele acompanha a troca de IP da máquina e os nomes `mlab.local` / `mlab-<prof>.local`.
   - Folhas não são gravadas em disco.
4. **Duas portas.**
   - HTTPS em `WEB_TLS_PORT` (padrão `8443`) serve a página dos alunos, a API, o WebSocket (`wss:`) e os downloads.
   - A porta HTTP `8080` continua para o app do professor (`localhost`) e para a **página de entrada do aluno**.
   - A página de entrada testa se o aparelho já confia na CA (`/tls/ok` em HTTPS) e redireciona para HTTPS; se não
     confia, mostra a instalação do certificado (`/mlab-ca.crt`) por sistema operacional.
5. **Conferência da CA.** O app do professor mostra a impressão digital SHA-256 curta da CA, e a página de instalação
   mostra a mesma, para o aluno conferir que instala o certificado certo. O app também permite exportar o certificado
   para a TI distribuir por política (ex.: GPO) nos PCs gerenciados.
6. **Ativação.** O TLS fica ligado no app empacotado e é opcional no modo de desenvolvimento (`MLAB_TLS`), para não
   quebrar `npm run dev`. O ngrok (Opção D) continua disponível.
7. **Edição separada.** A edição tem nome de produto e identificador próprios ("MLab HTTPS",
   `com.mlab.classroom.https`). Por isso pode ser instalada ao lado do MLab normal, com dados (e CA) separados. Só não
   devem rodar ao mesmo tempo, porque usam as mesmas portas.
8. **Sem caminho HTTP para o aluno.** A página de instalação oferece o botão **"Continuar com HTTPS"**, que testa de
   novo a confiança e redireciona. Não há opção de seguir a aula pelo HTTP nesta edição.

## Consequências

### Positivas
- Downloads e página do aluno passam a usar HTTPS confiável: some o "Download inseguro bloqueado".
- Contexto seguro no navegador do aluno (pré-requisito de APIs modernas) e tráfego cifrado na LAN.
- Continua offline, sem domínio, sem serviço externo e sem dependência nova.

### Negativas
- **Instalação única por aparelho de aluno.**
  - No iOS é preciso ativar a confiança em "Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados".
  - O Firefox usa repositório próprio.
  - PCs gerenciados podem exigir a TI.
- **Exceção à ADR 0005 ("sem persistência"):** a CA (certificado e chave) fica em disco entre execuções. Nenhum dado de
  aula passa a ser persistido.
- **Reinstalar o app ou apagar o `userData` gera uma CA nova**, e os alunos precisam instalar de novo.
- O próprio certificado da CA é baixado pelo HTTP (ainda não há confiança), então o navegador pode avisar nesse único
  download. A página orienta o aluno a escolher "Manter" e a conferir a impressão digital.
- Nova porta de rede (`8443`) para liberar no firewall junto com a `8080`.
- Risco residual: quem obtiver a chave da CA e estiver na mesma LAN pode personificar nomes `.local` e IPs privados
  para os aparelhos que confiam nela. Mitigado por Name Constraints, permissão de arquivo e CA por instalação. As
  instruções incluem como remover o certificado.

## Impacto em specs/contracts/tasks

- Nova feature `spec-kit/specs/011-https-lan/` (spec, clarify, plan com Scope Lock, checklist, tasks, analyze).
- `003-classroom-interaction/contracts/`:
  - resposta de criação de sala com `https_link`, `ca_fingerprint` e `ca_url`;
  - rotas `/certificado`, `/mlab-ca.crt` e `/tls/ok`.
- `packages/types`: tipos dos links da sala.
- `AGENTS.md` §9: incluir esta ADR na lista de ADRs aprovadas.
- `AGENTS.md` §2 e `docs/`: registrar o HTTPS na LAN e a página de instalação do certificado.

## Aprovação humana

- Responsável: MateusARJ. Aprovou a opção B e pediu a implementação como edição isolada, fora da `development`.
- Data: 2026-11-06
