# RF028 — Gravação Local de Aula no Desktop

> **Categoria:** Gravação e Mídia
> **Prioridade:** Média
> **Status:** Aprovado

---

## Descrição

O aplicativo desktop deve permitir gravar localmente o áudio e vídeo da aula. Antes de iniciar a transmissão, o sistema deve apresentar a escolha se o professor deseja gravar e em qual formato (`.webm` ou `.mp4`). Durante a aula, o professor pode pausar, retomar e finalizar a gravação salvando o arquivo via diálogo nativo do sistema operacional.

---

## Justificativa e Impacto

Permitir ao professor disponibilizar a aula gravada para os alunos posteriormente em ambiente assíncrono, mantendo controle local sobre o arquivo.

---

## Detalhes Técnicos

- Utiliza API nativa `MediaRecorder` com stream combinado de vídeo e áudio do microfone.
- Permite selecionar extensão e codec `.webm` ou `.mp4`.
- Exportação via IPC `dialog.showSaveDialog` e gravação com `fs.promises.writeFile`.
