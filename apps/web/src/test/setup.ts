import { vi } from 'vitest';

// Mock global de WebRTC e APIs do navegador para testes no ambiente jsdom
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  // @ts-ignore
  window.HTMLMediaElement.prototype.pause = vi.fn();
}
