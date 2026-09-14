# Data Model: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: READY

## Entidades

### Professor (credenciais de acesso ao app desktop)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | UUID | sim | único, gerado pelo servidor |
| email | string | sim | único; usado como login |
| password_hash | string | sim | nunca exposto ao cliente |
| created_at | timestamp | sim | gerado pelo servidor |

### Room

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | UUID | sim | único |
| slug | string | sim | identificador amigável no link único |
| status | enum | sim | waiting / publishing / closed |
| owner_id | UUID | sim | FK → Professor; somente ele pode publicar |
| max_participants | int | sim | padrão 50; configurável |
| created_at | timestamp | sim | gerado pelo servidor |
| closed_at | timestamp | não | preenchido ao encerrar |

### Participant

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | UUID | sim | único |
| room_id | UUID | sim | FK → Room; sala existente |
| role | enum | sim | professor / aluno |
| name | string | sim | Nome Completo informado pelo aluno (ou nome do professor) |
| student_id | string | não | Matrícula; obrigatório quando role = aluno |
| joined_at | timestamp | sim | gerado pelo servidor |
| left_at | timestamp | não | preenchido na saída |

### ChatMessage

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | UUID | sim | único |
| room_id | UUID | sim | FK → Room |
| participant_id | UUID | sim | FK → Participant |
| content | string | sim | texto da mensagem; não vazio; limite de caracteres a definir no plan |
| sent_at | timestamp | sim | gerado pelo servidor; nunca pelo cliente |

### Session (qualidade de sessão WebRTC)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | UUID | sim | único |
| participant_id | UUID | sim | FK → Participant |
| transport_state | string | sim | connecting / connected / disconnected / failed |
| bitrate_kbps | int | não | última medição de bitrate |
| fps | int | não | última medição de FPS |
| rtt_ms | int | não | último RTT medido |
| packet_loss_pct | float | não | último packet loss medido |
| first_frame_at | timestamp | não | tempo até primeiro frame (latência de entrada) |
| updated_at | timestamp | sim | gerado pelo servidor a cada atualização de métrica |

## Observações

- `student_id` é um campo de texto livre nesta versão; sem validação contra banco da instituição.
- `ChatMessage` é persistida no PostgreSQL para exibir histórico ao aluno que entra durante a aula.
- Métricas de `Session` podem ser armazenadas em memória e opcionalmente em banco para análise posterior.
- Campos de matrícula e nome são validados como não-vazios no servidor; a UI impede campos em branco, mas o servidor nunca confia apenas na validação do cliente.
