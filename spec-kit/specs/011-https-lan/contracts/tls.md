# Contrato: HTTPS na LAN (edição MLab HTTPS)

Feature: `011-https-lan` · ADR 0008

## Listeners

| Porta | Protocolo | Variável | Conteúdo |
|---|---|---|---|
| `8080` | HTTP | `PORT` | igual a hoje: API, WebSocket, web do aluno, rotas abaixo |
| `8443` | HTTPS (TLS ≥ 1.2, HTTP/1.1) | `WEB_TLS_PORT` | o mesmo roteador da 8080 |

TLS ligado por `MLAB_TLS=1`. A CA fica em `MLAB_TLS_DIR`, padrão `tls`, relativo ao diretório de trabalho.

## `GET /tls/info`

Público, nos dois listeners. `200 application/json`, `Cache-Control: no-store`.

```json
{
  "enabled": true,
  "port": "8443",
  "fingerprint": "A1B2 C3D4 E5F6 0718",
  "fingerprint_sha256": "A1:B2:...:FF",
  "ca_url": "/mlab-ca.crt"
}
```

- TLS desligado: `{"enabled": false}`.
- Modo dev com redirecionamento ao Vite: `enabled: false`. Os demais campos continuam presentes se a CA existir.

## `GET /mlab-ca.crt`

Público. `200`, com:
- `Content-Type: application/x-x509-ca-cert`;
- `Content-Disposition: attachment; filename="mlab-ca.crt"`;
- `Cache-Control: no-store`;
- `X-Content-Type-Options: nosniff`;
- corpo: o certificado da CA em PEM.

A chave privada nunca é servida. Com TLS desligado: `404`.

## `GET /tls/ok`

- Por HTTPS: `200 {"ok":true}` com `Cache-Control: no-store`. O CORS segue o `corsMiddleware`, que aceita a origem
  HTTP do mesmo host.
- Por HTTP: `404`. Com TLS desligado: `404`.

## Certificados

| | CA | Servidor |
|---|---|---|
| Algoritmo | ECDSA P-256 / SHA-256 | ECDSA P-256 / SHA-256 |
| Validade | 10 anos | 30 dias (renovado com < 1 dia restante) |
| Extensões | `IsCA`, `MaxPathLen 0`, `KeyUsage CertSign`, Name Constraints críticas | `serverAuth`, SAN com o nome acessado |
| Name Constraints | DNS: `local`, `localhost`; IP: 10/8, 172.16/12, 192.168/16, 169.254/16, 127/8, ::1/128, fc00::/7, fe80::/10 | — |
| Armazenamento | `tls/mlab-ca.crt`, `tls/mlab-ca.key` (0600) | só em memória |
