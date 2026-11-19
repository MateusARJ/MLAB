# Checklist de Requisitos: Crash do Runtime Go na Leitura UDP do Windows

Feature: `052-crash-runtime-go-udp-windows`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-5201 a RF-5203, RNF-5201 a RNF-5203) tem task.
- [x] Ambiguidades fechadas (C-5201 a C-5203): versão do Go, escopo e entrega.
- [x] Evidência registrada: exceção `0xc0000005` com PC `0x101470e5e0` nas duas sessões, saída com código 2, processo
  travado e ausência do crash no `mlab-backend.log`.
- [x] Edge cases cobertos: segunda falha no traceback, arquivo que não abre, sem `MLAB_LOG_FILE`, append.

## Coerência

- [x] RF-3414 (034) continua válido: o log de partida e de encerramento não muda; só ganha a saída de crash.
- [x] RNF-3402 (034): o runtime não grava o ambiente na saída de crash.
- [x] RNF010 (stack, "Go 1.22+") continua atendido pela 1.26.11.
- [x] PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `520x` não colidem.

## Viabilidade

- [x] `debug.SetCrashOutput` existe desde o Go 1.23 e aceita `*os.File`.
- [x] A 1.26.11 está publicada em `go.dev/dl` (2026-11-19) e contém a correção de golang/go#78041 (1.26.2).

## Resultado

APPROVED
