# RNF018 — Opcionalidade e Formato da Gravação Local de Aula

> **Categoria:** Gravação e Mídia Local
> **Formatos Suportados:** `.webm`, `.mp4`
> **Status:** Aprovado

---

## Descrição do Requisito

O professor deve ter a opção explícita de escolher se deseja gravar a transmissão da aula ou apenas transmitir sem gravação. Caso opte por gravar, o sistema deve permitir selecionar o formato do arquivo de saída entre `.webm` e `.mp4`.

---

## Justificativa e Impacto

Nem todas as aulas exigem gravação em disco. Oferecer a escolha prévia ao professor economiza armazenamento e recursos de processamento no dispositivo. A escolha entre `.webm` (formato aberto, codec VP9/VP8 de alta compressão) e `.mp4` (alta compatibilidade com reprodutores e editores) oferece flexibilidade pedagógica.

---

## Detalhes Técnicos

- A gravação ocorre no processo de renderização do Electron utilizando `MediaRecorder`.
- Se o formato escolhido for `.mp4`, o `MediaRecorder` utiliza `video/mp4` ou container compatível com codecs H.264/AAC. Se `.webm`, utiliza `video/webm;codecs=vp9,opus`.
- O arquivo é persistido localmente via Electron IPC (`dialog.showSaveDialog` e gravação com `fs.promises.writeFile`).
- O servidor SFU Pion em Go permanece 100% efêmero em memória, em estrita conformidade com o RNF016.

---

## Relação com o Sistema

- **Documento Principal:** [requirements.md](../../requirements.md)
- **Requisitos Relacionados:** RF004, RF026, RF027, RF028, RNF016
