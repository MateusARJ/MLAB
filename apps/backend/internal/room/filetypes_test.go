package room

import "testing"

func TestIsBlockedExtension(t *testing.T) {
	blocked := []string{
		"setup.exe", "instalador.msi", "patch.msp", "rodar.bat", "rodar.cmd", "antigo.com", "tela.scr", "atalho.pif",
		"painel.cpl", "script.ps1", "modulo.psm1", "macro.vbs", "macro.vbe", "codificado.jse", "tarefa.wsf",
		"config.wsh", "app.hta", "atalho.lnk", "chaves.reg", "biblioteca.dll", "app.AppImage", "pacote.deb",
		"pacote.rpm", "app.apk", "imagem.dmg", "instalador.pkg",
		// maiúsculas, ponto/espaço final e extensão dupla
		"SETUP.EXE", "setup.Exe", "setup.exe.", "setup.exe ", "setup.exe. . ", "trabalho.pdf.exe",
	}
	for _, name := range blocked {
		if !isBlockedExtension(name) {
			t.Errorf("isBlockedExtension(%q) = false, esperado true", name)
		}
	}

	allowed := []string{
		// código-fonte é material de aula (C-2202, RN-2202)
		"main.js", "app.ts", "aula.py", "build.sh", "Main.java", "lib.jar", "prog.c", "prog.go", "index.html",
		// documentos, mídia e compactados
		"slides.pdf", "foto.PNG", "planilha.xlsx", "texto.docx", "pacote.zip", "video.mp4",
		// sem extensão e nomes que só contêm a palavra
		"Makefile", "LEIAME", "exe", "exe.pdf", "meu.exe.pdf",
	}
	for _, name := range allowed {
		if isBlockedExtension(name) {
			t.Errorf("isBlockedExtension(%q) = true, esperado false", name)
		}
	}
}

func TestHasExecutableSignature(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		want bool
	}{
		{"PE/DOS", []byte("MZ\x90\x00\x03"), true},
		{"ELF", []byte("\x7fELF\x02\x01\x01"), true},
		{"Mach-O 32 BE", []byte{0xFE, 0xED, 0xFA, 0xCE, 0x00}, true},
		{"Mach-O 64 BE", []byte{0xFE, 0xED, 0xFA, 0xCF, 0x00}, true},
		{"Mach-O 32 LE", []byte{0xCE, 0xFA, 0xED, 0xFE, 0x00}, true},
		{"Mach-O 64 LE", []byte{0xCF, 0xFA, 0xED, 0xFE, 0x00}, true},
		{"PDF", []byte("%PDF-1.7"), false},
		{"PNG", []byte("\x89PNG\r\n\x1a\n"), false},
		{"ZIP/DOCX/JAR", []byte("PK\x03\x04"), false},
		{"texto", []byte("print('ola')"), false},
		{"vazio", nil, false},
		{"um byte M", []byte("M"), false},
		{"mz minúsculo", []byte("mz texto"), false},
	}
	for _, tc := range cases {
		if got := hasExecutableSignature(tc.data); got != tc.want {
			t.Errorf("%s: hasExecutableSignature = %v, esperado %v", tc.name, got, tc.want)
		}
	}
}

func TestServerContentType(t *testing.T) {
	cases := map[string]string{
		"slides.pdf":    "application/pdf",
		"FOTO.JPG":      "image/jpeg",
		"foto.jpeg":     "image/jpeg",
		"anim.gif":      "image/gif",
		"img.webp":      "image/webp",
		"img.png":       "image/png",
		"notas.txt":     "text/plain; charset=utf-8",
		"dados.csv":     "text/csv; charset=utf-8",
		"leia.md":       "text/markdown; charset=utf-8",
		"pacote.zip":    "application/zip",
		"aula.mp4":      "video/mp4",
		"audio.mp3":     "audio/mpeg",
		"texto.docx":    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"planilha.xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"slides.pptx":   "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"texto.odt":     "application/vnd.oasis.opendocument.text",
		"planilha.ods":  "application/vnd.oasis.opendocument.spreadsheet",
		"slides.odp":    "application/vnd.oasis.opendocument.presentation",
		"pagina.html":   "application/octet-stream",
		"logo.svg":      "application/octet-stream",
		"aula.py":       "application/octet-stream",
		"Makefile":      "application/octet-stream",
	}
	for name, want := range cases {
		if got := serverContentType(name); got != want {
			t.Errorf("serverContentType(%q) = %q, esperado %q", name, got, want)
		}
	}
}

func TestContentDisposition(t *testing.T) {
	cases := map[string]string{
		"slides.pdf":        `attachment; filename="slides.pdf"; filename*=UTF-8''slides.pdf`,
		"revisão-ação.pdf":  `attachment; filename="revis_o-a__o.pdf"; filename*=UTF-8''revis%C3%A3o-a%C3%A7%C3%A3o.pdf`,
		"ação.pdf":          `attachment; filename="a__o.pdf"; filename*=UTF-8''a%C3%A7%C3%A3o.pdf`,
		`aspas "x".txt`:     `attachment; filename="aspas _x_.txt"; filename*=UTF-8''aspas%20%22x%22.txt`,
		`barra\inv.txt`:     `attachment; filename="barra_inv.txt"; filename*=UTF-8''barra%5Cinv.txt`,
		"quebra\nlinha.txt": `attachment; filename="quebra_linha.txt"; filename*=UTF-8''quebra%0Alinha.txt`,
		"a;b=c%d.txt":       `attachment; filename="a;b=c%d.txt"; filename*=UTF-8''a%3Bb%3Dc%25d.txt`,
	}
	for name, want := range cases {
		if got := contentDisposition(name); got != want {
			t.Errorf("contentDisposition(%q)\n got: %s\nwant: %s", name, got, want)
		}
	}
}
