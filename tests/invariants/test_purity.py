"""
Purity invariant test.

Scans every Python file in src/medikiosk/domain/ and asserts that none of them
import forbidden modules or call forbidden functions. The domain layer must be
pure: no I/O, no network, no time, no randomness, no filesystem.

This test is the enforcement mechanism for ARCHITECTURE.md Rule #2.
"""

import ast
from pathlib import Path

import pytest

DOMAIN_ROOT = Path(__file__).resolve().parents[2] / "src" / "medikiosk" / "domain"

# Modules that domain/ must NEVER import
FORBIDDEN_IMPORTS = frozenset(
    {
        "os",
        "sys",
        "socket",
        "requests",
        "httpx",
        "urllib",
        "pathlib",
        "subprocess",
        "shutil",
        "tempfile",
        "sqlite3",
        "sqlalchemy",
        "asyncpg",
        "aiosqlite",
        "redis",
        "celery",
        "structlog",
        "logging",
        "google.generativeai",
        "openai",
        "fastapi",
        "uvicorn",
    }
)

# Function calls that domain/ must NEVER make
FORBIDDEN_CALLS = frozenset(
    {
        "open",
        "print",
    }
)

# Attribute accesses that domain/ must NEVER use
FORBIDDEN_ATTRIBUTES = frozenset(
    {
        "datetime.now",
        "datetime.utcnow",
        "date.today",
        "time.time",
        "time.sleep",
        "random.random",
        "random.randint",
        "random.choice",
        "uuid.uuid4",
        "os.environ",
        "os.getenv",
    }
)


def _collect_python_files(root: Path) -> list[Path]:
    """Recursively collect all .py files under root."""
    return sorted(root.rglob("*.py"))


def _check_file(filepath: Path) -> list[str]:
    """Check a single file for purity violations. Returns list of violation strings."""
    violations: list[str] = []
    source = filepath.read_text(encoding="utf-8")

    if not source.strip():
        return violations

    try:
        tree = ast.parse(source, filename=str(filepath))
    except SyntaxError:
        violations.append(f"{filepath}: SyntaxError — cannot parse")
        return violations

    relative = filepath.relative_to(DOMAIN_ROOT.parent.parent.parent)

    for node in ast.walk(tree):
        # Check imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                top_module = alias.name.split(".")[0]
                if alias.name in FORBIDDEN_IMPORTS or top_module in FORBIDDEN_IMPORTS:
                    violations.append(
                        f"{relative}:{node.lineno} imports forbidden module '{alias.name}'"
                    )

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                top_module = node.module.split(".")[0]
                if node.module in FORBIDDEN_IMPORTS or top_module in FORBIDDEN_IMPORTS:
                    violations.append(
                        f"{relative}:{node.lineno} imports from forbidden module '{node.module}'"
                    )
                # Check for imports from outer layers
                if node.module.startswith("medikiosk.adapters"):
                    violations.append(
                        f"{relative}:{node.lineno} domain imports from adapters "
                        f"('{node.module}') — dependency rule violation"
                    )
                if node.module.startswith("medikiosk.services"):
                    violations.append(
                        f"{relative}:{node.lineno} domain imports from services "
                        f"('{node.module}') — dependency rule violation"
                    )
                if node.module.startswith("medikiosk.api"):
                    violations.append(
                        f"{relative}:{node.lineno} domain imports from api "
                        f"('{node.module}') — dependency rule violation"
                    )

        # Check forbidden function calls
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                if node.func.id in FORBIDDEN_CALLS:
                    violations.append(
                        f"{relative}:{node.lineno} calls forbidden function '{node.func.id}()'"
                    )

        # Check forbidden attribute access
        elif isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Attribute):
                full_attr = f"{node.value.attr}.{node.attr}"
                if full_attr in FORBIDDEN_ATTRIBUTES:
                    violations.append(
                        f"{relative}:{node.lineno} accesses forbidden attribute '{full_attr}'"
                    )
            elif isinstance(node.value, ast.Name):
                full_attr = f"{node.value.id}.{node.attr}"
                if full_attr in FORBIDDEN_ATTRIBUTES:
                    violations.append(
                        f"{relative}:{node.lineno} accesses forbidden attribute '{full_attr}'"
                    )

    return violations


@pytest.mark.invariant
def test_domain_purity() -> None:
    """Assert that src/medikiosk/domain/ contains no I/O, network, or side effects."""
    if not DOMAIN_ROOT.exists():
        pytest.skip("src/medikiosk/domain/ does not exist yet")

    py_files = _collect_python_files(DOMAIN_ROOT)
    if not py_files:
        pytest.skip("No Python files found in domain/")

    all_violations: list[str] = []
    for filepath in py_files:
        all_violations.extend(_check_file(filepath))

    if all_violations:
        report = "\n".join(f"  • {v}" for v in all_violations)
        pytest.fail(
            f"Domain purity violations found ({len(all_violations)} total):\n{report}\n\n"
            f"The domain layer must be pure. See docs/ARCHITECTURE.md Rule #2."
        )
