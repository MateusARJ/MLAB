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

  const data: JoinRoomResponse = await response.json();
  sessionStorage.setItem('student_token', data.token);
  return data;
}

export function getStoredStudentToken(): string | null {
  return sessionStorage.getItem('student_token');
}
