#!/usr/bin/env python3
"""Valida gates mínimos de uma feature do ScreenShare Classroom."""
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
        print("uso: python .specify/scripts/validate_spec.py specs/001-feature")
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

    # Cada bloco de tarefa deve declarar Allowed/Prohibited Paths.
    task_ids = re.findall(r"^\s*-?\s*\[.?\]\s*(T\d{3})\b|^\s*(T\d{3})\b", tasks, re.M)
    normalized = [a or b for a, b in task_ids]
    if normalized:
        for tid in normalized:
            match = re.search(rf"(?ms)^.*?{tid}\b.*?(?=^.*T\d{{3}}\b|\Z)", tasks)
            block = match.group(0) if match else ""
            if "Allowed Paths:" not in block or "Prohibited Paths:" not in block:
                return fail(f"tarefa {tid} sem Allowed Paths/Prohibited Paths")

    print(f"PASS: {feature}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
