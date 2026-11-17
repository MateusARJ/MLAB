import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Favicon do web app dos alunos: ícone do header do desktop sem fundo (025 e 028 emendadas pela 045, RF-4501, RF-4502).
const webRoot = resolve(__dirname, '..');
const publicFile = (name: string) => resolve(webRoot, 'public', name);

function pngSize(name: string) {
  const buf = readFileSync(publicFile(name));
  // assinatura PNG + chunk IHDR: largura e altura em big-endian nos bytes 16-23
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('favicon do web app (025, emendado pela 028 e pela 045)', () => {
  const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');

  it('index.html declara o PNG 32x32 e o apple-touch-icon, sem o SVG antigo (RF-2504, RF-2814)', () => {
    expect(html).toContain('<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).not.toContain('favicon.svg');
    expect(html).not.toMatch(/rel="icon"[^>]*MLAB-logo\.png/);
  });

  it('os ícones existem em public/, o SVG antigo foi excluído e a logo das páginas continua lá (RF-2814)', () => {
    for (const name of ['favicon-32.png', 'apple-touch-icon.png', 'MLAB-logo.png']) {
      expect(existsSync(publicFile(name))).toBe(true);
    }
    expect(existsSync(publicFile('favicon.svg'))).toBe(false);
  });

  it('os PNGs têm 32x32 e 180x180 (RF-2503, RF-2814)', () => {
    expect(pngSize('favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(pngSize('apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });

  it('o apple-touch-icon é opaco: PNG sem canal alfa (RF-4502)', () => {
    // byte 25 do IHDR = tipo de cor; 2 = RGB sem alfa
    expect(readFileSync(publicFile('apple-touch-icon.png'))[25]).toBe(2);
  });

  it('o favicon 32x32 tem canal alfa para o fundo transparente (RF-4501)', () => {
    // byte 25 do IHDR = tipo de cor; 6 = RGBA
    expect(readFileSync(publicFile('favicon-32.png'))[25]).toBe(6);
  });
});
