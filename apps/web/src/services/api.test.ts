import { describe, it, expect } from 'vitest';
import { fileDownloadUrl } from './api';

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
