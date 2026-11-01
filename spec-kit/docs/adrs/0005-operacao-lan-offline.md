# ADR 0005 — Operação em rede local (LAN) offline como modo primário

Status: APROVADA
Data: 2026-11-01
Feature impactada: `001-screen-share-core`, `003-classroom-interaction`
Supersede parcialmente: clarify C-01 (persistência em PostgreSQL), clarify C-04 (TURN obrigatório), RNF-10 (PostgreSQL na stack homologada)

## Contexto

O MLab é usado em salas de aula e laboratórios de informática onde a internet da instituição oscila ou cai
e o firewall bloqueia plataformas em nuvem. O produto evoluiu para operar 100% na rede local:

- o backend Go é embarcado e iniciado pelo próprio app desktop do professor (`apps/desktop/src/main/main.ts`);
- os alunos acessam pelo IP físico da máquina do professor ou pelo nome `mlab.local` (mDNS);
- o backend descarta adaptadores de rede virtuais para anunciar o IP correto (`internal/room/network.go`);
- túneis (ngrok) e NAT 1-to-1 são suportados de forma opcional (T033).

As decisões C-01 (credenciais de professor em PostgreSQL) e C-04 (TURN obrigatório desde o primeiro deploy)
foram tomadas para um cenário de servidor central acessado pela internet, que não é mais o cenário primário.

## Problema

A spec, o clarify e a stack homologada exigem TURN e PostgreSQL, mas o produto real não usa nenhum dos dois.
Pelo AGENTS.md (§9), mudança de infraestrutura relevante exige ADR.

## Opções consideradas

### Opção A — Manter servidor central com TURN obrigatório e PostgreSQL
- Exige internet estável e liberação de portas no firewall institucional, exatamente o que o produto quer evitar.
- Exige instalação e operação de banco e coturn por escola.

### Opção B — LAN offline como modo primário, TURN opcional, estado em memória (escolhida)
- Funciona sem internet e sem infraestrutura extra.
- O ciclo de vida de uma aula coincide com o ciclo de vida do processo do backend.

## Decisão

1. O modo primário de operação é **rede local offline**: backend embarcado no app do professor, alunos na mesma LAN.
2. **TURN é opcional**: habilitado por variável de ambiente para cenários fora da LAN (ngrok, rede externa). Quando habilitado,
   continua valendo RF-23/RN-11 (credenciais efêmeras HMAC-SHA1, validade máxima de 24h).
3. **Todo o estado é em memória e efêmero por execução do backend** (salas, participantes, chat, arquivos compartilhados).
   Não há PostgreSQL nesta versão. Persistência só entra com nova spec e nova ADR.
4. A arquitetura de mídia não muda: um único upstream do professor para a SFU Pion, sem P2P mesh (Princípio III).

## Consequências

### Positivas
- Aula funciona sem internet e sem o firewall institucional interferir.
- Nenhuma infraestrutura extra para a escola manter.
- RNF-16 (mídia efêmera) é reforçado: nada é persistido no servidor.

### Negativas
- Reiniciar o app do professor encerra a sala e descarta chat, arquivos e sessões.
- Uso fora da LAN depende de configuração manual (ngrok/TURN).
- Recursos do backend competem com a captura e a codificação na máquina do professor.

## Impacto em specs/contracts/tasks

- `001/clarify.md`: notas de supersessão em C-01 (parte de persistência) e C-04.
- `001/spec.md`: RNF-10 reescrito (sem PostgreSQL); US-08/RF-23 com TURN opcional.
- `001/plan.md`: Technical Context (TURN, persistência).
- `.specify/memory/project-context.md` e `AGENTS.md` §2: modo LAN offline.
- Nenhuma mudança de código.

## Aprovação humana

- Responsável: MateusARJ (aprovação do plano de remediação, decisão D3)
- Data: 2026-11-01
