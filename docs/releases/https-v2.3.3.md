<p align="center">
  <img src="https://github.com/MateusARJ/MLAB/raw/main/MLAB-logo.png" alt="MLab" width="200" />
</p>

<h1 align="center">MLab HTTPS 2.3.3</h1>

<p align="center">
  A edição do MLab que entrega a aula e os arquivos por HTTPS na rede local, sem o aviso de
  "Download inseguro bloqueado" no Chrome e no Edge.
</p>

> **Edição paralela.** Esta não é a versão principal do MLab. Se os alunos não baixam arquivos na aula, use o
> [MLab 2.3.3](https://github.com/MateusARJ/MLAB/releases/tag/v2.3.3). O MLab HTTPS 2.3.3 tem as mesmas correções de
> segurança da 2.3.3 e é a primeira versão da edição publicada com instaladores.

## O que é o MLab HTTPS

O **MLab HTTPS** é uma edição do MLab para escolas onde os alunos baixam arquivos da aula. No MLab normal, a página
dos alunos e os arquivos chegam por `http://`, e o Chrome e o Edge bloqueiam ou alertam esses downloads
("Download inseguro bloqueado"), seja qual for o tipo do arquivo. Nenhuma autoridade pública emite certificado para
o IP de um computador da rede local, por isso o MLab HTTPS cria a **própria autoridade certificadora (CA)**:

- a CA é criada na primeira vez que o app abre, e a chave dela **nunca sai do computador do professor**;
- ela só emite certificados para `.local`, `localhost` e IPs de rede local, e **não vale para nenhum site da
  internet**;
- o servidor continua atendendo na porta **8080** (HTTP) e passa a atender também na **8443** (HTTPS);
- cada aparelho de aluno instala o certificado do MLab **uma única vez**. Depois disso, a aula e os downloads
  funcionam por HTTPS, sem aviso.

Fora isso, é o mesmo MLab: o professor transmite a tela pelo app, e os alunos assistem no navegador, com chat,
arquivos e mão levantada. Use o **MLab** normal se os alunos não precisam baixar arquivos, e o **MLab HTTPS** se o
aviso de download inseguro atrapalha a aula.

## Instalação

### Professor

| Sistema | Arquivo |
| --- | --- |
| Windows 10/11 | `MLab.HTTPS-Setup-2.3.3.exe` |
| macOS | `MLab.HTTPS-Mac-2.3.3.dmg` (ou `.zip`) — ainda não testado na edição |
| Linux | `MLab.HTTPS-Linux-2.3.3.AppImage` (qualquer distribuição) ou `.deb` (Debian/Ubuntu) |

1. Instale o MLab HTTPS como o MLab normal. As instruções de cada sistema estão no
   [README](https://github.com/MateusARJ/MLAB#instala%C3%A7%C3%A3o-para-uso-professor).
2. Na primeira execução no Windows, libere o `mlab-backend.exe` no firewall para **redes privadas**. A porta 8443 é
   liberada junto com a 8080.

O MLab HTTPS se instala **ao lado** do MLab normal, com nome e atalho próprios, mas os dois **não podem ficar abertos
ao mesmo tempo**, porque usam as mesmas portas.

> **Atualizando uma versão anterior do MLab HTTPS?** Reinstalar o app gera uma **CA nova**, porque o desinstalador
> apaga os dados do app. Os alunos precisam remover o certificado antigo ("MLab CA local") e instalar o novo; no
> laboratório, a TI exporta e distribui o novo `mlab-ca.crt`. Confira a impressão digital nova no cartão
> **HTTPS na rede local**.

### Alunos

Os alunos não instalam o app, só o certificado, uma vez por aparelho. A própria página do MLab mostra o passo a passo
do sistema do aluno:

| Sistema | Onde instalar |
| --- | --- |
| Windows (Chrome/Edge) | abrir `mlab-ca.crt` > Instalar Certificado > Usuário Atual > "Autoridades de Certificação Raiz Confiáveis" |
| Android | Configurações > Segurança > Criptografia e credenciais > Instalar certificado > Certificado CA (exige bloqueio de tela) |
| iPhone/iPad | baixar no Safari > Ajustes > Geral > VPN e Gerenciamento de Dispositivo > Instalar; depois Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados > ativar |
| macOS | abrir o certificado > Acesso às Chaves > "MLab CA local" > Confiar > Sempre Confiar |
| Linux/ChromeOS (Chrome) | Configurações > Segurança > Gerenciar certificados > Autoridades > Importar |
| Firefox (qualquer sistema) | Configurações > Privacidade e Segurança > Certificados > Ver certificados > Autoridades > Importar |

Para remover, basta apagar "MLab CA local" da lista de certificados do aparelho ou do navegador.

### Laboratório inteiro

No cartão **HTTPS na rede local** do app, use **Exportar certificado (para a TI do laboratório)**. A TI instala o
`mlab-ca.crt` em todos os PCs de uma vez, por GPO ou com `certutil -addstore -f Root mlab-ca.crt`, e os alunos não
precisam instalar nada.

## Como usar numa aula

1. **Professor:** abra o MLab HTTPS e crie a aula. Na tela de preparar a aula, o cartão **HTTPS na rede local** mostra
   a **impressão digital** da CA (ex.: `8255 16AE 2F69 214F`). Mostre esse código aos alunos.
2. **Compartilhe o link de sempre**, `http://<IP>:8080/...` ou `http://mlab.local:8080/...`. Não é preciso montar um
   link com `https`.
3. **Aluno que já tem o certificado:** a página vai sozinha para `https://…:8443`, e a aula e os downloads funcionam
   sem aviso.
4. **Aluno sem o certificado:** a página mostra **Conexão segura do MLab**. O aluno confere se a impressão digital é a
   mesma do professor, baixa o certificado, segue o passo a passo e toca em **Continuar com HTTPS**.
5. Na primeira aula, reserve uns **2 minutos** para os alunos instalarem o certificado. Nas próximas, eles entram
   direto.

O guia completo está em
[`docs/https-lan.md`](https://github.com/MateusARJ/MLAB/blob/edicao/https-lan/docs/https-lan.md).

## O que traz do MLab normal

A edição acompanha a versão principal e traz **tudo o que o MLab tem até a 2.3.3**:

- **Correções de segurança da 2.3.3** ([#176](https://github.com/MateusARJ/MLAB/pull/176)), sem mudança no uso:
  - o botão **Baixar** dos arquivos da aula usa um link montado pela própria página do aluno a partir da sala e do
    arquivo, e não o endereço enviado pelo servidor;
  - o servidor só entrega arquivos de dentro da pasta da página do aluno, inclusive na porta 8443;
  - o app do professor trata os dados da negociação de vídeo sem interpretá-los como expressões.
- **Pacotes Linux da 2.3.2:** o `.tar.gz`, anunciado mas nunca gerado, sai da lista; em qualquer distribuição, use o
  AppImage ([#174](https://github.com/MateusARJ/MLAB/pull/174)).

- **Transmissão para a turma inteira:** o professor transmite a tela inteira ou janelas escolhidas para 40 ou mais
  alunos na rede local, sem internet, e pode fixar uma janela enquanto usa outra.
- **Aula que não cai:** a correção da queda do servidor no meio da aula no Windows (Go 1.26.11) e a retomada
  automática: se o servidor cair ou travar, o app do professor o reinicia e recria a sala com o mesmo link.
- **Entrada simples:** o professor entra só com o nome, e o aluno com nome e matrícula, numa única sessão por
  matrícula. O link `mlab.local` funciona no celular, com um nome por professor na mesma rede.
- **Interação:** chat com mensagens fixadas e privadas, mão levantada, arquivos da aula arrastados para a sala e barra
  de marcação com caneta e lupa, também fora do MLab e no Linux.
- **Interface 2.0:** tema claro e escuro, fonte de alta legibilidade e, para o aluno, tela cheia sem bordas e
  controles acessíveis.
- **Licença Apache 2.0:** o MLab HTTPS passa a ser distribuído sob a Apache 2.0, com `LICENSE` e `NOTICE` no app
  instalado ([ADR 0012](https://github.com/MateusARJ/MLAB/blob/main/spec-kit/docs/adrs/0012-licenca-apache-2-0.md)).

O que mudou em cada versão está nas notas do [MLab 2.3.3](https://github.com/MateusARJ/MLAB/releases/tag/v2.3.3),
e o histórico completo, nas do [MLab 2.3.1](https://github.com/MateusARJ/MLAB/releases/tag/v2.3.1).

## Limitações conhecidas

- Cada aparelho de aluno instala o certificado uma vez. No Android, a instalação exige bloqueio de tela.
- O download do próprio certificado é feito por HTTP. Se o navegador avisar, escolha **Manter**.
- Reinstalar o app troca a CA, e os aparelhos precisam do novo certificado.
- O instalador do MLab HTTPS para macOS sai pela primeira vez nesta versão e **ainda não foi testado num Mac real**
  com a edição. Ele não é assinado nem notarizado: na primeira abertura, use **botão direito → Abrir**.
- Depois de uma retomada do servidor, o aluno precisa abrir o link de novo e informar nome e matrícula.
- No Linux com XWayland, a presença do cursor na transmissão pode congelar quando o ponteiro está fora de janelas X11
  ([#140](https://github.com/MateusARJ/MLAB/issues/140)).
