/**
 * @screenshare/types
 *
 * DTOs e tipos compartilhados entre apps/desktop e apps/web.
 * Populados em T007. Este arquivo serve como ponto de entrada do scaffold.
 */

// ── Roles ────────────────────────────────────────────────────────────────────

export type Role = 'professor' | 'aluno';

// ── Room ─────────────────────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'publishing' | 'closed';

export interface Room {
  id: string;
  slug: string;
  status: RoomStatus;
  ownerId: string;
  maxParticipants: number;
  createdAt: string;
  closedAt?: string;
}

export interface CreateRoomRequest {
  title?: string;
  max_participants?: number;
}

export interface CreateRoomResponse {
  room_id: string;
  slug: string;
  link: string;
  status: RoomStatus;
  created_at: string;
  id?: string;
  join_url?: string;
}

export interface RoomLinkResponse {
  room_id: string;
  link: string;
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
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  expiresAt: string;
}

export interface JoinRequest {
  name: string;
  studentId: string;
}

export interface JoinResponse {
  token: string;
  expiresAt: string;
  participantId: string;
  roomStatus: RoomStatus;
}

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
  | 'ice-servers'
  | 'error';

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
  messageId: string;
  participantId: string;
  name: string;
  role: Role;
  content: string;
  sentAt: string;
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
}

export type RecordingFormat = 'webm' | 'mp4';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';
