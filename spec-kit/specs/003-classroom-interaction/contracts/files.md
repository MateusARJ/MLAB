# Contract: Arquivos da Sala

Status: READY
Feature: `003-classroom-interaction`

## Producer / Consumer

- Producer: `apps/backend/internal/room/files.go`, `handler.go`.
- Consumers: `apps/desktop` (upload e listagem), `apps/web` (listagem e download).

## Armazenamento

Somente em memória, por sala (ADR 0005). Nada é gravado em disco pelo servidor.

---

## POST /rooms/{roomId}/files

Envia um arquivo para a turma.

- **Authorization:** Bearer JWT `role: professor`, dono da sala (`sub == owner_id`).
- **Body:** `multipart/form-data`, campo `file`.
- **Limite por arquivo:** 50 MB.

**Response 201:**
```json
{
  "id": "uuid",
  "room_id": "uuid",
  "name": "string",
  "size": 12345,
  "content_type": "string (definido pelo servidor; ver Tipos de arquivo)",
  "url": "/rooms/{roomId}/files/{fileId}/download",
  "uploaded_at": "ISO8601"
}
```

Efeito colateral: broadcast `file-shared` na sala (ver `signaling-classroom.md`).

**Errors:** `401`, `403` (não é professor ou não é dono), `404` (sala), `400` (campo `file` ausente ou corpo inválido),
`413` (arquivo acima do limite ou sala acima do teto), `415` (tipo bloqueado; ver Tipos de arquivo), `500`.

---

## GET /rooms/{roomId}/files

Lista os arquivos da sala (mesmo formato do item acima, em array; sala sem arquivos → `[]`).

## GET /rooms/{roomId}/files/{fileId}/download

Baixa o arquivo.

- Headers de resposta (desde 022, T2202):
  - `Content-Type`: o `content_type` definido pelo servidor (ver Tipos de arquivo);
  - `Content-Disposition: attachment; filename="<nome ASCII>"; filename*=UTF-8''<nome codificado>` (RFC 6266/5987).
    No `filename`, cada caractere fora de ASCII imprimível, `"` e `\` vira `_`;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Security-Policy: sandbox`;
  - `Cache-Control: no-store`.
- **Errors:** `404` (arquivo inexistente).

---

## Autorização da listagem e do download — em vigor desde `002-security-hardening`/S4 (T204)

- Token aceito em `Authorization: Bearer <jwt>` **ou** no parâmetro `?token=<jwt>` (mesmo padrão do WebSocket), para
  permitir links de download no navegador.
- Aluno: `room_id` do token igual à sala (UUID canônico; slug é resolvido para o UUID).
- Professor: dono da sala.
- Sem token ou token inválido → `401`; token de outra sala → `403`.
- Resposta de download inclui `X-Content-Type-Options: nosniff`.

## Limites por sala — em vigor desde `002-security-hardening`/S4 (T204)

- Teto de memória por sala: 300 MB (`MLAB_ROOM_FILES_MAX_MB`).
- Máximo de arquivos por sala: 50 (`MLAB_ROOM_FILES_MAX_COUNT`).
- Acima de qualquer limite → `413`.
- Os arquivos da sala são liberados da memória quando a sala é encerrada (REST `close`, substituição da sala pelo professor ou encerramento pelo WebSocket).

## Tipos de arquivo — em vigor desde `022-bloqueio-executaveis-upload` (T2202)

- **Bloqueio (415):** o upload responde `415` com
  `{"error": "tipo de arquivo bloqueado: executáveis e instaladores não podem ser compartilhados"}` quando:
  - a extensão (sem diferenciar maiúsculas, ignorando pontos e espaços finais) é uma de
    `.exe .msi .msp .bat .cmd .com .scr .pif .cpl .ps1 .psm1 .vbs .vbe .jse .wsf .wsh .hta .lnk .reg .dll .appimage .deb .rpm .apk .dmg .pkg`;
  - ou o conteúdo começa com uma assinatura de executável nativo: `MZ`, `\x7fELF`, `FE ED FA CE`, `FE ED FA CF`,
    `CE FA ED FE` ou `CF FA ED FE`.
- O arquivo recusado não é guardado, não aparece na listagem e não gera `file-shared`.
- Código-fonte (`.js`, `.ts`, `.py`, `.sh`, `.jar`, `.java`, `.c` e afins) e compactados são aceitos.
- **`content_type`:** definido pelo servidor pela extensão. O `Content-Type` da parte multipart é ignorado.

  | Extensões | `content_type` |
  |---|---|
  | `.pdf` | `application/pdf` |
  | `.png` / `.jpg`, `.jpeg` / `.gif` / `.webp` | `image/png` / `image/jpeg` / `image/gif` / `image/webp` |
  | `.txt` / `.csv` / `.md` | `text/plain; charset=utf-8` / `text/csv; charset=utf-8` / `text/markdown; charset=utf-8` |
  | `.zip` / `.mp4` / `.mp3` | `application/zip` / `video/mp4` / `audio/mpeg` |
  | `.docx` / `.xlsx` / `.pptx` | tipos `application/vnd.openxmlformats-officedocument.*` correspondentes |
  | `.odt` / `.ods` / `.odp` | tipos `application/vnd.oasis.opendocument.*` correspondentes |
  | qualquer outra | `application/octet-stream` |

## Compatibility

Mudança de payload exige atualização deste contrato, de `packages/types` e dos consumidores.
