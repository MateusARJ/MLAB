/**
 * Envio de arquivos da sala (003/contracts/files.md — POST /rooms/{roomId}/files; 018-arquivos-arrastar).
 * O contrato não muda: multipart com o campo `file`, resposta 201 com o arquivo, erros com `{ error }`.
 */
const API_BASE_URL = 'http://localhost:8080';

/** Limite por arquivo do servidor (`maxFileBytes` em `apps/backend/internal/room/files.go`). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Mesma mensagem do servidor para arquivo acima do limite (413). */
export const FILE_TOO_LARGE_MSG = 'arquivo acima do limite de 50MB';

/**
 * Mesma mensagem do servidor para tipo bloqueado (415; 022/C-2204). Fonte no backend:
 * `errBlockedFileTypeMsg` em `apps/backend/internal/room/filetypes.go`.
 */
export const BLOCKED_TYPE_MSG = 'tipo de arquivo bloqueado: executáveis e instaladores não podem ser compartilhados';

/**
 * Executáveis e instaladores bloqueados (022/C-2202). Mesma lista de `blockedExtensions` em
 * `apps/backend/internal/room/filetypes.go` (RN-2201). Código-fonte (.js, .ts, .py, .sh, .jar...) é permitido.
 * O servidor é a autoridade: esta lista só antecipa a mensagem (RNF-2201).
 */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  '.exe', '.msi', '.msp', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.ps1', '.psm1', '.vbs', '.vbe',
  '.jse', '.wsf', '.wsh', '.hta', '.lnk', '.reg', '.dll', '.appimage', '.deb', '.rpm', '.apk', '.dmg', '.pkg',
];

/**
 * Informa se o nome tem extensão bloqueada, com a mesma normalização do servidor: última extensão, sem diferenciar
 * maiúsculas e ignorando pontos e espaços no fim (`setup.EXE.` → `.exe`). RF-2206.
 */
export function isBlockedFileName(name: string): boolean {
  const trimmed = name.replace(/[. ]+$/, '');
  const dot = trimmed.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = trimmed.slice(dot).toLowerCase();
  return BLOCKED_EXTENSIONS.includes(ext);
}

/** Mensagem quando o servidor não informa o erro ou a requisição falha. */
export const UPLOAD_ERROR_MSG = 'Erro ao enviar arquivo';

/** Arquivo compartilhado na sala, como devolvido pelo backend (contracts/files.md). */
export interface RoomFile {
  id: string;
  room_id: string;
  name: string;
  size: number;
  content_type: string;
  url: string;
  uploaded_at: string;
}

/**
 * Envia um arquivo para a turma. Em erro, lança `Error` com o campo `error` da resposta do servidor
 * (ex.: 413, 403) ou com `UPLOAD_ERROR_MSG`.
 */
export async function uploadRoomFile(roomId: string, file: File, token: string): Promise<RoomFile> {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch {
    throw new Error(UPLOAD_ERROR_MSG);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body && typeof body.error === 'string' && body.error.trim() ? body.error : UPLOAD_ERROR_MSG;
    throw new Error(message);
  }

  return response.json();
}
