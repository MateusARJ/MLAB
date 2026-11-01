# Constituição do Projeto — ScreenShare Classroom

## Princípio I — Especificação antes da implementação

Nenhum código novo é permitido antes de uma especificação funcional aprovada.

**Gate:** `spec.md` deve existir e não conter requisito crítico indefinido.

## Princípio II — Segurança e autorização no servidor

Permissões são propriedades do servidor, não da interface. Professor, aluno e operações administrativas possuem capacidades explícitas.

**Gate:** toda operação protegida deve ter regra de autorização especificada e coberta por teste.

## Princípio III — SFU para escala de sala

O cenário-alvo é um professor publicando uma única upstream e múltiplos alunos recebendo a mídia via SFU. Mesh P2P não é arquitetura aceita para 30+ alunos.

**Gate:** qualquer desvio exige ADR aprovada e análise de impacto.

## Princípio IV — Baixa latência com medição

Qualidade de vídeo, FPS, bitrate, RTT, packet loss e tempo de entrada devem ser medidos antes de serem declarados como atendidos.

**Gate:** nenhuma tarefa de performance pode ser marcada como concluída sem evidência de medição.

## Princípio V — Contratos explícitos

HTTP, WebSocket, sinalização WebRTC, tokens e eventos entre módulos são contratos. Mudança de contrato exige atualização explícita do contrato e dos consumidores.

**Gate:** contrato inexistente = implementação bloqueada.

## Princípio VI — Escopo controlado

Toda feature possui Scope Lock e toda tarefa possui paths permitidos e proibidos.

**Gate:** tarefa sem paths = inválida.

## Princípio VII — Complexidade justificada

Use KISS, YAGNI, DRY, SOLID e baixo acoplamento. Nenhum padrão ou abstração entra por estética.

**Gate:** abstrações sem consumidor real devem ser removidas.

## Princípio VIII — Convergência contínua

Após implementação, o código deve ser comparado contra spec, plan e tasks. Divergência não pode ficar implícita.

**Gate:** `converge` deve registrar qualquer gap restante.
