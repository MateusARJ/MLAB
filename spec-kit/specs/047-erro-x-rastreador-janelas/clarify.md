# Clarify: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Status: CLOSED

Decisões registradas em 2026-11-18 na correção da issue #139, pedida pelo responsável. Ficam abertas à revisão no PR.
Nenhuma altera regra de negócio, contrato ou arquitetura.

## C-4701 — Mecanismo de captura de erro X

- **Opções:**
  - (A) extrair o handler temporário da 009/T911 para um módulo único (`x11ErrorTrap.ts`) e usá-lo no rastreador e na
    região de entrada;
  - (B) copiar o mesmo padrão para dentro do rastreador;
  - (C) instalar um handler global permanente uma vez na partida do app.
- **Resposta:** **A**. Atende ao pedido da #139 de um mecanismo único e evita duas cópias da struct `XErrorEvent`, do
  protótipo do handler e da lógica de restauração. (B) duplica código sensível; (C) esconderia erros de outros usuários
  do Xlib no processo e trocaria o handler de forma permanente.
- **Por que não há disputa entre os dois módulos:** cada um tem a própria conexão X, e o handler fica instalado só
  durante uma consulta síncrona no thread principal, sendo restaurado em seguida. Duas capturas nunca se sobrepõem.
- **Impacto em spec:** RF-4701, RF-4703.

## C-4702 — Comportamento do rastreador diante de erro X

- **Resposta:**
  - `BadWindow` é o caso esperado (janela fechou) e acontece a cada consulta enquanto o XID estiver inválido, a cada
    16 ms. Por isso não gera log: a consulta devolve o resultado de janela não encontrada, que o código já produz quando
    `XQueryTree`, `XGetWindowAttributes` ou `XTranslateCoordinates` falham.
  - Outro erro X gera `console.warn` uma vez por código de erro, para não inundar o log, e não lança: o
    `CursorPresenceTracker` chama o rastreador em laço e nem toda chamada está dentro de `try`.
  - Se a captura não puder ser criada (ex.: `koffi.register` indisponível), o rastreador devolve `null`, e o app usa o
    fallback do Electron, como já faz sem `koffi`. Melhor que um rastreador sem handler, que pode encerrar o processo.
- **Impacto em spec:** RF-4702, §8.

## C-4703 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/erro-x-rastreador-janelas`.
- **Faixa de IDs:** `US-470x`, `RF-470x`, `RNF-470x`, `C-470x` e `T470x`.
- **Impacto de versão:** **PATCH** (2.1.4 → 2.1.5). Correção de estabilidade no desktop, sem mudança de capacidade nem
  de contrato (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-4701 a C-4703 respondidas, sem ambiguidade em aberto.
