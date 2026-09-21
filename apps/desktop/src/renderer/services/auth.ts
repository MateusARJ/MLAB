import { LoginRequest, LoginResponse } from '@mlab/types';

const API_BASE_URL = 'http://localhost:8080';

export async function loginProfessor(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro na autenticacao' }));
    throw new Error(errorData.error || errorData.message || 'Credenciais invalidas');
  }

  const data: LoginResponse = await response.json();
  // Armazena token na memoria/storage seguro da sessao (RF-12)
  sessionStorage.setItem('professor_token', data.token);
  if (data.name) {
    sessionStorage.setItem('professor_name', data.name);
  }
  return data;
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem('professor_token');
}

export function logout(): void {
  sessionStorage.removeItem('professor_token');
  sessionStorage.removeItem('professor_name');
}
