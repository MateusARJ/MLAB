import { describe, it, expect } from 'vitest';
import {
  parseWindowHandle,
  containsPoint,
  isCursorVisibleWindowMode,
  isCursorVisibleScreenMode,
  toNormalizedCursorRect,
} from './cursorVisibility';

describe('cursorVisibility (regras puras de visibilidade e geometria do cursor)', () => {
  describe('parseWindowHandle', () => {
    it('deve extrair o identificador numérico de sourceIds de janela do Electron', () => {
      expect(parseWindowHandle('window:131942:0')).toBe(131942n);
      expect(parseWindowHandle('window:9876543210:1')).toBe(9876543210n);
      expect(parseWindowHandle('window:0x20366:0')).toBe(0x20366n);
    });

    it('deve retornar null para sourceIds de tela ou inválidos', () => {
      expect(parseWindowHandle('screen:0:0')).toBeNull();
      expect(parseWindowHandle('window:0:0')).toBeNull();
      expect(parseWindowHandle('window:abc:0')).toBeNull();
      expect(parseWindowHandle('')).toBeNull();
    });
  });

  describe('isCursorVisibleWindowMode', () => {
    it('deve retornar true apenas quando a janela transmitida está em foco E sob o cursor', () => {
      expect(
        isCursorVisibleWindowMode({
          foreground: 100n,
          underCursor: 100n,
          target: 100n,
        })
      ).toBe(true);
    });

    it('deve ocultar o cursor quando o professor foca em outra janela (ex: WhatsApp ou MLab)', () => {
      expect(
        isCursorVisibleWindowMode({
          foreground: 200n, // WhatsApp em foco
          underCursor: 100n, // Mouse ainda sobre a janela do vídeo
          target: 100n,
        })
      ).toBe(false);

      expect(
        isCursorVisibleWindowMode({
          foreground: 200n, // WhatsApp em foco
          underCursor: 200n, // Mouse sobre o WhatsApp
          target: 100n,
        })
      ).toBe(false);
    });

    it('deve ocultar o cursor quando a janela transmitida está em foco mas o mouse sai dela', () => {
      expect(
        isCursorVisibleWindowMode({
          foreground: 100n,
          underCursor: 300n, // Mouse na barra de tarefas, área de trabalho ou MLab
          target: 100n,
        })
      ).toBe(false);
    });
  });

  describe('isCursorVisibleScreenMode (3 cenários do Modo Tela Cheia)', () => {
    it('Cenário 1: mouse sobre a janela visível do MLab -> cursor deve sumir (false)', () => {
      expect(
        isCursorVisibleScreenMode({
          isMlabUnderCursor: true,
          cursorInMlabBounds: true,
        })
      ).toBe(false);
    });

    it('Cenário 2: MLab aberto num canto mas mouse fora do MLab -> cursor deve aparecer (true)', () => {
      expect(
        isCursorVisibleScreenMode({
          isMlabUnderCursor: false,
          cursorInMlabBounds: false,
        })
      ).toBe(true);
    });

    it('Cenário 3: outra janela (ex: VS Code) cobrindo o MLab por cima -> cursor deve aparecer (true)', () => {
      expect(
        isCursorVisibleScreenMode({
          isMlabUnderCursor: false,
          cursorInMlabBounds: true,
        })
      ).toBe(true);
    });
  });

  describe('containsPoint & toNormalizedCursorRect', () => {
    const sourceRect = { x: 100, y: 200, w: 1920, h: 1080 };

    it('deve retornar null quando o cursor está fora da fonte capturada', () => {
      expect(toNormalizedCursorRect({ x: 50, y: 250 }, sourceRect)).toBeNull();
      expect(toNormalizedCursorRect({ x: 2100, y: 250 }, sourceRect)).toBeNull();
      expect(toNormalizedCursorRect({ x: 500, y: 100 }, sourceRect)).toBeNull();
      expect(toNormalizedCursorRect({ x: 500, y: 1400 }, sourceRect)).toBeNull();
    });

    it('deve calcular retângulo normalizado dentro de [0..1] para cursor no centro e nas bordas', () => {
      const center = toNormalizedCursorRect({ x: 1060, y: 740 }, sourceRect, 1);
      expect(center).not.toBeNull();
      expect(center!.x).toBeGreaterThan(0);
      expect(center!.y).toBeGreaterThan(0);
      expect(center!.x + center!.w).toBeLessThanOrEqual(1);
      expect(center!.y + center!.h).toBeLessThanOrEqual(1);

      const topLeft = toNormalizedCursorRect({ x: 100, y: 200 }, sourceRect, 1.5);
      expect(topLeft).not.toBeNull();
      expect(topLeft!.x).toBe(0);
      expect(topLeft!.y).toBe(0);
      expect(topLeft!.w).toBeGreaterThan(0);
      expect(topLeft!.h).toBeGreaterThan(0);
    });

    it('deve funcionar com monitores secundários em coordenadas negativas e ampliar margem com velocidade', () => {
      const negMonitor = { x: -1920, y: 0, w: 1920, h: 1080 };
      const slow = toNormalizedCursorRect({ x: -960, y: 540 }, negMonitor, 1, { vx: 0, vy: 0 });
      const fast = toNormalizedCursorRect({ x: -960, y: 540 }, negMonitor, 1, { vx: 40, vy: 30 });
      expect(slow).not.toBeNull();
      expect(fast).not.toBeNull();
      expect(fast!.w).toBeGreaterThan(slow!.w);
      expect(fast!.h).toBeGreaterThan(slow!.h);
    });

    it('containsPoint deve validar limites corretamente', () => {
      expect(containsPoint(sourceRect, { x: 100, y: 200 })).toBe(true);
      expect(containsPoint(sourceRect, { x: 2019, y: 1279 })).toBe(true);
      expect(containsPoint(sourceRect, { x: 2020, y: 1280 })).toBe(false);
    });
  });
});
