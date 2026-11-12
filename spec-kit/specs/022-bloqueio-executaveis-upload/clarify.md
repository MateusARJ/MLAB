# Clarify: Bloqueio de Executáveis no Upload e Headers de Download

Feature: `022-bloqueio-executaveis-upload`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-12, com o plano de implementação das issues #52 e #64.

## C-2201 — Regra de bloqueio

- **Contexto:** a issue #64 deixa a regra em aberto: lista de bloqueio ou lista de tipos permitidos, e só a extensão
  ou também o conteúdo.
- **Opções:**
  - (A) lista de bloqueio por extensão + assinatura binária;
  - (B) só a lista de bloqueio por extensão;
  - (C) lista de tipos permitidos.
- **Resposta aprovada:** **A**. A assinatura pega o executável renomeado. A lista de permitidos recusaria formatos
  legítimos que hoje passam.
- **Impacto em spec:** RF-2201, RF-2202.

## C-2202 — Lista de extensões bloqueadas e código-fonte

- **Contexto:** o responsável perguntou se o bloqueio cobriria arquivos de linguagens de programação.
- **Resposta aprovada:** código-fonte é **liberado**, porque é material de aula de programação. A lista cobre só
  binários e o que o sistema executa com um duplo clique, sem compilador ou interpretador instalado pelo usuário:
  `.exe .msi .msp .bat .cmd .com .scr .pif .cpl .ps1 .psm1 .vbs .vbe .jse .wsf .wsh .hta .lnk .reg .dll .appimage .deb .rpm .apk .dmg .pkg`.
  - Ficam liberados: `.js`, `.ts`, `.py`, `.sh`, `.jar`, `.java`, `.c` e afins. No Windows, o `.js` aberto com duplo
    clique roda no Windows Script Host. O risco foi aceito pelo responsável, e o download nunca o executa no
    navegador (RF-2205).
  - `.jse` (script codificado do Windows Script Host) é bloqueado: não é código de aula.
- **Impacto em spec:** RF-2201, RN-2202.

## C-2203 — Mapa de `Content-Type` do servidor

- **Resposta aprovada:**

  | Extensões | `Content-Type` |
  |---|---|
  | `.pdf` | `application/pdf` |
  | `.png` | `image/png` |
  | `.jpg`, `.jpeg` | `image/jpeg` |
  | `.gif` | `image/gif` |
  | `.webp` | `image/webp` |
  | `.txt` | `text/plain; charset=utf-8` |
  | `.csv` | `text/csv; charset=utf-8` |
  | `.md` | `text/markdown; charset=utf-8` |
  | `.zip` | `application/zip` |
  | `.mp4` | `video/mp4` |
  | `.mp3` | `audio/mpeg` |
  | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
  | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
  | `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
  | `.odt` | `application/vnd.oasis.opendocument.text` |
  | `.ods` | `application/vnd.oasis.opendocument.spreadsheet` |
  | `.odp` | `application/vnd.oasis.opendocument.presentation` |
  | qualquer outra (inclusive `.html`, `.svg` e código-fonte) | `application/octet-stream` |

- Os tipos que um navegador renderiza com script (`.html`, `.svg`) ficam em `application/octet-stream` de propósito.
- **Impacto em spec:** RF-2204.

## C-2204 — Mensagem e código

- **Resposta aprovada:** 415 com
  `tipo de arquivo bloqueado: executáveis e instaladores não podem ser compartilhados`, igual no backend e no desktop.
  O texto não fala em "scripts", porque código-fonte é permitido (C-2202).
- **Impacto em spec:** RF-2201, RF-2206, RN-2201.

## C-2205 — Headers do download

- **Resposta aprovada:**
  - `Content-Disposition` com `filename` ASCII e `filename*` UTF-8 (RFC 6266/5987);
  - mantém o `nosniff`;
  - adiciona `Content-Security-Policy: sandbox`, que impede script mesmo que um navegador abra o arquivo inline;
  - adiciona `Cache-Control: no-store`, porque o arquivo vive só em memória e some quando a sala fecha (ADR 0005).
- **Impacto em spec:** RF-2205.

## C-2206 — Pré-validação no desktop

- **Resposta aprovada:** sim, no `enqueue` da fila da 018, ao lado das checagens de pasta e de 50 MB. Só a extensão:
  a assinatura fica no servidor, que é a autoridade (RNF-2201).
- **Impacto em spec:** RF-2206.

## C-2207 — Faixa de IDs, ADR e impacto de versão

- **Faixa de IDs:** `US-220x`, `RF-220x`, `RNF-220x`, `RN-220x`, `C-220x` e `T220x`, na faixa de 4 dígitos
  (precedente da 020).
- **ADR:** não é necessária. A feature não muda autenticação nem autorização, não troca stack e não muda o contrato
  global; é uma regra nova num endpoint existente.
- **Impacto de versão:** **MINOR**, decidido pelo responsável. O 415 é um código de erro novo e compatível, e a US-16
  da 003 nunca especificou tipos de arquivo; enviar executáveis não era uma funcionalidade prometida
  (`docs/versionamento.md` §2, AGENTS §13).

## Resultado

CLOSED — C-2201 a C-2207 respondidas; nenhuma ambiguidade em aberto.
