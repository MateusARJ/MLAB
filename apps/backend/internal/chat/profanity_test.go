package chat

import (
	"strings"
	"testing"
)

func TestMaskProfanity_DirectWords(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"porra", "*****"},
		{"merda", "*****"},
		{"caralho", "*******"},
		{"foda", "****"},
		{"foda-se", "*******"},
		{"vai tomar no cu", "*** ***** ** **"},
		{"Filho da puta!", "***** ** ****!"},
		{"esse cara é um babaca", "esse cara é um ******"},
		{"que bosta de sistema", "que ***** de sistema"},
		{"vai se fuder", "*** ** *****"},
		{"otário", "******"},
		{"OTÁRIO", "******"},
		{"cuzão", "*****"},
		{"fdp!", "***!"},
		{"pqp", "***"},
	}

	for _, c := range cases {
		got := MaskProfanity(c.input)
		if got != c.expected {
			t.Errorf("MaskProfanity(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestMaskProfanity_NoFalsePositives(t *testing.T) {
	legitimateTexts := []string{
		"Professor, meu computador não está conectando.",
		"Vamos discutir a documentação do projeto acadêmico.",
		"O circuito da placa mãe apresentou falhas.",
		"Estou gostando muito de curtir essa aula.",
		"Qual o custo de produção do software?",
		"O foco do estudo são as estruturas de dados.",
		"Preciso assistir à transmissão novamente.",
		"Temos que acumular mais conhecimento sobre redes.",
		"Documento entregue com sucesso!",
	}

	for _, text := range legitimateTexts {
		got := MaskProfanity(text)
		if got != text {
			t.Errorf("Falso positivo detectado!\nTexto original: %q\nTexto alterado:  %q", text, got)
		}
	}
}

func TestMaskProfanity_CaseAndAccentsAndLeetspeak(t *testing.T) {
	cases := []struct {
		input    string
		contains string
	}{
		{"CARALHO", "*******"},
		{"pOrRa", "*****"},
		{"fóda", "****"},
		{"bóstá", "*****"},
		{"p0rra", "*****"},
		{"m3rda", "*****"},
	}

	for _, c := range cases {
		got := MaskProfanity(c.input)
		if got != c.contains {
			t.Errorf("MaskProfanity(%q) = %q; want %q", c.input, got, c.contains)
		}
	}
}

func TestMaskProfanity_RepeatedLetters(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"pooooorra", "*********"},
		{"merdaaaaa", "*********"},
		{"carallllho", "**********"},
	}

	for _, c := range cases {
		got := MaskProfanity(c.input)
		if got != c.expected {
			t.Errorf("MaskProfanity(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestMaskProfanity_MixedSentence(t *testing.T) {
	input := "Boa tarde professor, esse exercício é foda pra caralho mas eu consegui."
	got := MaskProfanity(input)

	if strings.Contains(strings.ToLower(got), "foda") || strings.Contains(strings.ToLower(got), "caralho") {
		t.Errorf("Palavrão não foi mascarado no texto misto: %q", got)
	}

	if !strings.HasPrefix(got, "Boa tarde professor, esse exercício é **** pra ******* mas eu consegui.") {
		t.Errorf("Resultado inesperado: %q", got)
	}
}

func TestMaskProfanity_CapsLockAndExpandedCoverage(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"FODENDO", "*******"},
		{"FUDENDO", "*******"},
		{"DESGRAÇADOS", "***********"},
		{"DESGRAÇADAS", "***********"},
		{"VIADÃO", "******"},
		{"VIADAO", "******"},
		{"BOIOLA", "******"},
		{"BOIOLAS", "*******"},
		{"VTNC", "****"},
		{"VSF", "***"},
		{"TNC", "***"},
		{"PUTA QUE PARIU", "**** *** *****"},
		{"PUTA QUE O PARIU", "**** *** * *****"},
		{"VAI SE FODER", "*** ** *****"},
		{"VAI SE FUDER", "*** ** *****"},
		{"TOMA NO CU", "**** ** **"},
		{"TOMAR NO SEU CU", "***** ** *** **"},
		{"ARROMBADO", "*********"},
		{"ARROMBADOS", "**********"},
		{"ARROMBADAÇO", "***********"},
		{"CARALHADA", "*********"},
		{"RETARDADO", "*********"},
		{"IDIOTA", "******"},
		{"IMBECIL", "*******"},
	}

	for _, c := range cases {
		got := MaskProfanity(c.input)
		if got != c.expected {
			t.Errorf("MaskProfanity(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestMaskProfanity_UTF8AndAccents(t *testing.T) {
	legitimateAccents := []string{
		"Olá professor, d'água até o café!",
		"Não estou conseguindo entender a questão número 3.",
		"A função matemática é f(x) = x² + 2.",
		"Parabéns pela explicação da matéria!",
		"Hoje à noite teremos monitoria acadêmica?",
		"😀 Emojis e acentos funcionam normalmente no chat!",
	}

	for _, text := range legitimateAccents {
		got := MaskProfanity(text)
		if got != text {
			t.Errorf("Texto legítimo com UTF-8/acentos foi alterado indevidamente!\nOriginal: %q\nObtido:   %q", text, got)
		}
	}
}
