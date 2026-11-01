import { LoginResponse } from '@mlab/types';

const API_BASE_URL = 'http://localhost:8080';

/**
 * Inicia a sessão direta do professor pelo nome informado (sem necessidade de login/senha).
 * Armazena o token de sessão e o nome do professor no sessionStorage.
 */
export async function startProfessorSession(name: string): Promise<LoginResponse> {
  const trimmedName = name.trim() || 'Professor';
  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: trimmedName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro ao iniciar sessão' }));
    throw new Error(errorData.error || errorData.message || 'Falha ao registrar sessão do professor');
  }

  const data: LoginResponse = await response.json();
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
