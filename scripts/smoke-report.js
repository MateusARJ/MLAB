#!/usr/bin/env node
/**
 * Relatório consolidado da matriz de smoke A0–A20 (004/T408).
 *
 * Uso:
 *   npm run smoke                  -> roda o smoke de backend e o E2E e gera o relatório
 *   npm run smoke -- --no-run      -> só consolida os resultados já existentes
 *
 * Fontes:
 *   - smoke de backend: `go test -tags smoke -json` (apps/backend/cmd/server)
 *   - E2E do aluno:     apps/web/e2e-results/results.json (reporter JSON do Playwright)
 *   - roteiro manual:   docs/metrics/smoke-manual.json
 * Saída: docs/metrics/smoke-2026-11.md
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'apps', 'backend');
const webDir = path.join(root, 'apps', 'web');
const backendJson = path.join(root, 'docs', 'metrics', 'smoke-backend.jsonl');
const e2eJson = path.join(webDir, 'e2e-results', 'results.json');
const manualJson = path.join(root, 'docs', 'metrics', 'smoke-manual.json');
const outFile = path.join(root, 'docs', 'metrics', 'smoke-2026-11.md');

// Itens da matriz (Anexo A) e onde cada um é verificado.
const MATRIX = [
  ['A0', '`/auth/login` 404; sem login no app', ['backend']],
  ['A1', 'Professor entra por nome e chega ao Dashboard (dev e empacotado)', ['manual']],
  ['A2', 'Link fixo funciona em outro dispositivo da LAN', ['manual']],
  ['A3', 'Encerrar sala → alunos recebem `room-closed`', ['backend', 'e2e-desktop']],
  ['A4', 'Tela cheia imediata; troca para janela sem reconectar', ['manual']],
  ['A5', 'Múltiplas janelas / tracker nativo / oclusão', ['manual']],
  ['A6', 'Microfone mute/unmute + áudio interno', ['manual']],
  ['A7', 'Perfis 1080p 30 e 60 fps', ['manual']],
  ['A8', 'Gravação local .webm e .mp4', ['manual']],
  ['A9', 'Redirecionamento para a sala ativa; matrícula válida/inválida', ['backend', 'e2e-desktop', 'e2e-mobile']],
  ['A10', 'Vídeo chega ao aluno; autoplay; fullscreen; PiP', ['backend', 'e2e-desktop', 'e2e-mobile', 'manual:A10_celular']],
  ['A11', 'Overlay de anotações e lupa', ['manual']],
  ['A12', 'Cursor contextual; proteção de conteúdo; captura para clipboard', ['manual']],
  ['A13', 'Upload pelo professor; listagem e download pelo aluno', ['backend', 'e2e-desktop', 'e2e-mobile', 'manual:A13_celular']],
  ['A13b', 'Arrastar arquivos para a aba Arquivos; drop fora da zona não navega (018)', ['manual']],
  ['A14', 'Chat: palavrão mascarado, privado, fixar 3, histórico', ['backend', 'e2e-desktop']],
  ['A15', 'Levantar/abaixar mão; fila ordenada', ['backend', 'e2e-desktop', 'manual:A15_celular']],
  ['A15b', 'Mãos levantadas na barra de marcação fora do MLab (017)', ['manual']],
  ['A16', 'Acesso via `mlab.local` e IP', ['manual']],
  ['A16b', 'Dois professores na mesma rede: `mlab.local` e `mlab-2.local`', ['manual']],
  ['A17', 'Acesso via ngrok', ['manual']],
  ['A18', 'Queda do aluno → backoff; queda do professor → reconnecting 30 s', ['backend', 'e2e-desktop']],
  ['A19', 'Sessão duplicada do mesmo aluno → `4001`', ['backend']],
  ['A20', 'Rate limit do chat → `CHAT_RATE_LIMITED` sem desconectar', ['backend', 'e2e-desktop']],
  ['S2', 'Sessão de professor só com chave de host', ['backend']],
  ['S6', 'WebSocket recusa origem desconhecida', ['backend']],
  ['S9', 'Rajada de `request-keyframe` não derruba o aluno', ['backend']],
];

function run(cmd, args, cwd) {
  const opts = { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  // No Windows, `npx` é um .cmd e precisa de shell; passa o comando inteiro como uma string (args fixos, sem entrada externa).
  const r = process.platform === 'win32'
    ? spawnSync([cmd, ...args].join(' '), { ...opts, shell: true })
    : spawnSync(cmd, args, opts);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function itemIds(name) {
  // "A0_S2_sem_login" -> ["A0", "S2"]; "A9 @mobile entrada..." -> ["A9"]
  const ids = [];
  for (const tok of name.split(/[_\s]+/)) {
    if (/^[AS]\d{1,2}$/.test(tok)) ids.push(tok);
    else break;
  }
  return ids;
}

function readBackend() {
  const res = {};
  if (!fs.existsSync(backendJson)) return res;
  const output = {};
  for (const line of fs.readFileSync(backendJson, 'utf8').split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev.Test || !ev.Test.startsWith('TestSmoke/')) continue;
    const sub = ev.Test.slice('TestSmoke/'.length);
    if (ev.Action === 'output' && /\.go:\d+:/.test(ev.Output || '')) {
      (output[sub] ||= []).push(ev.Output.trim());
    }
    if (ev.Action === 'pass' || ev.Action === 'fail') {
      for (const id of itemIds(sub)) {
        res[id] = { status: ev.Action === 'pass' ? 'OK' : 'FALHA', detail: (output[sub] || []).join(' / ') };
      }
    }
  }
  return res;
}

function readE2E() {
  const res = { 'e2e-desktop': {}, 'e2e-mobile': {} };
  if (!fs.existsSync(e2eJson)) return res;
  const report = JSON.parse(fs.readFileSync(e2eJson, 'utf8'));
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const key = t.projectName === 'mobile' ? 'e2e-mobile' : 'e2e-desktop';
        const last = (t.results || [])[t.results.length - 1] || {};
        const ok = t.status === 'expected' || t.status === 'flaky';
        const err = last.error ? String(last.error.message || '').split('\n')[0].replace(/\x1b\[[0-9;]*m/g, '') : '';
        for (const id of itemIds(spec.title)) {
          res[key][id] = { status: ok ? 'OK' : t.status === 'skipped' ? 'N/E' : 'FALHA', detail: ok ? (t.status === 'flaky' ? 'passou no retry' : '') : err };
        }
      }
    }
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of report.suites || []) walk(s);
  return res;
}

function readManual() {
  if (!fs.existsSync(manualJson)) return {};
  const m = JSON.parse(fs.readFileSync(manualJson, 'utf8'));
  const res = {};
  for (const [id, v] of Object.entries(m.itens || {})) {
    const r = String(v.resultado || '').trim().toUpperCase();
    res[id] = { status: r || 'PENDENTE', detail: [v.observacao, v.evidencia && `evidência: ${v.evidencia}`].filter(Boolean).join(' — ') };
  }
  return res;
}

function combine(sources) {
  const statuses = sources.map((s) => s.status);
  if (statuses.includes('FALHA')) return 'FALHA';
  if (statuses.includes('PENDENTE') || statuses.includes('SEM RESULTADO')) return 'PENDENTE';
  if (statuses.every((s) => s === 'N/E')) return 'N/E';
  return 'OK';
}

function main() {
  const noRun = process.argv.includes('--no-run');
  if (!noRun) {
    console.log('smoke: rodando o smoke de backend...');
    const b = run('go', ['test', '-tags', 'smoke', '-run', 'TestSmoke', '-json', '-count=1', '-timeout', '5m', './cmd/server/'], backendDir);
    fs.writeFileSync(backendJson, b.stdout);
    console.log('smoke: rodando o E2E do aluno (Playwright)...');
    const w = run('npx', ['playwright', 'test'], webDir);
    if (!fs.existsSync(e2eJson)) console.error(w.stdout.slice(-2000), w.stderr.slice(-2000));
  }

  const backend = readBackend();
  const e2e = readE2E();
  const manual = readManual();

  const rows = [];
  const failures = [];
  const counts = { OK: 0, FALHA: 0, PENDENTE: 0, 'N/E': 0 };
  for (const [id, desc, where] of MATRIX) {
    const parts = [];
    for (const w of where) {
      let src;
      let label;
      if (w === 'backend') { src = backend[id]; label = 'backend'; }
      else if (w.startsWith('e2e-')) { src = e2e[w][id]; label = w === 'e2e-mobile' ? 'E2E mobile' : 'E2E desktop'; }
      else { const key = w.includes(':') ? w.split(':')[1] : id; src = manual[key]; label = key.endsWith('_celular') ? 'celular' : 'manual'; }
      src = src || { status: w.startsWith('manual') ? 'PENDENTE' : 'SEM RESULTADO', detail: '' };
      parts.push({ label, ...src });
    }
    const final = combine(parts);
    counts[final] = (counts[final] || 0) + 1;
    rows.push(`| ${id} | ${desc} | **${final}** | ${parts.map((p) => `${p.label}: ${p.status}`).join('<br>')} |`);
    for (const p of parts) if (p.status === 'FALHA' && p.detail) failures.push(`- **${id}** (${p.label}): ${p.detail.replace(/\|/g, '\\|')}`);
  }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const md = `# Matriz de smoke — resultado consolidado

Gerado por \`npm run smoke\` em ${now} (feature \`004-smoke-regression\`, T408).
Fontes: smoke de backend (\`go test -tags smoke\`), E2E do aluno (Playwright), roteiro manual
(\`docs/metrics/smoke-manual.json\`, passos em \`docs/metrics/smoke-runbook.md\`).

**Resumo:** ${counts.OK} OK · ${counts.FALHA} FALHA · ${counts.PENDENTE} PENDENTE · ${counts['N/E']} N/E

| # | Item | Resultado | Detalhe por fonte |
|---|---|---|---|
${rows.join('\n')}

## Falhas

${failures.length ? failures.join('\n') : 'Nenhuma.'}

## Legenda

- **OK:** todas as fontes do item passaram. **FALHA:** alguma fonte falhou. **PENDENTE:** falta resultado manual ou
  automático. **N/E:** não executável no ambiente disponível (justificativa no detalhe).
`;
  fs.writeFileSync(outFile, md);
  console.log(`smoke: relatório em ${path.relative(root, outFile)} — ${counts.OK} OK, ${counts.FALHA} FALHA, ${counts.PENDENTE} PENDENTE, ${counts['N/E']} N/E`);
}

main();
