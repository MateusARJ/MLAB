# Política de segurança

## Versões suportadas

Só a release mais recente publicada em [Releases](https://github.com/MateusARJ/MLAB/releases) recebe correções de
segurança. Versões anteriores não são corrigidas: atualize para a última.

## Como reportar uma vulnerabilidade

**Não abra issue pública** para vulnerabilidades.

Use o reporte privado do GitHub: na aba **Security** do repositório, clique em **Report a vulnerability**. O reporte
fica visível só para o mantenedor até a correção ser publicada.

Inclua, se possível:

- versão do MLab e sistema operacional (professor e aluno);
- componente afetado (app desktop, web do aluno ou backend);
- passos para reproduzir e o impacto esperado;
- prova de conceito, logs ou capturas.

## O que esperar

- Confirmação de recebimento em até 7 dias.
- Avaliação e, se confirmada, correção numa release PATCH (`docs/versionamento.md`), com crédito a quem reportou,
  se desejar.

## Escopo

O MLab foi feito para operar em rede local (ADR 0005). Interessam principalmente: autorização no backend (chave de
host, JWT, tokens de sala), sinalização WebSocket, acesso indevido à transmissão ou ao chat e o envio de arquivos.
Problemas que exigem acesso prévio à máquina do professor estão fora do escopo.
