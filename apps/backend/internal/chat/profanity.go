package chat

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
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
	"filho duma puta",
	"filho de uma egua",
	"puta que pariu",
	"puta que o pariu",
	"puta que te pariu",
	"puta merda",
	"vai se fuder",
	"vai se foder",
	"vai se fode",
	"vao se fuder",
	"vao se foder",
	"vai tomar no cu",
	"vai tomar no seu cu",
	"toma no cu",
	"tomar no cu",
	"tomar no seu cu",
	"vai pro caralho",
	"vai pra puta que pariu",
	"foda-se",
	"foda se",
	"foder-se",
	"fodeu-se",
	"chupa meu pau",
	"chupa minha rola",
	"mother fucker",
	"motherfucker",
}

// wordsDictionary contém termos ofensivos isolados normalizados (PT-BR e EN).
var wordsDictionary = map[string]bool{
	"merda":        true,
	"merdas":       true,
	"merdinha":     true,
	"bosta":        true,
	"bostas":       true,
	"bostinha":     true,
	"porra":        true,
	"porras":       true,
	"caralho":      true,
	"caralhos":     true,
	"caralhada":    true,
	"krl":          true,
	"krlinho":      true,
	"foda":         true,
	"fodas":        true,
	"foder":        true,
	"fode":         true,
	"fodeu":        true,
	"fodi":         true,
	"fodei":        true,
	"fodes":        true,
	"fodam":        true,
	"fudam":        true,
	"fodendo":      true,
	"fudendo":      true,
	"foderam":      true,
	"fuderam":      true,
	"fodao":        true,
	"fudao":        true,
	"fodido":       true,
	"fodida":       true,
	"fodidos":      true,
	"fodidas":      true,
	"fudido":       true,
	"fudida":       true,
	"fudidos":      true,
	"fudidas":      true,
	"fudidasso":    true,
	"fudidaco":     true,
	"fodasse":      true,
	"fodase":       true,
	"puta":         true,
	"putas":        true,
	"putinha":      true,
	"putinhas":     true,
	"puto":         true,
	"putos":        true,
	"putao":        true,
	"putaria":      true,
	"putarias":     true,
	"cu":           true,
	"cus":          true,
	"cuzao":        true,
	"cuzoes":       true,
	"cuzudos":      true,
	"cuzinho":      true,
	"cuzinhos":     true,
	"viado":        true,
	"viados":       true,
	"viadao":       true,
	"viadoes":      true,
	"veado":        true,
	"veados":       true,
	"viadinho":     true,
	"viadagem":     true,
	"boiola":       true,
	"boiolas":      true,
	"boiolice":     true,
	"bicha":        true,
	"bichas":       true,
	"baitola":      true,
	"baitolas":     true,
	"arrombado":    true,
	"arrombada":    true,
	"arrombados":   true,
	"arrombadas":   true,
	"arrombadao":   true,
	"arrombadaco":  true,
	"desgraca":     true,
	"desgracado":   true,
	"desgracada":   true,
	"desgracados":  true,
	"desgracadas":  true,
	"corno":        true,
	"cornos":       true,
	"corna":        true,
	"cornao":       true,
	"cornudo":      true,
	"babaca":       true,
	"babacas":      true,
	"otario":       true,
	"otaria":       true,
	"otarios":      true,
	"otarias":      true,
	"fdp":          true,
	"pqp":          true,
	"vtnc":         true,
	"vsf":          true,
	"tnc":          true,
	"vnc":          true,
	"kct":          true,
	"cct":          true,
	"cacete":       true,
	"cacetes":      true,
	"buceta":       true,
	"bucetas":      true,
	"bucetinha":    true,
	"bucetinhas":   true,
	"bucetao":      true,
	"bct":          true,
	"pica":         true,
	"picas":        true,
	"picao":        true,
	"piroca":       true,
	"pirocas":      true,
	"pirocao":      true,
	"piroquinha":   true,
	"rola":         true,
	"rolas":        true,
	"xoxota":       true,
	"xoxotas":      true,
	"xoxotinha":    true,
	"punheta":      true,
	"punheteiro":   true,
	"punheteiros":  true,
	"siririca":     true,
	"boquete":      true,
	"boqueteiro":   true,
	"boqueteiros":  true,
	"escroto":      true,
	"escrota":      true,
	"escrotos":     true,
	"vagabundo":    true,
	"vagabunda":    true,
	"vagabundos":   true,
	"vagabundas":   true,
	"retardado":    true,
	"retardada":    true,
	"retardados":   true,
	"retardadas":   true,
	"idiota":       true,
	"idiotas":      true,
	"imbecil":      true,
	"imbecis":      true,
	"estupido":     true,
	"estupida":     true,
	"estupidos":    true,
	"estupidas":    true,
	"canalha":      true,
	"canalhas":     true,
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
	"stfu":         true,
	"wtf":          true,
	"bullshit":     true,
	"dumbass":      true,
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

	// 0. Garante que o texto seja UTF-8 válido e canonicamente normalizado em NFC
	text = norm.NFC.String(strings.ToValidUTF8(text, ""))

	origRunes := []rune(text)
	normRunes := make([]rune, len(origRunes))
	for i, r := range origRunes {
		normRunes[i] = normalizeRune(r)
	}

	maskFlags := make([]bool, len(origRunes))

	// 1. Verificação de expressões compostas (frases)
	// Trabalha estritamente com fatias de runes para evitar anomalias de fatiamento de bytes com UTF-8
	for _, phrase := range phrasesDictionary {
		pRunes := []rune(phrase)
		pLen := len(pRunes)
		if pLen == 0 || pLen > len(normRunes) {
			continue
		}

		for i := 0; i <= len(normRunes)-pLen; i++ {
			match := true
			for j := 0; j < pLen; j++ {
				if normRunes[i+j] != pRunes[j] {
					match = false
					break
				}
			}
			if !match {
				continue
			}

			// Valida limites de palavra antes e depois da frase
			leftOK := i == 0 || isWordBoundaryChar(origRunes[i-1])
			rightOK := (i+pLen) >= len(origRunes) || isWordBoundaryChar(origRunes[i+pLen])

			if leftOK && rightOK {
				for k := i; k < i+pLen; k++ {
					if !unicode.IsSpace(origRunes[k]) {
						maskFlags[k] = true
					}
				}
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
