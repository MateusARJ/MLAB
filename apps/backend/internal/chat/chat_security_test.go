package chat

import (
	"strings"
	"testing"
)

func TestChatSecurity_XSSSanitization(t *testing.T) {
	svc := NewService()

	xssPayloads := []struct {
		input    string
		expected string
	}{
		{
			input:    "<script>alert('xss')</script>",
			expected: "&lt;script&gt;alert('xss')&lt;/script&gt;",
		},
		{
			input:    "<img src=x onerror=alert(1)>",
			expected: "&lt;img src=x onerror=alert(1)&gt;",
		},
		{
			input:    "<b>Texto em negrito</b>",
			expected: "&lt;b&gt;Texto em negrito&lt;/b&gt;",
		},
		{
			input:    "<iframe src=\"javascript:alert(1)\"></iframe>",
			expected: "&lt;iframe src=&#34;javascript:alert(1)&#34;&gt;&lt;/iframe&gt;",
		},
	}

	for _, tc := range xssPayloads {
		msg, err := svc.SanitizeAndFormat("room-sec", "user-sec", "Aluno Teste", "aluno", tc.input)
		if err != nil {
			t.Fatalf("Erro inesperado no payload XSS '%s': %v", tc.input, err)
		}

		if msg.Content != tc.expected {
			t.Errorf("Falha na sanitizacao XSS.\nInput: %s\nEsperado: %s\nObteve:   %s", tc.input, tc.expected, msg.Content)
		}

		if strings.Contains(msg.Content, "<script>") || strings.Contains(msg.Content, "<img") {
			t.Errorf("Injecao XSS nao foi neutralizada! Conteudo: %s", msg.Content)
		}
	}
}
