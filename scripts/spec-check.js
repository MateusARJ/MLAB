#!/usr/bin/env node
/**
 * Executa o validador de gates do Spec Kit (spec-kit/.specify/scripts/validate_spec.py).
 *
 * Uso:
 *   npm run spec:check                              -> valida todas as features em spec-kit/specs/
 *   npm run spec:check -- spec-kit/specs/<feature>  -> valida uma feature
 *
 * Requer Python 3.10+ (tenta `py`, `python3` e `python`, nesta ordem).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const validator = path.join(root, 'spec-kit', '.specify', 'scripts', 'validate_spec.py');
const specsDir = path.join(root, 'spec-kit', 'specs');

function findPython() {
  for (const cmd of ['py', 'python3', 'python']) {
    const probe = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0 && /Python 3\./.test(`${probe.stdout}${probe.stderr}`)) return cmd;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error('spec:check: Python 3.10+ não encontrado (tentado: py, python3, python).');
  process.exit(2);
}

let features = process.argv.slice(2);
if (features.length === 0) {
  features = fs
    .readdirSync(specsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(specsDir, d.name));
}

let failed = 0;
for (const feature of features) {
  const result = spawnSync(python, [validator, feature], { stdio: 'inherit' });
  if (result.status !== 0) failed++;
}
process.exit(failed === 0 ? 0 : 1);
