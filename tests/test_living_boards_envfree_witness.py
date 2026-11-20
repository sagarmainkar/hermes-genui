# Review-environment witness: the real-Chrome / real-store-door invariants run as a SELF-CONTAINED
# stdlib script (tests/living_boards_envfree_witness.py) so an independent reviewer can reproduce
# them with NOTHING installed but the system python3 (it re-execs a 3.11+ it finds), Chrome and
# web/node_modules:
#
#     python3 tests/living_boards_envfree_witness.py     # exit 0 PASS / 1 FAIL / 3 SKIP (no deps)
#
# This pytest test runs the very same script, so CI and the reviewer execute byte-identical evidence.
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent / "living_boards_envfree_witness.py"


def test_envfree_living_witness_real_chrome_real_door():
    proc = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True, timeout=1200)
    if proc.returncode == 3:
        pytest.skip(f"env-free witness unavailable: {proc.stdout.strip()[:300]}")
    assert proc.returncode == 0, f"env-free witness FAILED:\n{proc.stdout}\n{proc.stderr[-1500:]}"
    out = proc.stdout
    for label in ("address update-in-place history", "links reach-back",
                  "calculator first-headless-update", "form first-headless-update",
                  "tabs first-headless-update", "misfire guard"):
        assert f"PASS {label}" in out, f"{label} missing from witness output:\n{out}"
    assert "WITNESS RESULT: PASS" in out
