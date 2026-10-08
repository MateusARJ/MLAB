package chat

import (
	"strings"
	"unicode"
)

// normalizeRune mapeia caracteres acentuados e variações visuais (leetspeak comum numérico)
// para seus equivalentes ASCII em caixa baixa, mantendo a correspondência 1-para-1 de runes.
func normalizeRune(r rune) rune {
	r = unicode.ToLower(r)
	switch r {
	case 'á', 'à', 'ã', 'â', 'ä':
		return 'a'
	case 'é', 'è', 'ê', 'ë':
		return 'e'
	case 'í', 'ì', 'î', 'ï':
		return 'i'
	case 'ó', 'ò', 'õ', 'ô', 'ö':
		return 'o'
	case 'ú', 'ù', 'û', 'ü':
		return 'u'
	case 'ç':
		return 'c'
	case '4':
		return 'a'
	case '0':
		return 'o'
	case '1':
		return 'i'
	case '3':
		return 'e'
	case '5':
		return 's'
	case '7':
		return 't'
	default:
		return r
	}
}

// phrasesDictionary contém expressões ofensivas compostas normalizadas.
var phrasesDictionary = []string{
	"filho da puta",
	"filha da puta",
	"filhos da puta",
	"filhas da puta",
	"filho de uma puta",
	"vai se fuder",
	"vai tomar no cu",
	"foda-se",
	"foda se",
	"foder-se",
	"fodeu-se",
	"mother fucker",
	"motherfucker",
}

// wordsDictionary contém termos ofensivos isolados normalizados (PT-BR e EN).
var wordsDictionary = map[string]bool{
	"merda":        true,
	"merdas":       true,
	"bosta":        true,
	"bostas":       true,
	"porra":        true,
	"porras":       true,
	"caralho":      true,
	"caralhos":     true,
	"krl":          true,
	"krlinho":      true,
	"foda":         true,
	"fodas":        true,
	"foder":        true,
	"fode":         true,
	"fodeu":        true,
	"fodido":       true,
	"fodida":       true,
	"fodidos":      true,
	"fodidas":      true,
	"fudido":       true,
	"fudida":       true,
	"fudidos":      true,
	"fudidas":      true,
	"fodasse":      true,
	"fodase":       true,
	"puta":         true,
	"putas":        true,
	"puto":         true,
	"putos":        true,
	"putaria":      true,
	"putarias":     true,
	"cu":           true,
	"cus":          true,
	"cuzao":        true,
	"cuzudos":      true,
	"viado":        true,
	"viados":       true,
	"veado":        true,
	"veados":       true,
	"viadinho":     true,
	"viadagem":     true,
	"arrombado":    true,
	"arrombada":    true,
	"arrombados":   true,
	"arrombadas":   true,
	"desgraca":     true,
	"desgracado":   true,
	"desgracada":   true,
	"corno":        true,
	"cornos":       true,
	"corna":        true,
	"babaca":       true,
	"babacas":      true,
	"otario":       true,
	"otaria":       true,
	"otarios":      true,
	"otarias":      true,
	"fdp":          true,
	"pqp":          true,
	"cacete":       true,
	"cacetes":      true,
	"buceta":       true,
	"bucetas":      true,
	"bct":          true,
	"pica":         true,
	"picas":        true,
	"piroca":       true,
	"pirocas":      true,
	"rola":         true,
	"rolas":        true,
	"escroto":      true,
	"escrota":      true,
	"escrotos":     true,
	"vagabundo":    true,
	"vagabunda":    true,
	"vagabundos":   true,
	"vagabundas":   true,
	"fuck":         true,
	"fucking":      true,
	"fucked":       true,
	"fucker":       true,
	"fuckers":      true,
	"shit":         true,
	"shits":        true,
	"bitch":        true,
	"bitches":      true,
	"asshole":      true,
	"assholes":     true,
	"cunt":         true,
	"cunts":        true,
	"dick":         true,
	"dicks":        true,
	"pussy":        true,
	"pussies":      true,
	"bastard":      true,
	"bastards":     true,
	"cock":         true,
	"cocks":        true,
}

var collapsedWordsDictionary = map[string]bool{}

func init() {
	for w := range wordsDictionary {
		c := collapseAllRunes([]rune(w))
		collapsedWordsDictionary[c] = true
	}
}

// collapseAllRunes colapsa caracteres idênticos consecutivos em um só (ex: "porra" -> "pora", "pooooorra" -> "pora")
func collapseAllRunes(runes []rune) string {
	if len(runes) == 0 {
		return ""
	}
	var b strings.Builder
	var last rune
	for i, r := range runes {
		if i == 0 || r != last {
			b.WriteRune(r)
			last = r
		}
	}
	return b.String()
}

// isWordBoundaryChar retorna verdadeiro se o rune NÃO for letra nem dígito.
func isWordBoundaryChar(r rune) bool {
	return !unicode.IsLetter(r) && !unicode.IsDigit(r)
}

// MaskProfanity inspeciona o texto e substitui termos e frases ofensivas por asteriscos,
// preservando a visibilidade de palavras legítimas (ex: computador, discutir, documento).
func MaskProfanity(text string) string {
	if strings.TrimSpace(text) == "" {
		return text
	}

	origRunes := []rune(text)
	normRunes := make([]rune, len(origRunes))
	for i, r := range origRunes {
		normRunes[i] = normalizeRune(r)
	}

	maskFlags := make([]bool, len(origRunes))

	// 1. Verificação de expressões compostas (frases)
	normStr := string(normRunes)
	for _, phrase := range phrasesDictionary {
		pRunes := []rune(phrase)
		pLen := len(pRunes)
		idx := 0
		for {
			pos := strings.Index(normStr[idx:], phrase)
			if pos == -1 {
				break
			}
			matchStart := idx + pos

			// Converte posições em bytes para índices em runes
			startRune := len([]rune(normStr[:matchStart]))
			endRune := startRune + pLen

			// Valida limites de palavra antes e depois da frase
			leftOK := startRune == 0 || isWordBoundaryChar(origRunes[startRune-1])
			rightOK := endRune >= len(origRunes) || isWordBoundaryChar(origRunes[endRune])

			if leftOK && rightOK {
				for i := startRune; i < endRune; i++ {
					if !unicode.IsSpace(origRunes[i]) {
						maskFlags[i] = true
					}
				}
			}

			idx = matchStart + pLen
			if idx >= len(normStr) {
				break
			}
		}
	}

	// 2. Verificação de palavras isoladas respeitando estritamente os limites de palavra (\b)
	n := len(normRunes)
	i := 0
	for i < n {
		// Pula delimitadores
		if isWordBoundaryChar(normRunes[i]) {
			i++
			continue
		}

		// Início de uma palavra
		start := i
		for i < n && !isWordBoundaryChar(normRunes[i]) {
			i++
		}
		end := i

		word := string(normRunes[start:end])
		if wordsDictionary[word] {
			for k := start; k < end; k++ {
				maskFlags[k] = true
			}
		} else {
			// Verifica versão com caracteres repetidos colapsados (ex: "pooooorra" -> "pora" que casa com "porra" -> "pora")
			collapsed := collapseAllRunes(normRunes[start:end])
			if collapsedWordsDictionary[collapsed] {
				for k := start; k < end; k++ {
					maskFlags[k] = true
				}
			}
		}
	}

	// 3. Monta o resultado final substituindo os caracteres marcados por '*'
	result := make([]rune, len(origRunes))
	for idx, r := range origRunes {
		if maskFlags[idx] {
			result[idx] = '*'
		} else {
			result[idx] = r
		}
	}

	return string(result)
}
