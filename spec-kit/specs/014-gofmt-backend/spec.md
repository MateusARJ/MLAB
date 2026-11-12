# Spec: Formatação do Backend com gofmt

Status: READY
Feature ID: `014-gofmt-backend`
Origem: issue #41 (desvio registrado durante a #40): `apps/backend/internal/room/store.go` não está formatado pelo
`gofmt`.

## 1. Objetivo

Deixar todo o código Go de `apps/backend` no formato canônico do `gofmt`, sem mudar comportamento.

## 2. Contexto

A issue cita só o `store.go`, mas o critério de aceite dela é `gofmt -l` vazio no backend inteiro. Verificado em
2026-11-10 sobre os blobs da `development` @ `6795abb` (LF, sem o CRLF da cópia de trabalho com
`core.autocrlf=true`): 9 arquivos estão fora do formato.

- `internal/chat/profanity.go`
- `internal/room/files.go`, `internal/room/model.go`, `internal/room/network.go`, `internal/room/store.go`
- `internal/signaling/hub.go`, `internal/signaling/hub_test.go`, `internal/signaling/message.go`
- `internal/webrtc/room.go`

As diferenças são só de espaço em branco: alinhamento de blocos `var`/`const`, de campos de struct, de comentários
e de literais de mapa, além de linhas em branco com espaços.

## 3. Escopo

### Incluído

- aplicar o `gofmt` aos 9 arquivos acima.

### Não incluído

- qualquer mudança que não seja de formatação (nomes, comentários, lógica);
- checagem de `gofmt` no CI;
- `.gitattributes` para forçar LF nos `.go`.

## 4. Requisitos

- RF-141: `gofmt -l` sobre o conteúdo versionado (LF) de todos os `.go` de `apps/backend` não lista nenhum arquivo.
- RNF-141: a mudança é só de espaço em branco (`git diff -w` vazio); sem mudança de comportamento, de dependência ou
  de versão.

## 5. Critérios de Sucesso

- RF-141 verificado sobre os blobs do commit da feature.
- `go build ./...`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes.
- `npm run spec:check` com PASS para `014-gofmt-backend`.
