"""
Consent chokepoint invariant test.

Scans every Python file in src/medikiosk/adapters/ for outbound HTTP calls
that could carry patient data, and asserts that ONLY the ABDM push module
is allowed to make such calls.

This test enforces ARCHITECTURE.md Rule #4:
"Consent before any data egress. The consent chokepoint is architectural, not procedural."
"""

import ast
from pathlib import Path

import pytest

ADAPTERS_ROOT = Path(__file__).resolve().parents[2] / "src" / "medikiosk" / "adapters"

# The ONLY file allowed to make outbound HTTP requests with patient data
ALLOWED_EGRESS_FILE = "abdm/fhir_push.py"

# Patterns that indicate outbound HTTP calls
HTTP_CALL_PATTERNS = frozenset(
    {
        "httpx.post",
        "httpx.put",
        "httpx.patch",
        "httpx.AsyncClient",
        "requests.post",
        "requests.put",
        "requests.patch",
        "requests.Session",
        "urllib.request.urlopen",
    }
)


def _check_file_for_http_egress(filepath: Path) -> list[str]:
    """Check if a file contains HTTP client calls that could carry patient data."""
    source = filepath.read_text(encoding="utf-8")
    if not source.strip():
        return []

    violations: list[str] = []
    relative = filepath.relative_to(ADAPTERS_ROOT)
    relative_str = str(relative).replace("\\", "/")

    # Skip the allowed egress file
    if relative_str == ALLOWED_EGRESS_FILE:
        return []

    # Skip __init__.py and config files
    if filepath.name in {"__init__.py", "config.py"}:
        return []

    # Check for httpx/requests imports that suggest outbound calls
    try:
        tree = ast.parse(source, filename=str(filepath))
    except SyntaxError:
        return []

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            if node.module in {"httpx", "requests", "urllib.request"}:
                # Check if any imported names suggest POST/PUT (data-sending methods)
                if node.names:
                    for alias in node.names:
                        if alias.name in {"post", "put", "patch", "AsyncClient", "Session"}:
                            violations.append(
                                f"adapters/{relative_str}:{node.lineno} imports HTTP client "
                                f"'{node.module}.{alias.name}' — only "
                                f"adapters/{ALLOWED_EGRESS_FILE} may make outbound data requests"
                            )

        # Check for direct HTTP method calls
        if isinstance(node, ast.Call):
            call_str = ast.dump(node.func)
            if any(pattern.split(".")[-1] in call_str for pattern in HTTP_CALL_PATTERNS):
                # This is a heuristic — it catches common patterns
                if "post" in call_str.lower() or "put" in call_str.lower():
                    violations.append(
                        f"adapters/{relative_str}:{node.lineno} makes outbound HTTP call — "
                        f"only adapters/{ALLOWED_EGRESS_FILE} may send patient data"
                    )

    return violations


@pytest.mark.invariant
def test_consent_chokepoint() -> None:
    """Assert that only the ABDM push module can make outbound HTTP requests with patient data."""
    if not ADAPTERS_ROOT.exists():
        pytest.skip("src/medikiosk/adapters/ does not exist yet")

    all_violations: list[str] = []
    for py_file in sorted(ADAPTERS_ROOT.rglob("*.py")):
        all_violations.extend(_check_file_for_http_egress(py_file))

    if all_violations:
        report = "\n".join(f"  • {v}" for v in all_violations)
        pytest.fail(
            f"Consent chokepoint violations ({len(all_violations)} total):\n{report}\n\n"
            f"Patient data may only leave the system through adapters/{ALLOWED_EGRESS_FILE}.\n"
            f"See docs/ARCHITECTURE.md 'The consent chokepoint'."
        )
