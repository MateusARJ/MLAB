# MLab HTTPS

<p align="center">
  <img src="MLAB-logo.png" alt="MLab Logo" width="220" />
</p>

<p align="center">
  <strong>Edição do MLab que entrega a aula e os arquivos por HTTPS na rede local</strong><br />
  Mesmo app do professor, com uma autoridade certificadora (CA) própria do MLab instalada nos aparelhos dos alunos.
</p>

<p align="center">
  <a href="#o-que-é-esta-edição">O que é</a> ·
  <a href="#instalar-o-mlab-https-professor">Instalar o app</a> ·
  <a href="#instalar-o-certificado-alunos">Instalar o certificado</a> ·
  <a href="#instalar-em-todo-o-laboratório-ti">Laboratório inteiro</a> ·
  <a href="#solução-de-problemas">Problemas</a>
</p>

> **Esta é a branch `edicao/https-lan`.** Ela fica sempre atualizada com a `main` por rebase, mas **nunca é
> mergeada nela**. O MLab principal continua em HTTP. Para a documentação geral do MLab (funcionalidades, requisitos,
> primeira aula, desenvolvimento), veja o [README da branch `main`](https://github.com/MateusARJ/MLAB/blob/main/README.md).

---

## O que é esta edição

No MLab normal, a página dos alunos e os arquivos compartilhados chegam por `http://`. O Chrome e o Edge bloqueiam ou
alertam downloads fora de HTTPS ("Download inseguro bloqueado"), seja qual for o tipo do arquivo. Nenhuma autoridade
pública emite certificado para IP de rede local ou nomes `.local`.

O **MLab HTTPS** resolve isso com uma CA própria:

1. Na primeira vez que abre, o app cria a **CA do MLab** (`mlab-ca.crt` e `mlab-ca.key`) na pasta de dados do app, em
   `tls/`.
   - A chave privada **nunca sai do computador do professor** e nunca é servida pela rede.
   - A CA só pode emitir certificados para nomes `.local`, `localhost` e IPs de rede local (Name Constraints). **Ela
     não serve para nenhum site da internet**, mesmo que alguém copie o certificado.
2. O backend continua na porta **8080 (HTTP)** e passa a servir também a porta **8443 (HTTPS)**, com certificados
   gerados na hora para o IP ou nome acessado.
3. O professor compartilha **o mesmo link de sempre** (`http://<IP>:8080/...` ou `http://mlab.local:8080/...`).
4. Ao abrir o link, a página do aluno testa se o aparelho já confia na CA:
   - **se confia**, vai sozinha para `https://<mesmo endereço>:8443/...`, e a aula e os downloads funcionam sem aviso;
   - **se não confia**, mostra **"Conexão segura do MLab"**, com o passo a passo para o sistema do aluno, a impressão
     digital para conferir e o botão **"Continuar com HTTPS"**.

| | MLab | MLab HTTPS |
|---|---|---|
| Link dos alunos | `http://` | o mesmo `http://`, que redireciona para `https://:8443` |
| Downloads no Chrome/Edge | podem ser bloqueados | sem aviso |
| Preparação dos alunos | nenhuma | instalar o certificado uma vez por aparelho |
| Portas | 8080 | 8080 e 8443 |

Decisão e detalhes: [ADR 0008](spec-kit/docs/adrs/0008-https-na-lan-com-ca-local.md),
[spec 011](spec-kit/specs/011-https-lan/spec.md), [contrato](spec-kit/specs/011-https-lan/contracts/tls.md) e
[guia completo](docs/https-lan.md).

## Instalar o MLab HTTPS (professor)

Os instaladores desta edição **não são publicados nas releases** do MLab. Gere o instalador a partir desta branch:

```bash
git clone -b edicao/https-lan https://github.com/MateusARJ/MLAB.git mlab-https
cd mlab-https
npm ci
npm run make:win      # Windows: apps/desktop/dist/MLab HTTPS-Setup-<versão>.exe
npm run make:linux    # Linux (via WSL no Windows): .AppImage e .deb
```

Pré-requisitos e detalhes do build: seção "Ambiente de Desenvolvimento" do [README principal](https://github.com/MateusARJ/MLAB/blob/main/README.md).

Depois de instalar:

- O Dashboard mostra o cartão **"HTTPS na rede local"** com a **impressão digital** da CA (ex.: `8255 16AE 2F69 214F`).
  Peça aos alunos para conferirem que é a mesma da página de instalação.
- **Firewall do Windows:** na primeira execução, libere o `mlab-backend.exe` para **redes privadas**. A 8443 fica
  liberada junto com a 8080.
- O MLab HTTPS pode ficar instalado ao lado do MLab normal, mas **não abra os dois ao mesmo tempo**: eles usam as
  mesmas portas.
- **Reinstalar o app gera uma CA nova.** O desinstalador apaga os dados do app, e os alunos precisam instalar o novo
  certificado (e remover o antigo).
- Na primeira aula, reserve uns 2 minutos para os alunos instalarem o certificado.

## Instalar o certificado (alunos)

O aluno abre o link da sala normalmente. Se o aparelho ainda não confia na CA, a página mostra o passo a passo do
sistema detectado e o botão para baixar o `mlab-ca.crt` (também em `http://<IP>:8080/mlab-ca.crt`).

> **Antes de instalar, confira a impressão digital** mostrada na página com a que o professor mostra no app. Se forem
> diferentes, não instale.

O download do certificado é feito por HTTP. Se o navegador avisar, escolha **Manter**.

| Sistema | Como instalar |
|---|---|
| **Windows** (Chrome/Edge) | Abra o `mlab-ca.crt` › **Instalar Certificado** › **Usuário Atual** › **Colocar todos os certificados no repositório a seguir** › **Autoridades de Certificação Raiz Confiáveis** › Concluir › **Sim** no aviso de segurança. Feche e abra o navegador. |
| **Android** | Configurações › Segurança › Criptografia e credenciais › **Instalar certificado** › **Certificado CA** › Instalar mesmo assim › escolha o `mlab-ca.crt`. Exige bloqueio de tela. O caminho muda um pouco por fabricante (procure "certificado" nas configurações). |
| **iPhone / iPad** | Abra o link no **Safari** e baixe o certificado › Ajustes › Geral › **VPN e Gerenciamento de Dispositivo** › "MLab CA local" › **Instalar**. Depois, Ajustes › Geral › Sobre › **Ajustes de Confiança de Certificados** › ative "MLab CA local". |
| **macOS** | Abra o `mlab-ca.crt` (vai para o **Acesso às Chaves**) › clique duas vezes em "MLab CA local" › **Confiança** › **Ao usar este certificado: Sempre Confiar**. |
| **Linux / ChromeOS** (Chrome) | Configurações › Privacidade e segurança › Segurança › **Gerenciar certificados** › **Autoridades** › **Importar** › marque "Confiar neste certificado para identificar sites". |
| **Firefox** (qualquer sistema) | Configurações › Privacidade e Segurança › Certificados › **Ver certificados** › **Autoridades** › **Importar** › marque "Confiar nesta CA para identificar sites". |

Depois de instalar, toque em **"Continuar com HTTPS"**. Nas próximas aulas o aparelho vai direto para o HTTPS.

**Remover:** apague "MLab CA local" da lista de certificados/autoridades do aparelho ou do navegador.

## Instalar em todo o laboratório (TI)

No app do professor, **Exportar certificado (para a TI do laboratório)** baixa o `mlab-ca.crt`. Com ele:

- **Windows, por máquina** (prompt como administrador):

  ```bat
  certutil -addstore -f Root mlab-ca.crt
  ```

- **Windows, em lote:** GPO › Configuração do Computador › Políticas › Configurações do Windows › Configurações de
  Segurança › Políticas de Chave Pública › **Autoridades de Certificação Raiz Confiáveis** › Importar.
- **Firefox gerenciado:** política `Certificates.Install` (ou `ImportEnterpriseRoots: true` para usar o repositório do
  Windows).
- **Linux (Chrome/Chromium, por usuário):** `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "MLab CA local" -i mlab-ca.crt`
  (pacote `libnss3-tools`).

Se o professor reinstalar o MLab HTTPS, a CA muda: exporte e distribua o novo certificado.

## Solução de problemas

| Sintoma | O que fazer |
|---|---|
| A página fica em "Conexão segura do MLab" mesmo depois de instalar | Feche **todas** as janelas do navegador e abra de novo. No Windows, confira se o certificado foi para "Autoridades de Certificação Raiz Confiáveis", não para "Pessoal". |
| "Continuar com HTTPS" não abre a aula | A porta 8443 pode estar bloqueada no firewall do PC do professor. Libere o `mlab-backend.exe` para redes privadas. |
| A impressão digital do aluno é diferente da do professor | Não instale. Confira se o aluno está na mesma rede e no endereço certo do professor. |
| Os alunos voltaram a ver o passo a passo | O app foi reinstalado e a CA mudou. Remova o certificado antigo e instale o novo. |
| Erro de porta ao abrir o app | O MLab normal está aberto. Feche-o: as duas edições usam as mesmas portas. |

## Desenvolvimento

`npm run dev` usa o Vite por HTTP. Nesse modo, `/tls/info` responde `enabled: false` e a página não redireciona. Para
testar o fluxo completo, sirva o build do web pelo backend:

```bash
npm run build -w @mlab/web
cd apps/backend
MLAB_TLS=1 MLAB_TLS_DIR=./tls-dev WEB_DIR=../web/dist MLAB_HOST_KEY=dev go run ./cmd/server
# aluno: http://<IP>:8080/sala/<slug>/entrar
```

| Variável | Padrão | Uso |
|---|---|---|
| `MLAB_TLS` | — | `1` liga o HTTPS (o app MLab HTTPS já passa) |
| `WEB_TLS_PORT` | `8443` | porta HTTPS |
| `MLAB_TLS_DIR` | `tls` | pasta da CA, relativa ao diretório de trabalho (a pasta de dados do app) |

A pasta `apps/backend/tls-dev/` está no `.gitignore`: **nunca versione a chave da CA**.

### Manter a edição atualizada

A branch é protegida (PR obrigatório, commits assinados, sem force push). Para trazer as novidades da `main`:

1. Rebase local: `git rebase mlab/main` na `edicao/https-lan`.
2. Em conflito no `README.md`, mantenha **este** README (o da edição).
3. O push do rebase exige desligar temporariamente a ruleset da edição.

## Licença

[Apache 2.0](LICENSE), a partir da 2.3.1. Quem redistribuir o MLab HTTPS deve repassar também o arquivo [`NOTICE`](NOTICE) ([ADR 0012](spec-kit/docs/adrs/0012-licenca-apache-2-0.md)).
