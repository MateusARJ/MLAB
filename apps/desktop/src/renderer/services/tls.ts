// HTTPS na LAN (edição MLab HTTPS — ADR 0008, feature 011, contrato 011/tls.md).
const API_BASE_URL = 'http://localhost:8080';

export interface TlsInfo {
  enabled: boolean;
  port?: string;
  fingerprint?: string;
  fingerprint_sha256?: string;
  ca_url?: string;
}

/** Consulta GET /tls/info no backend embarcado. Qualquer falha devolve null. */
export async function getTlsInfo(): Promise<TlsInfo | null> {
  try {
    const resp = await fetch(`${API_BASE_URL}/tls/info`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = (await resp.json()) as TlsInfo;
    return typeof data?.enabled === 'boolean' ? data : null;
  } catch {
    return null;
  }
}

/** URL do certificado da CA no backend embarcado, para exportar (RF-1108). */
export function caCertificateUrl(info: TlsInfo): string {
  return `${API_BASE_URL}${info.ca_url || '/mlab-ca.crt'}`;
}
