package auth

import (
	"crypto/rand"
	"encoding/hex"
)

// newID gera um ID hexadecimal aleatório de 16 bytes.
func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("auth: falha ao gerar ID: " + err.Error())
	}
	return hex.EncodeToString(b)
}
