import { CreateRoomResponse, RoomLinkResponse } from '@mlab/types';
import { getStoredToken } from './auth';

const API_BASE_URL = 'http://localhost:8080';

export async function createRoom(title: string, professorName?: string): Promise<CreateRoomResponse> {
  const token = getStoredToken();
  const profName = professorName || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('professor_name') : null) || undefined;
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ title, professor_name: profName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Erro ao criar sala' }));
    throw new Error(err.message || 'Falha ao criar sala');
  }

  return response.json();
}

export async function getRoomLink(roomID: string): Promise<RoomLinkResponse> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/rooms/${roomID}/link`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Falha ao obter link da sala');
  }

  return response.json();
}

export async function closeRoom(roomID: string): Promise<void> {
  const token = getStoredToken();
  await fetch(`${API_BASE_URL}/rooms/${roomID}/close`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}
