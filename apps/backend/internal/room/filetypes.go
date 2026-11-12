package room

import (
	"bytes"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// Regras de tipo de arquivo do compartilhamento da sala (022-bloqueio-executaveis-upload; contracts/files.md da 003).

// errBlockedFileTypeMsg é a resposta do 415. A mesma mensagem existe no desktop
// (apps/desktop/src/renderer/services/files.ts, BLOCKED_TYPE_MSG — 022/RN-2201).
const errBlockedFileTypeMsg = "tipo de arquivo bloqueado: executáveis e instaladores não podem ser compartilhados"

// blockedExtensions lista executáveis e instaladores que o sistema roda com duplo clique (022/C-2202).
// Código-fonte (.js, .ts, .py, .sh, .jar...) fica de fora de propósito: é material de aula.
// A mesma lista existe no desktop (BLOCKED_EXTENSIONS) — 022/RN-2201.
var blockedExtensions = map[string]struct{}{
	".exe": {}, ".msi": {}, ".msp": {}, ".bat": {}, ".cmd": {}, ".com": {}, ".scr": {}, ".pif": {}, ".cpl": {},
	".ps1": {}, ".psm1": {}, ".vbs": {}, ".vbe": {}, ".jse": {}, ".wsf": {}, ".wsh": {}, ".hta": {}, ".lnk": {},
	".reg": {}, ".dll": {}, ".appimage": {}, ".deb": {}, ".rpm": {}, ".apk": {}, ".dmg": {}, ".pkg": {},
}

// executableSignatures são os prefixos de executáveis nativos: PE/DOS, ELF e Mach-O (022/RF-2202).
var executableSignatures = [][]byte{
	[]byte("MZ"),
	[]byte("\x7fELF"),
	{0xFE, 0xED, 0xFA, 0xCE},
	{0xFE, 0xED, 0xFA, 0xCF},
	{0xCE, 0xFA, 0xED, 0xFE},
	{0xCF, 0xFA, 0xED, 0xFE},
}

// serverContentTypes é o mapa de C-2203. Tipos que o navegador renderiza com script (.html, .svg) ficam fora.
var serverContentTypes = map[string]string{
	".pdf":  "application/pdf",
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".gif":  "image/gif",
	".webp": "image/webp",
	".txt":  "text/plain; charset=utf-8",
	".csv":  "text/csv; charset=utf-8",
	".md":   "text/markdown; charset=utf-8",
	".zip":  "application/zip",
	".mp4":  "video/mp4",
	".mp3":  "audio/mpeg",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".odt":  "application/vnd.oasis.opendocument.text",
	".ods":  "application/vnd.oasis.opendocument.spreadsheet",
	".odp":  "application/vnd.oasis.opendocument.presentation",
}

const defaultContentType = "application/octet-stream"

// normalizedExt devolve a última extensão em minúsculas, ignorando pontos e espaços finais
// ("setup.EXE." → ".exe"), que o Windows descarta ao salvar o arquivo.
func normalizedExt(name string) string {
	return strings.ToLower(filepath.Ext(strings.TrimRight(name, ". ")))
}

// isBlockedExtension informa se o nome tem extensão de executável ou instalador (022/RF-2201).
func isBlockedExtension(name string) bool {
	_, blocked := blockedExtensions[normalizedExt(name)]
	return blocked
}

// hasExecutableSignature informa se o conteúdo começa com a assinatura de um executável nativo (022/RF-2202).
func hasExecutableSignature(data []byte) bool {
	for _, sig := range executableSignatures {
		if bytes.HasPrefix(data, sig) {
			return true
		}
	}
	return false
}

// serverContentType define o Content-Type pela extensão, ignorando o que o cliente declarou (022/RF-2204).
func serverContentType(name string) string {
	if ct, ok := serverContentTypes[normalizedExt(name)]; ok {
		return ct
	}
	return defaultContentType
}

// contentDisposition monta o header de download conforme RFC 6266/5987 (022/RF-2205):
// filename com fallback ASCII (cada caractere fora de ASCII imprimível, '"' e '\' vira '_')
// e filename* com o nome em UTF-8 codificado.
func contentDisposition(name string) string {
	var ascii strings.Builder
	for _, r := range name {
		if r < 0x20 || r > 0x7E || r == '"' || r == '\\' {
			ascii.WriteByte('_')
			continue
		}
		ascii.WriteRune(r)
	}
	return `attachment; filename="` + ascii.String() + `"; filename*=UTF-8''` + encodeRFC5987(name)
}

// encodeRFC5987 codifica o valor de um parâmetro estendido (RFC 5987 §3.2.1): mantém os attr-char e
// codifica em %XX os demais bytes UTF-8. Sequências UTF-8 inválidas viram U+FFFD antes da codificação.
func encodeRFC5987(s string) string {
	if !utf8.ValidString(s) {
		s = strings.ToValidUTF8(s, "�")
	}
	const hex = "0123456789ABCDEF"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if isAttrChar(c) {
			b.WriteByte(c)
			continue
		}
		b.WriteByte('%')
		b.WriteByte(hex[c>>4])
		b.WriteByte(hex[c&0x0F])
	}
	return b.String()
}

func isAttrChar(c byte) bool {
	switch {
	case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9':
		return true
	}
	return strings.IndexByte("!#$&+-.^_`|~", c) >= 0
}
