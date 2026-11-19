<p align="center">
  <img src="https://github.com/MateusARJ/MLAB/raw/main/MLAB-logo.png" alt="MLab" width="200" />
</p>

<h1 align="center">MLab HTTPS 2.2.1</h1>

<p align="center">
  A edição do MLab que entrega a aula e os arquivos por HTTPS na rede local, sem o aviso de
  "Download inseguro bloqueado" no Chrome e no Edge.
</p>

Esta versão traz para a edição **MLab HTTPS** tudo o que o MLab recebeu até a **2.2.1**: a nova interface 2.0, o app
estável no Linux, a tela cheia sem bordas para os alunos e as demais correções. O HTTPS na rede local continua igual:
o mesmo link de sempre, um certificado instalado uma vez por aparelho e downloads sem aviso.

## Destaques

- **Tudo do MLab 2.2.1.** A edição acompanha a versão principal. As novidades estão nas notas da
  [2.1.5](https://github.com/MateusARJ/MLAB/releases/tag/v2.1.5) e da
  [2.2.1](https://github.com/MateusARJ/MLAB/releases/tag/v2.2.1).
- **Cartão "HTTPS na rede local" no novo painel do professor.** Na tela de preparar a aula, o cartão fica na coluna da
  direita, abaixo de **Como os alunos entram**, com a **impressão digital** da CA e o botão
  **Exportar certificado (para a TI do laboratório)**.
- **Downloads sem aviso.** Os alunos abrem o link `http://` de sempre. Se o aparelho já confia no certificado do MLab,
  a página vai sozinha para `https://…:8443`, e a aula e os arquivos funcionam sem bloqueio.
- **Certificado só para a rede local.** O app cria a própria autoridade certificadora (CA) na primeira abertura. A
  chave nunca sai do computador do professor, e a CA só emite certificados para `.local`, `localhost` e IPs de rede
  local: ela não vale para nenhum site da internet.

## Downloads

Os instaladores do MLab HTTPS são gerados a partir da branch
[`edicao/https-lan`](https://github.com/MateusARJ/MLAB/tree/edicao/https-lan):

| Sistema | Arquivo |
| --- | --- |
| Windows 10/11 | `MLab HTTPS-Setup-2.2.1.exe` |
| Linux | `MLab HTTPS-Linux-2.2.1.AppImage` ou `.deb` |

O MLab HTTPS se instala **ao lado** do MLab normal, mas os dois **não podem ficar abertos ao mesmo tempo**, porque
usam as mesmas portas. Os alunos não instalam o app: só instalam o certificado, uma vez por aparelho.

> **Atualizando uma versão anterior do MLab HTTPS?** Reinstalar o app gera uma **CA nova**, porque o desinstalador
> apaga os dados do app. Os alunos precisam remover o certificado antigo ("MLab CA local") e instalar o novo; no
> laboratório, a TI exporta e distribui o novo `mlab-ca.crt`. Confira a impressão digital nova no cartão
> **HTTPS na rede local**.

## Primeira aula com o MLab HTTPS

1. **Professor:** abra o app e crie a aula. Mostre aos alunos a impressão digital do cartão **HTTPS na rede local**.
2. **Firewall do Windows:** na primeira execução, libere o `mlab-backend.exe` para **redes privadas** (a 8443 é
   liberada junto com a 8080).
3. **Alunos:** abram o link da sala. Na página **Conexão segura do MLab**, confiram a impressão digital, baixem o
   certificado, sigam o passo a passo do sistema e toquem em **Continuar com HTTPS**. Reserve uns 2 minutos.
4. **Laboratório inteiro:** use **Exportar certificado** e instale o `mlab-ca.crt` em todos os PCs de uma vez, por
   GPO ou com `certutil -addstore -f Root mlab-ca.crt`.

O passo a passo por sistema (Windows, Android, iPhone/iPad, macOS, Linux/ChromeOS e Firefox) está no
[guia da edição](https://github.com/MateusARJ/MLAB/blob/edicao/https-lan/docs/https-lan.md).

## Limitações conhecidas

- Cada aparelho de aluno instala o certificado uma vez. No Android, a instalação exige bloqueio de tela.
- O download do próprio certificado é feito por HTTP. Se o navegador avisar, escolha **Manter**.
- Reinstalar o app troca a CA, e os aparelhos precisam do novo certificado.
- No Linux com XWayland, a presença do cursor na transmissão pode congelar quando o ponteiro está fora de janelas X11
  ([#140](https://github.com/MateusARJ/MLAB/issues/140)).
