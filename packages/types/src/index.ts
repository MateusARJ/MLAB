/**
 * @mlab/types
 * DTOs, enums e eventos WebSocket compartilhados entre apps/desktop e apps/web.
 * Fonte dos contratos: spec-kit/specs/<feature>/contracts/.
 */

// ── Roles ────────────────────────────────────────────────────────────────────

export type Role = 'professor' | 'aluno';

// ── Room ─────────────────────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'publishing' | 'closed';

export interface Room {
  id: string;
  slug: string;
  title?: string;
  professorName?: string;
  roomSlug?: string;
  professorSlug?: string;
  status: RoomStatus;
  ownerId: string;
  maxParticipants: number;
  createdAt: string;
  closedAt?: string;
}

export interface CreateRoomRequest {
  title?: string;
  professor_name?: string;
  max_participants?: number;
}

export interface CreateRoomResponse {
  room_id: string;
  slug: string;
  link: string;
  ip_link?: string;
  mdns_link?: string;
  short_ip_link?: string;
  short_mdns_link?: string;
  status: RoomStatus;
  created_at: string;
  id?: string;
  join_url?: string;
}

export interface RoomLinkResponse {
  room_id: string;
  link: string;
  ip_link?: string;
  mdns_link?: string;
  short_ip_link?: string;
  short_mdns_link?: string;
}

// ── Participant ───────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  roomId: string;
  role: Role;
  name: string;
  studentId?: string; // obrigatório quando role === 'aluno'
  joinedAt: string;
  leftAt?: string;
  handRaised?: boolean;
  handRaisedAt?: string;
  hand_raised?: boolean;
  hand_raised_at?: string;
}

// ── ChatMessage ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  roomId: string;
  participantId: string;
  name: string;
  role: Role;
  content: string;
  sentAt: string;
  pinned?: boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Payload de POST /auth/session (o professor informa só o nome — ADR 0006). */
export interface SessionRequest {
  name: string;
}

/** Resposta de POST /auth/session (`contracts/auth.md`). */
export interface SessionResponse {
  token: string;
  expires_at?: string;
  name?: string;
}

/** Payload de POST /rooms/{id}/join (`001/contracts/room-api.md`). */
export type JoinRoomRequest = {
  name: string;
  student_id: string;
};

export type JoinRoomResponse = {
  token: string;
  expires_at: string;
  participant_id: string;
  room_status: RoomStatus;
  room_id: string;
  ws_url: string;
  ice_servers: any[];
  professor_name?: string;
  room_title?: string;
};

// ── WebSocket Events (Signaling + Chat) ──────────────────────────────────────

export type WsMessageType =
  | 'join'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'publish-request'
  | 'publish-approved'
  | 'subscribe-request'
  | 'session-state'
  | 'participant-joined'
  | 'participant-left'
  | 'room-closed'
  | 'chat-message'
  | 'pin-message'
  | 'chat-message-pinned'
  | 'ice-servers'
  | 'raise-hand'
  | 'lower-hand'
  | 'hand-updated'
  | 'error';

export interface RaiseHandPayload {
  raised: boolean;
}

export interface LowerHandPayload {
  participantId?: string;
  participant_id?: string;
}

export interface HandUpdatedPayload {
  participantId?: string;
  participant_id?: string;
  name: string;
  studentId?: string;
  student_id?: string;
  raised: boolean;
  raisedAt?: string;
  raised_at?: string;
}

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
}

export type SessionStatus = 'waiting' | 'publishing' | 'reconnecting' | 'closed';

export interface SessionStatePayload {
  status: SessionStatus;
  participantsCount?: number;
}

export interface ChatMessagePayload {
  messageId?: string;
  message_id?: string;
  participantId?: string;
  participant_id?: string;
  name: string;
  role: Role;
  studentId?: string;
  student_id?: string;
  content: string;
  isPrivate?: boolean;
  is_private?: boolean;
  targetId?: string;
  target_id?: string;
  sentAt?: string;
  sent_at?: string;
  pinned?: boolean;
}

export interface PinMessagePayload {
  messageId?: string;
  message_id?: string;
  pinned: boolean;
  isPrivate?: boolean;
  is_private?: boolean;
  targetId?: string;
  target_id?: string;
}

export interface ChatMessagePinnedPayload {
  messageId?: string;
  message_id?: string;
  pinned: boolean;
  isPrivate?: boolean;
  is_private?: boolean;
  targetId?: string;
  target_id?: string;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceServersPayload {
  iceServers: IceServer[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ── Session Metrics ───────────────────────────────────────────────────────────

export interface SessionMetrics {
  fps?: number;
  bitrateKbps?: number;
  rttMs?: number;
  packetLossPct?: number;
  firstFrameAt?: string;
  transportState: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

// ── Capture & Recording ──────────────────────────────────────────────────────

export type CaptureSourceType = 'screen' | 'window';

export interface CaptureSource {
  id: string;
  name: string;
  thumbnail: string;
  type: CaptureSourceType;
  /** display_id do Electron (somente telas) — usado para mapear o cursor no monitor correto */
  displayId?: string;
}

export interface CursorState {
  /** true = cursor deve aparecer para os alunos e na gravação */
  visible: boolean;
  /** Retângulo do cursor normalizado [0..1] relativo à fonte capturada; null = fora da fonte */
  rect: { x: number; y: number; w: number; h: number } | null;
  /** Limites em coordenadas DIP da tela da fonte capturada (monitor ou janela) */
  targetBounds?: { x: number; y: number; w: number; h: number } | null;
  /** true quando a janela principal do MLab está em foco ou sob o cursor */
  mlabFocused?: boolean;
}

export type RecordingFormat = 'webm';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

// ── Media Permissions ────────────────────────────────────────────────────────

export type MediaPermissionStatus = 'granted' | 'denied' | 'prompt' | 'not-determined' | 'unknown';

export interface SystemMediaPermissions {
  microphone: MediaPermissionStatus;
  screen: MediaPermissionStatus;
}

// ── Annotation & Spotlight Tools (PDF-style Editor + Lupa) ───────────────────

export type AnnotationTool = 'cursor' | 'pen' | 'highlighter' | 'arrow' | 'rect' | 'eraser';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'arrow' | 'rect';
  color: string;
  size: number;
  points: AnnotationPoint[];
}

export interface SpotlightState {
  enabled: boolean;
  /** Coordenada X normalizada [0..1] do centro do foco */
  x: number;
  /** Coordenada Y normalizada [0..1] do centro do foco */
  y: number;
  /** Raio normalizado [0..1] em relação à menor dimensão do quadro */
  radius: number;
  /** Nível de ampliação dentro da lupa (1 = apenas foco luminoso, 1.5x ou 2x = lente de aumento) */
  zoom: 1 | 1.5 | 2;
  /** true quando o mouse está sendo movido diretamente sobre o visualizador do MLab */
  activeInViewer?: boolean;
}

export interface AnnotationOverlayState {
  strokes: AnnotationStroke[];
  activeStroke: AnnotationStroke | null;
  spotlight: SpotlightState;
  captureMode?: CaptureSourceType;
  externalOverlayActive?: boolean;
}

export type AnnotationShortcutCommand =
  | 'toggle-collapse'
  | 'tool-cursor'
  | 'tool-pen'
  | 'tool-highlighter'
  | 'tool-arrow'
  | 'tool-rect'
  | 'tool-eraser'
  | 'toggle-spotlight'
  | 'cycle-zoom'
  | 'undo'
  | 'redo'
  | 'clear';

export interface AnnotationSessionState {
  activeTool: AnnotationTool;
  strokeColor: string;
  strokeSize: number;
  strokes: AnnotationStroke[];
  redoStrokes: AnnotationStroke[];
  activeStroke: AnnotationStroke | null;
  spotlight: SpotlightState;
  collapsed: boolean;
  toolbarPos?: { x: number; y: number } | null;
}
