#!/usr/bin/env python3
"""Testes do validador de gates (validate_spec.py), feature 019-validador-ids-tarefa.

Uso (a partir da raiz do repositório):
    py -m unittest discover -s spec-kit/.specify/scripts -p "test_*.py"
"""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import validate_spec  # noqa: E402

PLAN = """# Plan

## Scope Lock

### IN
### OUT
### Allowed Paths
### Prohibited Paths
### Dependencies
### Non-Goals
"""

PATHS = "Allowed Paths: `a/**`\nProhibited Paths: `b/**`\n"


def task(header: str, with_paths: bool = True) -> str:
    return f"### {header}\n[ ] tarefa\n{PATHS if with_paths else ''}\n"


class ValidateSpecTaskIdsTest(unittest.TestCase):
    def run_validator(self, tasks: str) -> tuple[int, str]:
        with tempfile.TemporaryDirectory() as tmp:
            feature = Path(tmp)
            files = {
                "spec.md": "# Spec\n",
                "clarify.md": "# Clarify\n",
                "plan.md": PLAN,
                "tasks.md": "# Tasks\n\n" + tasks,
                "analyze.md": "Status: PASS\n",
                "checklist.md": "APPROVED\n",
            }
            for name, text in files.items():
                (feature / name).write_text(text, encoding="utf-8")

            out = io.StringIO()
            argv = sys.argv
            sys.argv = ["validate_spec.py", str(feature)]
            try:
                with contextlib.redirect_stdout(out):
                    code = validate_spec.main()
            finally:
                sys.argv = argv
            return code, out.getvalue()

    # RF-191
    def test_four_digit_task_without_paths_fails(self) -> None:
        code, out = self.run_validator(task("T1101 — x", with_paths=False) + task("T101 — y"))
        self.assertEqual(code, 1, out)
        self.assertIn("T1101", out)

    def test_four_digit_task_with_paths_passes(self) -> None:
        code, out = self.run_validator(task("T1101 — x") + task("T1102 — y"))
        self.assertEqual(code, 0, out)

    def test_three_digit_tasks_with_paths_pass(self) -> None:
        code, out = self.run_validator(task("T101 — x") + task("T101a — y"))
        self.assertEqual(code, 0, out)

    def test_three_digit_task_without_paths_fails(self) -> None:
        code, out = self.run_validator(task("T101 — x", with_paths=False))
        self.assertEqual(code, 1, out)
        self.assertIn("T101", out)

    # RF-192
    def test_two_digit_header_fails(self) -> None:
        code, out = self.run_validator(task("T12 — x"))
        self.assertEqual(code, 1, out)
        self.assertIn("T12", out)

    def test_header_with_two_letters_fails(self) -> None:
        code, out = self.run_validator(task("T101ab — x"))
        self.assertEqual(code, 1, out)
        self.assertIn("T101ab", out)

    def test_non_task_header_starting_with_t_is_ignored(self) -> None:
        code, out = self.run_validator(task("Testes manuais", with_paths=False) + task("T101 — x"))
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
