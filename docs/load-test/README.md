# Teste de carga do SFU

O teste de carga real fica em `apps/backend/internal/webrtc/loadtest_test.go` (001/T034, C-07). Ele não está
nesta pasta porque precisa importar o pacote `internal/webrtc`, que o Go só permite importar de dentro de
`apps/backend`.

> O antigo `docs/load-test/load_test.go` foi apagado em 2026-11-01. Ele comparava números fixos escritos no
> próprio arquivo com as metas, sem subir o SFU, e por isso sempre passava (ver
> `spec-kit/specs/001-screen-share-core/converge.md`).

## Como rodar

```bash
npm run test:load -w @mlab/backend
# ou, dentro de apps/backend:
go test -tags loadtest -run TestLoad_SFUFanout -v -count=1 -timeout 10m ./internal/webrtc/
```

O teste usa a build tag `loadtest` e não roda no `go test ./...` comum.

| ENV | Padrão | Uso |
|---|---|---|
| `MLAB_LOADTEST_SUBSCRIBERS` | 40 | número de assinantes |
| `MLAB_LOADTEST_SECONDS` | 20 | duração da janela de medição |
| `MLAB_LOADTEST_FPS` | 30 | quadros por segundo enviados |
| `MLAB_LOADTEST_MBPS` | 4 | bitrate do publisher |
| `MLAB_LOADTEST_OUT` | — | caminho para gravar o resultado em JSON |
| `MLAB_LOADTEST_SFU_LOGS` | — | `1` mantém os logs do SFU |

## O que é medido

O teste sobe o `SFUService` real com a configuração de produção (faixa UDP 50000–50100, IP físico detectado),
conecta um publisher Pion que envia RTP VP8 sintético e N assinantes Pion. Tudo roda no mesmo processo, mas o
tráfego passa pela pilha UDP do sistema operacional.

- FPS e bitrate recebidos por assinante;
- perda de pacotes depois das retransmissões (NACK);
- tempo de entrada: do pedido de oferta ao SFU até o primeiro pacote, com todos entrando ao mesmo tempo;
- latência de encaminhamento publisher → SFU → assinante;
- upload do publisher (uma única upstream);
- CPU e memória do processo de teste.

O teste reprova se algum assinante ficar sem mídia, se o FPS mínimo ficar abaixo de 25 ou se a perda chegar a 2%.

## O que não é medido

- RTT e latência ponta a ponta em rede real (RNF-08);
- captura, encode e decode do vídeo no app (o payload é sintético);
- CPU isolada do backend (RNF-15): o número do teste inclui o publisher e todos os assinantes, então é um limite
  superior.

Esses itens continuam como medição manual com o app e uma rede reais.

Resultados registrados: `docs/metrics/loadtest-2026-11-01.md`.
