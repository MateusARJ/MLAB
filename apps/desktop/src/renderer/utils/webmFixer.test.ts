import { describe, it, expect } from 'vitest';
import { fixWebmDuration, blobToArrayBuffer } from './webmFixer';

describe('fixWebmDuration', () => {
  it('returns original blob if durationMs is 0 or negative', async () => {
    const fakeBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/webm' });
    const result = await fixWebmDuration(fakeBlob, 0);
    expect(result).toBe(fakeBlob);

    const resultNeg = await fixWebmDuration(fakeBlob, -100);
    expect(resultNeg).toBe(fakeBlob);
  });

  it('returns original blob if EBML header magic bytes are missing', async () => {
    const invalidBlob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])], { type: 'video/webm' });
    const result = await fixWebmDuration(invalidBlob, 5000);
    const bytes = new Uint8Array(await blobToArrayBuffer(result));
    expect(bytes[0]).toBe(0x00);
  });

  it('injects Duration element into Info segment when absent', async () => {
    const header = [
      0x1a, 0x45, 0xdf, 0xa3, // EBML ID
      0x81,                   // VINT size = 1
      0x00,                   // 1 byte content
    ];

    const segmentHeader = [
      0x18, 0x53, 0x80, 0x67, // Segment ID
      0x8a,                   // VINT size = 10
    ];

    const infoElement = [
      0x15, 0x49, 0xa9, 0x66, // Info ID
      0x84,                   // VINT size = 4 (length = 1, value = 4)
      0xaa, 0xbb, 0xcc, 0xdd  // 4 bytes existing info content
    ];

    const raw = new Uint8Array([...header, ...segmentHeader, ...infoElement]);
    const blob = new Blob([raw], { type: 'video/webm' });

    // Inject 10,000 ms (10 seconds)
    const fixed = await fixWebmDuration(blob, 10000);
    const fixedBytes = new Uint8Array(await blobToArrayBuffer(fixed));

    // Should be larger by 11 bytes (Duration element: 2 bytes ID + 1 byte VINT size + 8 bytes float64)
    expect(fixedBytes.length).toBe(raw.length + 11);

    // Find Info element in fixedBytes
    let infoIdx = -1;
    for (let i = 0; i < fixedBytes.length - 4; i++) {
      if (
        fixedBytes[i] === 0x15 &&
        fixedBytes[i + 1] === 0x49 &&
        fixedBytes[i + 2] === 0xa9 &&
        fixedBytes[i + 3] === 0x66
      ) {
        infoIdx = i;
        break;
      }
    }
    expect(infoIdx).toBeGreaterThan(-1);

    // Info size should now be 4 + 11 = 15 (0x8F)
    expect(fixedBytes[infoIdx + 4]).toBe(0x8f);

    // First element inside Info should now be Duration: 0x44 0x89
    expect(fixedBytes[infoIdx + 5]).toBe(0x44);
    expect(fixedBytes[infoIdx + 6]).toBe(0x89);
    expect(fixedBytes[infoIdx + 7]).toBe(0x88); // 8 bytes

    // Read Float64 duration value
    const view = new DataView(fixedBytes.buffer, fixedBytes.byteOffset + infoIdx + 8, 8);
    const durationUnits = view.getFloat64(0, false);
    // Standard timecodeScale is 1,000,000 ns -> 10,000 ms = 10,000 units
    expect(durationUnits).toBe(10000);
  });

  it('overwrites existing Duration element if already present', async () => {
    const header = [
      0x1a, 0x45, 0xdf, 0xa3,
      0x81,
      0x00,
    ];

    const segmentHeader = [
      0x18, 0x53, 0x80, 0x67,
      0x8d,
    ];

    const durationElem = [
      0x44, 0x89, 0x88,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // 0.0
    ];

    const infoElement = [
      0x15, 0x49, 0xa9, 0x66,
      0x8b, // 11 bytes content
      ...durationElem
    ];

    const raw = new Uint8Array([...header, ...segmentHeader, ...infoElement]);
    const blob = new Blob([raw], { type: 'video/webm' });

    // Update to 45,000 ms
    const fixed = await fixWebmDuration(blob, 45000);
    const fixedBytes = new Uint8Array(await blobToArrayBuffer(fixed));

    // Length should remain unchanged
    expect(fixedBytes.length).toBe(raw.length);

    // Locate Duration float
    const dv = new DataView(fixedBytes.buffer);
    let durOffset = -1;
    for (let i = 0; i < fixedBytes.length - 3; i++) {
      if (fixedBytes[i] === 0x44 && fixedBytes[i + 1] === 0x89 && fixedBytes[i + 2] === 0x88) {
        durOffset = i + 3;
        break;
      }
    }
    expect(durOffset).toBeGreaterThan(-1);
    expect(dv.getFloat64(durOffset, false)).toBe(45000);
  });
});
