import { describe, it, expect } from 'vitest';
import { fileDownloadPath, fileDownloadUrl } from './api';

describe('fileDownloadPath (056/RF-5601)', () => {
  it('monta o caminho do contrato a partir da sala e do arquivo', () => {
    expect(fileDownloadPath('r1', 'f1')).toBe('/rooms/r1/files/f1/download');
  });

  it('codifica sala e arquivo para não sair da rota nem da origem', () => {
    expect(fileDownloadPath('r/1', 'javascript:alert(1)?x#y')).toBe(
      '/rooms/r%2F1/files/javascript%3Aalert(1)%3Fx%23y/download'
    );
    expect(fileDownloadPath('r1', '//evil.example')).toBe('/rooms/r1/files/%2F%2Fevil.example/download');
  });
});

describe('fileDownloadUrl', () => {
  it('acrescenta o token do aluno como parâmetro', () => {
    expect(fileDownloadUrl('/rooms/r1/files/f1/download', 'abc.def.ghi')).toBe(
      '/rooms/r1/files/f1/download?token=abc.def.ghi'
    );
  });

  it('usa & quando a URL já tem parâmetros', () => {
    expect(fileDownloadUrl('/x?a=1', 'tok')).toBe('/x?a=1&token=tok');
  });

  it('codifica caracteres especiais do token', () => {
    expect(fileDownloadUrl('/x', 'a+b/c=')).toBe('/x?token=a%2Bb%2Fc%3D');
  });

  it('mantém a URL quando não há token', () => {
    expect(fileDownloadUrl('/x', '')).toBe('/x');
  });
});
