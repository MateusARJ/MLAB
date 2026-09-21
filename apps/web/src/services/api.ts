import { JoinRoomRequest, JoinRoomResponse } from '@mlab/types';

function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }
  return 'http://localhost:8080';
}

const API_BASE_URL = getApiBaseUrl();

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
