import { JoinRoomRequest, JoinRoomResponse } from '@mlab/types';

export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }
  return 'http://localhost:8080';
}

export const API_BASE_URL = getApiBaseUrl();

export interface RoomInfo {
  room_id: string;
  slug: string;
  title: string;
  professor_name: string;
  status: string;
}

export interface ActiveRoomInfo {
  room_id: string;
  slug: string;
  title: string;
  professor_name: string;
  status: string;
  link: string;
  ip_link?: string;
  mdns_link?: string;
  short_ip_link?: string;
  short_mdns_link?: string;
}

export async function getActiveRoom(): Promise<ActiveRoomInfo | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/active`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getRoomInfo(slug: string): Promise<RoomInfo | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${slug}/info`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function joinRoom(slug: string, req: JoinRoomRequest): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${slug}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro ao entrar na sala' }));
    throw new Error(errorData.error || errorData.message || 'Falha ao entrar na sala');
  }

  return response.json() as Promise<JoinRoomResponse>;
}

/**
 * Monta a URL de download de um arquivo da sala com o token do aluno no parâmetro `token`,
 * exigido pelo backend porque links `<a href download>` não enviam o header Authorization
 * (contracts/files.md — 002-security-hardening/S4).
 */
export function fileDownloadUrl(url: string, token: string): string {
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
