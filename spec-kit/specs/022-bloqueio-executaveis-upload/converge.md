# Converge: Bloqueio de Executáveis no Upload e Headers de Download

Feature: `022-bloqueio-executaveis-upload`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `cb42d70` (T2201), `7caf605` (T2202), `a68a6c8` (T2203)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2201 a C-2207), `plan.md`, `tasks.md` (T2201 a T2205)
- contrato: `003-classroom-interaction/contracts/files.md`
- código:
  - `apps/backend/internal/room/filetypes.go`, `files.go`;
  - `apps/desktop/src/renderer/services/files.ts`, `hooks/useRoomFileUploads.ts`
- suítes:
  - `go vet ./internal/room/` e `go test ./...` em `apps/backend`;
  - gofmt dos quatro arquivos Go alterados;
  - `npx vitest run` em `apps/desktop`;
  - `npm run lint` na raiz.
- verificação manual (T2204): backend local compilado da branch (`PORT=18099`), upload com `curl` e com `fetch` do
  Node (nome em UTF-8, como o Electron envia).

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2201 | `TestIsBlockedExtension` (26 extensões, maiúsculas, ponto e espaço finais, extensão dupla); `TestFiles_BlockedTypesRejectedWith415`. Manual: `setup.exe` e `rodar.bat` → 415 com a mensagem de C-2204 |
| RF-2202 | `TestHasExecutableSignature` (PE, ELF, quatro Mach-O; PDF, PNG, ZIP, texto, vazio aceitos); casos `notas.pdf` com `MZ`, `programa` com ELF e `app.zip` com Mach-O no teste de 415. Manual: `.exe` renomeado para `notas.pdf` → 415 |
| RF-2203 | teste de 415: arquivo recusado fora da listagem e sem `file-shared`; log do backend manual sem registro dos três recusados |
| RF-2204 | `TestServerContentType`; `TestFiles_AllowedTypesAcceptedWithServerContentType` com `Content-Type` falso (`text/html`) do cliente. Manual: `aula.py` → `application/octet-stream`, PDF → `application/pdf`, também na listagem |
| RF-2205 | `TestContentDisposition`; `TestFiles_DownloadHeadersDefinedByServer`. Manual (`revisão-ação.pdf`): `content-disposition: attachment; filename="revis_o-a__o.pdf"; filename*=UTF-8''revis%C3%A3o-a%C3%A7%C3%A3o.pdf`, `nosniff`, `content-security-policy: sandbox`, `cache-control: no-store` |
| RF-2206 | `isBlockedFileName` em `files.test.ts`; `useRoomFileUploads.test.ts` ("recusa executável e instalador sem requisição e segue a fila"); `RoomFileDrop.test.tsx` |
| RF-2207 | `files.test.ts` (415 propagado); `useRoomFileUploads.test.ts` e `RoomFileDrop.test.tsx` (mensagem no item) |
| RNF-2201 | regra aplicada em `uploadFile` antes de guardar; o desktop só antecipa a mensagem |
| RNF-2202 | `RoomFile`, eventos WebSocket e web inalterados; `apps/web/src` não usa `content_type` |
| RNF-2203 | nenhuma dependência nova (só stdlib Go) |
| RNF-2204 | `hasExecutableSignature` compara prefixos de até 4 bytes |
| RN-2201 | mesma lista e mensagem em `filetypes.go` e `files.ts`, com testes dos dois lados e comentário cruzado |
| RN-2202 | código-fonte aceito nos testes Go e do desktop; manual `aula.py` → 201 |

Totais:

- Backend: `go test ./...` verde em todos os pacotes.
- Desktop: 25 arquivos e 280 testes verdes.
- `npm run lint` na raiz: 5 de 5.

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| US-2202 | Smoke do aluno num navegador real (desktop e celular): baixar `revisão-ação.pdf` e conferir o nome salvo | Os headers foram conferidos na resposta HTTP (seção 1). O nome no disco depende do navegador, que segue o `filename*` (RFC 6266); fica com o responsável antes do merge. |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| Nome com UTF-8 inválido vira U+FFFD no `filename*` | `encodeRFC5987` | proteção do header; o `filename` ASCII já cobria o caso. O `curl` do Windows envia o nome na página de código local, e isso já gravava o nome assim antes desta feature |

## 5. Testes faltantes

- Nenhum automatizado. O download real em navegador fica no smoke da seção 2.

## 6. Novas tasks necessárias

- Nenhuma na 022.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

- Relacionada, sem mudança aqui: #47 (aviso de download inseguro por HTTP), que é problema de transporte.
- Os avisos do analisador do editor em arquivos fora do escopo (`resolveBaseURL` sem uso em `handler.go`, checagem
  redundante de `nil` em `mdns.go` e `nil` como `Context` em `room_security_test.go`) não mudam comportamento e não
  foram tratados como desvio.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.13.0 (ou 1.14.0 se o PR da 021 entrar antes) | Regra nova compatível num endpoint existente: o 415 é um código de erro novo no contrato, e enviar executáveis nunca foi requisito (US-16 da 003). Decisão do responsável (C-2207). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — executáveis e instaladores recusados com 415 (extensão e assinatura), código-fonte aceito,
  `Content-Type` e headers de download definidos pelo servidor, e pré-validação no desktop. Só falta o smoke do
  aluno num navegador real (seção 2).
