# Clarify: HTTPS na LAN com CA local

Feature: `011-https-lan`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-06.

## C-1101 — Causa do "Download inseguro bloqueado"
- **Contexto:** os alunos baixam PDF, Office, código e zip, e o navegador bloqueia. A página e os arquivos vêm por
  `http://` (`apps/backend/cmd/server/main.go`, `http.ListenAndServe`).
- **Resposta aprovada:** o bloqueio vem do transporte HTTP, e só HTTPS confiável resolve. CAs públicas não emitem
  certificado para IP privado nem para `.local`, então a confiança tem de vir de uma CA local instalada nos aparelhos
  (ADR 0008, opção B).

## C-1102 — Onde vive a implementação
- **Resposta aprovada:** edição isolada **MLab HTTPS** na branch `feat/https-lan`, criada a partir da ADR, **sem merge
  na `development`**. O PR #48 (ADR) foi fechado sem merge.

## C-1103 — Identidade da edição
- **Resposta aprovada:** app separado: `productName` "MLab HTTPS" e `appId` `com.mlab.classroom.https`. Pode ficar
  instalado ao lado do MLab normal, com dados e CA separados. Os dois não rodam ao mesmo tempo (mesmas portas).

## C-1104 — Aluno sem o certificado
- **Resposta aprovada:** a tela de instalação oferece o botão **"Continuar com HTTPS"**. Não há opção de seguir pelo
  HTTP nesta edição.

## C-1105 — Link compartilhado
- **Contexto:** o aluno sem a CA instalada não consegue abrir um link `https://` sem tela de erro de certificado.
- **Resposta aprovada:** o link continua HTTP (porta 8080). A página consulta `/tls/info`, testa `/tls/ok` em HTTPS e
  redireciona sozinha quando o aparelho já confia. Assim nenhuma tela de erro de certificado aparece.

## C-1106 — Modo de desenvolvimento
- **Contexto:** em `npm run dev` a 8080 redireciona as páginas para o Vite (HTTP, 5173; feature 008). Um
  redirecionamento para HTTPS entraria em laço.
- **Resposta aprovada:** em dev, `/tls/info` devolve `enabled: false` (RF-1105). O teste ponta a ponta usa o backend
  servindo o build do web (`WEB_DIR`) com `MLAB_TLS=1`, ou o app empacotado.

## Resultado

CLOSED — C-1101 a C-1106 respondidas; nenhuma ambiguidade em aberto.
