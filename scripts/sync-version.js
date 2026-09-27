const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const desktopPkgPath = path.join(rootDir, 'apps/desktop/package.json');
const rootPkgPath = path.join(rootDir, 'package.json');

try {
  const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

  rootPkg.version = desktopPkg.version;
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');

  console.log(`[sync-version] Versão sincronizada com sucesso: ${desktopPkg.version}`);
} catch (err) {
  console.error('[sync-version] Erro ao sincronizar versões:', err);
  process.exit(1);
}
