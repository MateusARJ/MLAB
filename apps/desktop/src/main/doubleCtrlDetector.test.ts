import { describe, it, expect, vi } from 'vitest';
import { DoubleCtrlDetector } from './doubleCtrlDetector';

describe('DoubleCtrlDetector (Main Process)', () => {
  it('deve disparar onDoubleCtrl ao detectar dois toques rápidos de Ctrl', () => {
    let ctrlDown = false;
    let otherKeyDown = false;

    const mockGetAsyncKeyState = (vKey: number) => {
      if (vKey === 0x11) {
        return ctrlDown ? 0x8000 : 0;
      }
      return otherKeyDown ? 0x8000 : 0;
    };

    const onDoubleCtrl = vi.fn();
    const detector = new DoubleCtrlDetector(onDoubleCtrl, mockGetAsyncKeyState);

    let now = 1000;

    // Toque 1: Pressiona Ctrl
    ctrlDown = true;
    expect(detector.tick(now)).toBe(false);

    // Toque 1: Solta Ctrl após 60ms
    now += 60;
    ctrlDown = false;
    expect(detector.tick(now)).toBe(false);

    // Intervalo de 120ms entre os toques
    now += 120;

    // Toque 2: Pressiona Ctrl novamente
    ctrlDown = true;
    expect(detector.tick(now)).toBe(true);
    expect(onDoubleCtrl).toHaveBeenCalledTimes(1);

    // Solta Ctrl
    now += 60;
    ctrlDown = false;
    expect(detector.tick(now)).toBe(false);
  });

  it('não deve disparar se outra tecla for pressionada junto (ex: Ctrl+C ou Ctrl+V)', () => {
    let ctrlDown = false;
    let otherKeyDown = false;

    const mockGetAsyncKeyState = (vKey: number) => {
      if (vKey === 0x11) {
        return ctrlDown ? 0x8000 : 0;
      }
      if (vKey === 0x43) { // 'C'
        return otherKeyDown ? 0x8000 : 0;
      }
      return 0;
    };

    const onDoubleCtrl = vi.fn();
    const detector = new DoubleCtrlDetector(onDoubleCtrl, mockGetAsyncKeyState);

    let now = 2000;

    // Pressiona Ctrl
    ctrlDown = true;
    detector.tick(now);

    // Pressiona 'C' enquanto Ctrl está baixo
    now += 30;
    otherKeyDown = true;
    detector.tick(now);

    // Solta 'C' e Ctrl
    now += 30;
    otherKeyDown = false;
    ctrlDown = false;
    detector.tick(now);

    // 100ms depois, pressiona Ctrl
    now += 100;
    ctrlDown = true;
    expect(detector.tick(now)).toBe(false);
    expect(onDoubleCtrl).not.toHaveBeenCalled();
  });

  it('não deve disparar se o intervalo entre os toques for maior que MAX_INTERVAL_MS', () => {
    let ctrlDown = false;

    const mockGetAsyncKeyState = (vKey: number) => {
      return vKey === 0x11 && ctrlDown ? 0x8000 : 0;
    };

    const onDoubleCtrl = vi.fn();
    const detector = new DoubleCtrlDetector(onDoubleCtrl, mockGetAsyncKeyState);

    let now = 3000;

    // Toque 1: Pressiona e solta
    ctrlDown = true;
    detector.tick(now);
    now += 50;
    ctrlDown = false;
    detector.tick(now);

    // Espera 700ms (> 600ms)
    now += 700;

    // Toque 2: Pressiona
    ctrlDown = true;
    expect(detector.tick(now)).toBe(false);
    expect(onDoubleCtrl).not.toHaveBeenCalled();
  });

  it('não deve disparar repetidamente dentro do cooldown de 350ms', () => {
    let ctrlDown = false;

    const mockGetAsyncKeyState = (vKey: number) => {
      return vKey === 0x11 && ctrlDown ? 0x8000 : 0;
    };

    const onDoubleCtrl = vi.fn();
    const detector = new DoubleCtrlDetector(onDoubleCtrl, mockGetAsyncKeyState);

    let now = 4000;

    // Duplo clique válido 1 (Trigger 1)
    ctrlDown = true;
    detector.tick(now);
    now += 50;
    ctrlDown = false;
    detector.tick(now); // release em 4050
    now += 100;
    ctrlDown = true;
    expect(detector.tick(now)).toBe(true); // trigger em 4150
    expect(onDoubleCtrl).toHaveBeenCalledTimes(1);

    // Solta Ctrl
    now += 50;
    ctrlDown = false;
    detector.tick(now); // 4200

    // Tenta outro duplo clique 100ms depois (< 350ms de 4150)
    now += 50;
    ctrlDown = true;
    detector.tick(now); // 4250
    now += 50;
    ctrlDown = false;
    detector.tick(now); // 4300
    now += 50;
    ctrlDown = true;
    expect(detector.tick(now)).toBe(false); // 4350 (< 4150 + 350 = 4500)
    expect(onDoubleCtrl).toHaveBeenCalledTimes(1);

    // Solta Ctrl
    now += 50;
    ctrlDown = false;
    detector.tick(now); // 4400

    // Avança o tempo para além do intervalo máximo e do cooldown (> 600ms e > 350ms)
    now = 5200;

    // Novo duplo clique válido após expiração (Trigger 2)
    ctrlDown = true;
    expect(detector.tick(now)).toBe(false); // 5200 - primeiro toque (delta de 4400 expirado > 600ms)
    now += 50;
    ctrlDown = false;
    detector.tick(now); // 5250 - solta primeiro toque
    now += 100;
    ctrlDown = true;
    expect(detector.tick(now)).toBe(true); // 5350 - segundo toque dispara!
    expect(onDoubleCtrl).toHaveBeenCalledTimes(2);
  });

  it('deve gerenciar início e parada do timer corretamente', () => {
    const mockGetAsyncKeyState = vi.fn().mockReturnValue(0);
    const onDoubleCtrl = vi.fn();
    const detector = new DoubleCtrlDetector(onDoubleCtrl, mockGetAsyncKeyState);

    expect(detector.isAvailable()).toBe(true);
    const started = detector.start();
    expect(started).toBe(true);

    detector.stop();
    detector.dispose();
    expect(detector.isAvailable()).toBe(false);
  });
});
