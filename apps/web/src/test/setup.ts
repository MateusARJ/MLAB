import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock global de WebRTC e APIs do navegador para testes no ambiente jsdom
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  // @ts-ignore
  window.HTMLMediaElement.prototype.pause = vi.fn();

  // @ts-ignore
  globalThis.MediaStream = class MockMediaStream {
    getTracks() { return []; }
    getVideoTracks() { return []; }
    getAudioTracks() { return []; }
  };
}
