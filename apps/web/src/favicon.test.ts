import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Favicon próprio do web app dos alunos (025, RF-2501 a RF-2504).
const webRoot = resolve(__dirname, '..');
const publicFile = (name: string) => resolve(webRoot, 'public', name);

function pngSize(name: string) {
  const buf = readFileSync(publicFile(name));
  // assinatura PNG + chunk IHDR: largura e altura em big-endian nos bytes 16-23
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('favicon do web app (025)', () => {
  const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');

  it('index.html declara o PNG 32x32, o SVG e o apple-touch-icon (RF-2504)', () => {
    expect(html).toContain('<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />');
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).not.toMatch(/rel="icon"[^>]*MLAB-logo\.png/);
    // o SVG vem depois do PNG para ter preferência nos navegadores que o aceitam
    expect(html.indexOf('/favicon.svg')).toBeGreaterThan(html.indexOf('/favicon-32.png'));
  });

  it('os ícones existem em public/ e a logo das páginas continua lá (RF-2504)', () => {
    for (const name of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'MLAB-logo.png']) {
      expect(existsSync(publicFile(name))).toBe(true);
    }
  });

  it('o SVG é quadrado, só vetorial, sem texto e com menos de 2 KB (RF-2501, RNF-2502)', () => {
    const svg = readFileSync(publicFile('favicon.svg'), 'utf8');
    expect(svg).toMatch(/viewBox="0 0 32 32"/);
    expect(svg).not.toMatch(/<text|<image/);
    expect(svg).toMatch(/fill="#0f172a"/);
    expect(statSync(publicFile('favicon.svg')).size).toBeLessThan(2048);
  });

  it('os PNGs de fallback têm 32x32 e 180x180 (RF-2503)', () => {
    expect(pngSize('favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(pngSize('apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });
});
