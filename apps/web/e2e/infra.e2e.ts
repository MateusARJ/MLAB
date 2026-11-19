/**
 * Infraestrutura do E2E (051). Itens I*, fora da matriz de smoke A0–A20.
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';

// I1 (051/RF-5104): o trace do Playwright grava cópias .html das páginas na pasta de saída. Se o Vite observasse essa
// pasta, mandaria full-reload e a página do aluno recarregaria no meio do teste (#153).
test('I1 artefatos do e2e não fazem o Vite recarregar a página', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'basta um projeto: o servidor do Vite é o mesmo');

  const hmr: string[] = [];
  page.on('websocket', (ws) => {
    if (new URL(ws.url()).pathname !== '/') return; // só o WebSocket do HMR do Vite
    ws.on('framereceived', (f) => hmr.push(String(f.payload)));
  });

  await page.goto('/');
  // Sem o frame "connected" o teste não provaria nada: o HMR precisa estar ouvindo.
  await expect.poll(() => hmr.some((f) => f.includes('"connected"'))).toBe(true);

  const legacyDir = path.resolve(__dirname, '..', 'e2e-results', `i1-${Date.now()}`);
  const files = [path.join(testInfo.outputDir, 'i1-recurso.html'), path.join(legacyDir, 'i1-recurso.html')];
  try {
    for (const file of files) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '<!doctype html><title>I1</title>');
    }
    // O Vite manda o full-reload em poucos milissegundos; 2 s cobre o debounce do watcher.
    await page.waitForTimeout(2_000);
  } finally {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }

  expect(hmr.filter((f) => f.includes('full-reload'))).toEqual([]);
});
