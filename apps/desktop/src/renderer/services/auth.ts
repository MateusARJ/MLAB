import type { SessionResponse } from '@mlab/types';

const API_BASE_URL = 'http://localhost:8080';

/** Header que prova ao backend local que a requisição vem do app MLab desta máquina (ADR 0006). */
export const HOST_KEY_HEADER = 'X-MLab-Host-Key';

/**
 * Inicia a sessão direta do professor pelo nome informado (sem necessidade de login/senha).
 * Envia a chave de host obtida do processo principal e armazena o token e o nome no sessionStorage.
 */
export async function startProfessorSession(name: string): Promise<SessionResponse> {
  const trimmedName = name.trim() || 'Professor';
  const hostKey = (await window.electronAPI?.getHostKey?.()) ?? '';
  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [HOST_KEY_HEADER]: hostKey,
    },
    body: JSON.stringify({ name: trimmedName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro ao iniciar sessão' }));
    throw new Error(errorData.error || errorData.message || 'Falha ao registrar sessão do professor');
  }

  const data: SessionResponse = await response.json();
  sessionStorage.setItem('professor_token', data.token);
  sessionStorage.setItem('professor_name', data.name || trimmedName);
  return data;
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem('professor_token');
}

export function logout(): void {
  sessionStorage.removeItem('professor_token');
  sessionStorage.removeItem('professor_name');
}
