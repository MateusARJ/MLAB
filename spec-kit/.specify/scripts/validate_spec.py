#!/usr/bin/env python3
"""Valida gates mínimos de uma feature do MLab."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REQUIRED = ["spec.md", "clarify.md", "plan.md", "tasks.md", "analyze.md"]


def fail(msg: str) -> int:
    print(f"FAIL: {msg}")
    return 1


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: npm run spec:check -- spec-kit/specs/<feature>")
        return 2

    feature = Path(sys.argv[1])
    if not feature.is_dir():
        return fail(f"feature directory não existe: {feature}")

    for name in REQUIRED:
        if not (feature / name).is_file():
            return fail(f"artefato obrigatório ausente: {name}")

    spec = (feature / "spec.md").read_text(encoding="utf-8")
    plan = (feature / "plan.md").read_text(encoding="utf-8")
    tasks = (feature / "tasks.md").read_text(encoding="utf-8")
    analyze = (feature / "analyze.md").read_text(encoding="utf-8")
    checklist = feature / "checklist.md"
    if not checklist.exists():
        checklist = feature / "checklists" / "requirements.md"
    if not checklist.exists():
        return fail("checklist obrigatória ausente (checklist.md ou checklists/requirements.md)")
    checklist_text = checklist.read_text(encoding="utf-8")

    if "## Scope Lock" not in plan:
        return fail("plan.md não possui '## Scope Lock'")
    for heading in ["### IN", "### OUT", "### Allowed Paths", "### Prohibited Paths", "### Dependencies", "### Non-Goals"]:
        if heading not in plan:
            return fail(f"Scope Lock incompleto: {heading}")

    if "Status: PASS" not in analyze:
        return fail("analyze.md não está em Status: PASS")
    if "APPROVED" not in checklist_text:
        return fail("checklist não contém resultado APPROVED")

    for path in (feature / "clarify.md", feature / "plan.md", feature / "tasks.md"):
        text = path.read_text(encoding="utf-8")
        if "NEEDS CLARIFICATION" in text:
            return fail(f"há 'NEEDS CLARIFICATION' em documento fechado: {path.name}")

    # Cabeçalho de tarefa: "### T" + 3 ou mais dígitos + letra minúscula opcional (T101, T101a, T1101).
    # Um "### T<dígito>" fora desse padrão falha, para nenhuma tarefa escapar do gate em silêncio.
    for match in re.finditer(r"(?m)^###\s+(T\d\S*)", tasks):
        token = match.group(1)
        if not re.match(r"T\d{3,}[a-z]?\b", token):
            return fail(f"cabeçalho de tarefa fora do padrão T<3+ dígitos>[letra]: {token}")

    # Cada bloco de tarefa deve declarar Allowed/Prohibited Paths.
    # Os blocos vão de um cabeçalho de tarefa até o próximo cabeçalho de nível 2 ou 3.
    for match in re.finditer(r"(?ms)^###\s+(T\d{3,}[a-z]?)\b(.*?)(?=^##\s|^###\s|\Z)", tasks):
        tid, block = match.group(1), match.group(2)
        if "Allowed Paths:" not in block or "Prohibited Paths:" not in block:
            return fail(f"tarefa {tid} sem Allowed Paths/Prohibited Paths")

    print(f"PASS: {feature}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
