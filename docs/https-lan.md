# MLab HTTPS — HTTPS na rede local com certificado do MLab

Edição isolada do MLab (ADR 0008, feature `011-https-lan`), mantida na branch `edicao/https-lan` e **não mergeada na
`main`**. O professor escolhe entre instalar o **MLab** (HTTP, como sempre) ou o **MLab HTTPS**.

## Por que existe

Na versão normal, a página dos alunos e os arquivos compartilhados chegam por `http://`. O Chrome e o Edge bloqueiam
ou alertam downloads fora de HTTPS ("Download inseguro bloqueado"), seja qual for o tipo do arquivo. Nenhuma
autoridade pública emite certificado para IP de rede local ou nomes `.local`. Por isso o MLab HTTPS cria a própria
autoridade certificadora (CA), e cada aparelho de aluno passa a confiar nela.

## Como funciona

1. Na primeira vez que o MLab HTTPS abre, ele cria a **CA do MLab** na pasta de dados do app (`tls/mlab-ca.crt` e
   `tls/mlab-ca.key`).
   - A chave nunca sai do computador do professor.
   - A CA só pode emitir certificados para endereços `.local`, `localhost` e IPs de rede local. Ela não serve para
     nenhum site da internet.
2. O backend continua na porta **8080 (HTTP)** e passa a servir também a porta **8443 (HTTPS)**, com certificados
   gerados na hora para o IP ou nome acessado.
3. O professor compartilha **o mesmo link de sempre** (`http://<IP>:8080/...` ou `http://mlab.local:8080/...`).
4. Ao abrir o link, a página do aluno testa se o aparelho já confia na CA:
   - **se confia**, vai sozinha para `https://<mesmo endereço>:8443/...`, e a aula e os downloads funcionam sem
     aviso;
   - **se não confia**, mostra **"Conexão segura do MLab"**, com o passo a passo de instalação do certificado, a
     impressão digital para conferir e o botão **"Continuar com HTTPS"**.

## Para o professor

- O Dashboard mostra o cartão **"HTTPS na rede local"** com a **impressão digital** da CA (ex.: `8255 16AE 2F69 214F`).
  Peça aos alunos para conferirem que é a mesma da página de instalação.
- **Exportar certificado:** baixa o `mlab-ca.crt` para a TI instalar em todos os PCs do laboratório de uma vez, por
  política de grupo (GPO) ou ferramenta de gestão.
- Na primeira aula, reserve uns 2 minutos para os alunos instalarem o certificado.
- **Reinstalar o app gera uma CA nova**. O desinstalador apaga os dados do app, e os alunos precisam instalar o novo
  certificado.
- O MLab HTTPS pode ficar instalado ao lado do MLab normal, mas **não rode os dois ao mesmo tempo**: eles usam as
  mesmas portas.
- Firewall: o Windows pede liberação por programa (`mlab-backend.exe`). Libere para redes privadas, e a 8443 fica liberada
  junto com a 8080.

## Para o aluno (resumo; a página mostra o passo a passo do sistema detectado)

| Sistema | Onde instalar |
|---|---|
| Windows (Chrome/Edge) | abrir `mlab-ca.crt` > Instalar Certificado > Usuário Atual > "Autoridades de Certificação Raiz Confiáveis" |
| Android | Configurações > Segurança > Criptografia e credenciais > Instalar certificado > Certificado CA (exige bloqueio de tela) |
| iPhone/iPad | baixar no Safari > Ajustes > Geral > VPN e Gerenciamento de Dispositivo > Instalar; depois Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados > ativar |
| macOS | abrir o certificado > Acesso às Chaves > "MLab CA local" > Confiar > Sempre Confiar |
| Linux/ChromeOS (Chrome) | Configurações > Segurança > Gerenciar certificados > Autoridades > Importar |
| Firefox (qualquer sistema) | Configurações > Privacidade e Segurança > Certificados > Ver certificados > Autoridades > Importar |

- O próprio download do certificado é feito por HTTP. Se o navegador avisar, o aluno escolhe **Manter**.
- **Remover:** apagar "MLab CA local" da lista de certificados/autoridades do aparelho ou do navegador.

## Testar localmente (desenvolvimento)

`npm run dev` usa o Vite por HTTP. Nesse modo, `/tls/info` responde `enabled: false` e a página não redireciona.
Para testar o fluxo completo, sirva o build do web pelo backend:

```bash
npm run build -w @mlab/web
cd apps/backend
MLAB_TLS=1 MLAB_TLS_DIR=./tls-dev WEB_DIR=../web/dist MLAB_HOST_KEY=dev go run ./cmd/server
# aluno: http://<IP>:8080/sala/<slug>/entrar
```

Ao testar com `curl` no Windows (Schannel), use `--ssl-no-revoke --cacert tls-dev/mlab-ca.crt`. O Schannel exige
consulta de revogação, que a CA local não oferece; Chrome e Edge não exigem isso para CAs instaladas localmente.

## Variáveis do backend

| Variável | Padrão | Uso |
|---|---|---|
| `MLAB_TLS` | — | `1` liga o HTTPS (o app MLab HTTPS já passa) |
| `WEB_TLS_PORT` | `8443` | porta HTTPS |
| `MLAB_TLS_DIR` | `tls` | pasta da CA, relativa ao diretório de trabalho (o `userData` do app) |

Contrato completo: `spec-kit/specs/011-https-lan/contracts/tls.md`.
