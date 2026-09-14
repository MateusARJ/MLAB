import { JoinRoomRequest, JoinRoomResponse } from '@screenshare/types';

const API_BASE_URL = 'http://localhost:8080';

export async function joinRoom(slug: string, req: JoinRoomRequest): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${slug}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Erro ao entrar na sala' }));
    throw new Error(errorData.message || 'Falha ao entrar na sala');
  }

  const data: JoinRoomResponse = await response.json();
  sessionStorage.setItem('student_token', data.token);
  return data;
}

export function getStoredStudentToken(): string | null {
  return sessionStorage.getItem('student_token');
}
