/**
 * Utilitário de correção de metadados EBML para vídeos WebM gerados via MediaRecorder.
 *
 * O MediaRecorder do Chromium/Electron gera arquivos WebM sem a tag de duração (Duration)
 * no bloco Info do EBML, pois é projetado para live streaming. Isso causa erro de reprodução
 * em diversos players (Windows Media Player, WhatsApp, QuickTime) e impede a barra de progresso (seeking).
 *
 * Este script localiza o bloco Info no cabeçalho EBML e injeta o elemento Duration com valor Float64.
 */

// Lê um identificador de elemento EBML ou tamanho VINT
function readVint(
  buffer: Uint8Array,
  start: number
): { length: number; value: number } | null {
  if (start >= buffer.length) return null;
  const firstByte = buffer[start];
  let mask = 0x80;
  let length = 1;

  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }

  if (length > 8) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    if (start + i >= buffer.length) return null;
    value = (value << 8) | buffer[start + i];
  }

  return { length, value };
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return await blob.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }
  if (typeof Response !== 'undefined') {
    return await new Response(blob).arrayBuffer();
  }
  throw new Error('Ambiente não suporta conversão de Blob para ArrayBuffer');
}

/**
 * Injeta ou atualiza a duração real no cabeçalho EBML do WebM.
 * @param blob Blob original retornado pelo MediaRecorder
 * @param durationMs Duração real da gravação em milissegundos
 * @returns Novo Blob com os metadados corrigidos
 */
export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0) return blob;

  try {
    const arrayBuffer = await blobToArrayBuffer(blob);
    const bytes = new Uint8Array(arrayBuffer);

    // Valida assinatura EBML (0x1A 0x45 0xDF 0xA3)
    if (
      bytes[0] !== 0x1a ||
      bytes[1] !== 0x45 ||
      bytes[2] !== 0xdf ||
      bytes[3] !== 0xa3
    ) {
      return blob;
    }

    let pos = 4;
    const ebmlHeaderSize = readVint(bytes, pos);
    if (!ebmlHeaderSize) return blob;
    pos += ebmlHeaderSize.length + ebmlHeaderSize.value;

    // Busca elemento Segment (0x18 0x53 0x80 0x67)
    let segmentPos = -1;
    while (pos < bytes.length - 4) {
      if (
        bytes[pos] === 0x18 &&
        bytes[pos + 1] === 0x53 &&
        bytes[pos + 2] === 0x80 &&
        bytes[pos + 3] === 0x67
      ) {
        segmentPos = pos;
        break;
      }
      pos++;
    }

    if (segmentPos === -1) return blob;

    pos = segmentPos + 4;
    const segmentSize = readVint(bytes, pos);
    if (!segmentSize) return blob;
    pos += segmentSize.length;

    // Busca elemento Info (0x15 0x49 0xA9 0x66) dentro do Segment
    let infoPos = -1;
    let infoContentPos = -1;
    let infoSize = 0;
    let infoSizeVintLength = 0;

    const maxSearch = Math.min(bytes.length, pos + 2048);
    while (pos < maxSearch - 4) {
      if (
        bytes[pos] === 0x15 &&
        bytes[pos + 1] === 0x49 &&
        bytes[pos + 2] === 0xa9 &&
        bytes[pos + 3] === 0x66
      ) {
        infoPos = pos;
        const sizeInfo = readVint(bytes, pos + 4);
        if (sizeInfo) {
          infoSize = sizeInfo.value;
          infoSizeVintLength = sizeInfo.length;
          infoContentPos = pos + 4 + sizeInfo.length;
        }
        break;
      }
      pos++;
    }

    if (infoPos === -1 || infoContentPos === -1) return blob;

    // Procura TimecodeScale (0x2A 0xD7 0xB1) dentro de Info
    let timecodeScale = 1000000; // Padrão WebM: 1ms (1.000.000 ns)
    let durationPos = -1;
    let durationValPos = -1;
    let durationValSize = 0;

    const infoEnd = infoContentPos + infoSize;
    let p = infoContentPos;

    while (p < infoEnd - 2) {
      // TimecodeScale: 0x2A 0xD7 0xB1
      if (bytes[p] === 0x2a && bytes[p + 1] === 0xd7 && bytes[p + 2] === 0xb1) {
        const vSize = readVint(bytes, p + 3);
        if (vSize) {
          let scaleVal = 0;
          for (let i = 0; i < vSize.value; i++) {
            scaleVal = (scaleVal << 8) | bytes[p + 3 + vSize.length + i];
          }
          if (scaleVal > 0) timecodeScale = scaleVal;
          p += 3 + vSize.length + vSize.value;
          continue;
        }
      }

      // Duration: 0x44 0x89
      if (bytes[p] === 0x44 && bytes[p + 1] === 0x89) {
        durationPos = p;
        const dSize = readVint(bytes, p + 2);
        if (dSize) {
          durationValPos = p + 2 + dSize.length;
          durationValSize = dSize.value;
        }
        break;
      }

      p++;
    }

    // A duração no WebM é representada em unidades de TimecodeScale
    // (durationMs * 1_000_000 ns) / timecodeScale = durationUnits
    const durationUnits = (durationMs * 1000000) / timecodeScale;

    // Caso 1: O elemento Duration já existe no bloco Info -> apenas sobrescreve
    if (durationPos !== -1 && durationValPos !== -1) {
      const dataView = new DataView(arrayBuffer);
      if (durationValSize === 4) {
        dataView.setFloat32(durationValPos, durationUnits, false);
      } else if (durationValSize === 8) {
        dataView.setFloat64(durationValPos, durationUnits, false);
      }
      return new Blob([dataView.buffer], { type: 'video/webm' });
    }

    // Caso 2: O elemento Duration não existe no bloco Info -> injeta novo elemento Duration
    // ID do Duration: 0x44 0x89
    // Tamanho VINT de 8 bytes (Float64): 0x88
    // Valor Float64: 8 bytes
    // Total a ser inserido: 11 bytes
    const durationElement = new Uint8Array(11);
    durationElement[0] = 0x44;
    durationElement[1] = 0x89;
    durationElement[2] = 0x88; // VINT length=1, valor 8 (0x80 | 8)
    const dv = new DataView(durationElement.buffer);
    dv.setFloat64(3, durationUnits, false);

    // Constrói o novo buffer inserindo o durationElement no início do conteúdo de Info
    const beforeInfoContent = bytes.slice(0, infoContentPos);
    const afterInfoContent = bytes.slice(infoContentPos);

    // Atualiza o tamanho do bloco Info
    const newInfoSize = infoSize + 11;
    const vintStart = infoPos + 4;
    if (infoSizeVintLength === 1 && newInfoSize < 127) {
      beforeInfoContent[vintStart] = 0x80 | newInfoSize;
    } else if (infoSizeVintLength === 2 && newInfoSize < 16383) {
      beforeInfoContent[vintStart] = 0x40 | (newInfoSize >> 8);
      beforeInfoContent[vintStart + 1] = newInfoSize & 0xff;
    } else if (infoSizeVintLength === 4 && newInfoSize < 268435455) {
      beforeInfoContent[vintStart] = 0x10 | (newInfoSize >> 24);
      beforeInfoContent[vintStart + 1] = (newInfoSize >> 16) & 0xff;
      beforeInfoContent[vintStart + 2] = (newInfoSize >> 8) & 0xff;
      beforeInfoContent[vintStart + 3] = newInfoSize & 0xff;
    }

    const merged = new Uint8Array(
      beforeInfoContent.length + durationElement.length + afterInfoContent.length
    );
    merged.set(beforeInfoContent, 0);
    merged.set(durationElement, beforeInfoContent.length);
    merged.set(afterInfoContent, beforeInfoContent.length + durationElement.length);

    return new Blob([merged], { type: 'video/webm' });
  } catch (err) {
    console.warn('Falha ao injetar duração no WebM:', err);
    return blob;
  }
}
