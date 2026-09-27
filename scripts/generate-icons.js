const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const resourcesDir = path.join(rootDir, 'apps/desktop/resources');
const srcPng = path.join(resourcesDir, 'icon-dark.png');
const tempDir = path.join(resourcesDir, '_temp_ico');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const sizes = [16, 32, 48, 64, 128, 256];

// Gera cada resolução usando PowerShell System.Drawing
const psCommands = sizes.map(s => {
  const outPath = path.join(tempDir, `${s}.png`).replace(/\\/g, '/');
  const inPath = srcPng.replace(/\\/g, '/');
  return `
    $src = [System.Drawing.Bitmap]::FromFile('${inPath}');
    $dest = New-Object System.Drawing.Bitmap ${s}, ${s};
    $g = [System.Drawing.Graphics]::FromImage($dest);
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;
    $g.Clear([System.Drawing.Color]::Black);
    $g.DrawImage($src, 0, 0, ${s}, ${s});
    $dest.Save('${outPath}', [System.Drawing.Imaging.ImageFormat]::Png);
    $g.Dispose();
    $dest.Dispose();
    $src.Dispose();
  `;
}).join('\n');

const psFile = path.join(tempDir, 'gen.ps1');
fs.writeFileSync(psFile, `Add-Type -AssemblyName System.Drawing;\n${psCommands}`);

console.log('Executando redimensionamento das camadas ICO...');
execSync(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, { stdio: 'inherit' });

// Lê os PNGs gerados
const pngBuffers = sizes.map(s => fs.readFileSync(path.join(tempDir, `${s}.png`)));

// Monta o arquivo ICO binário
const headerLen = 6 + sizes.length * 16;
let currentOffset = headerLen;
const dirEntries = [];

for (let i = 0; i < sizes.length; i++) {
  const size = sizes[i];
  const buf = pngBuffers[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height (0 = 256)
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(buf.length, 8); // image size in bytes
  entry.writeUInt32LE(currentOffset, 12); // image offset in file
  dirEntries.push(entry);
  currentOffset += buf.length;
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type 1 = ICO
header.writeUInt16LE(sizes.length, 4); // count of images

const icoBuffer = Buffer.concat([header, ...dirEntries, ...pngBuffers]);

// Salva em icon-dark.ico e icon.ico
const darkIcoPath = path.join(resourcesDir, 'icon-dark.ico');
const defaultIcoPath = path.join(resourcesDir, 'icon.ico');
const defaultPngPath = path.join(resourcesDir, 'icon.png');

fs.writeFileSync(darkIcoPath, icoBuffer);
fs.writeFileSync(defaultIcoPath, icoBuffer);
fs.copyFileSync(srcPng, defaultPngPath);

// Limpeza
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Sucesso: icon-dark.ico, icon.ico e icon.png atualizados com 6 resoluções e fundo preto!');
