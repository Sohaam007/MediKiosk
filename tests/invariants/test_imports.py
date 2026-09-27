"""
Import graph invariant test.

Enforces the dependency rule from ARCHITECTURE.md:
  domain/ → nothing (only stdlib + pydantic)
  ports/  → domain/ only
  services/ → domain/, ports/ only
  adapters/ → domain/, ports/ only (implements ports)
  api/    → services/, domain/ contracts, schemas only

No layer may import from a layer that is at its own level or above it.

COMPOSITION ROOT EXCEPTION:
  api/dependencies/container.py is the designated Composition Root — the single
  file responsible for wiring Settings → Engines → Repositories → Services.
  It is the ONLY api/ file allowed to import from adapters/. All other api/
  files must follow the strict dependency rule. This is an intentional,
  documented exception following the Clean Architecture Composition Root pattern.
  api/app.py is also permitted as the application factory that bootstraps the
  startup sequence (table creation, CORS from settings).
"""

import ast
from pathlib import Path

import pytest

SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "medikiosk"

# Define allowed import prefixes for each layer
LAYER_RULES: dict[str, set[str]] = {
    "domain": set(),  # domain can only import from itself and stdlib/pydantic
    "ports": {"medikiosk.domain"},
    "services": {"medikiosk.domain", "medikiosk.ports"},
    "adapters": {"medikiosk.domain", "medikiosk.ports"},
    "api": {"medikiosk.domain", "medikiosk.ports", "medikiosk.services", "medikiosk.api"},
}

# All internal package prefixes
ALL_INTERNAL = frozenset(
    {
        "medikiosk.domain",
        "medikiosk.ports",
        "medikiosk.services",
        "medikiosk.adapters",
        "medikiosk.api",
    }
)

# Composition Root exception: the ONLY api/ files allowed to import from adapters/.
# These are the infrastructure wiring boundaries. All other api/ files are forbidden.
# This exception is narrow and intentional — see docs/ARCHITECTURE.md §Services.
#   - container.py: DI wiring (Settings→Engine→Repos→Services)
#   - app.py: application factory (CORS from settings, startup hook)
#   - auth.py: JWT secret retrieval from Settings (security boundary)
COMPOSITION_ROOT_FILES: frozenset[str] = frozenset(
    {
        str(Path("api") / "dependencies" / "container.py"),
        str(Path("api") / "app.py"),
        str(Path("api") / "dependencies" / "auth.py"),
    }
)


def _get_layer(filepath: Path) -> str | None:
    """Determine which architectural layer a file belongs to."""
    try:
        rel = filepath.relative_to(SRC_ROOT)
    except ValueError:
        return None
    parts = rel.parts
    if len(parts) >= 1 and parts[0] in LAYER_RULES:
        return parts[0]
    return None


def _extract_imports(filepath: Path) -> list[tuple[int, str]]:
    """Extract all import module names from a Python file."""
    source = filepath.read_text(encoding="utf-8")
    if not source.strip():
        return []
    try:
        tree = ast.parse(source, filename=str(filepath))
    except SyntaxError:
        return []

    imports: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append((node.lineno, alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append((node.lineno, node.module))
    return imports


@pytest.mark.invariant
def test_import_graph() -> None:
    """Assert that the import graph follows the architectural dependency rule."""
    if not SRC_ROOT.exists():
        pytest.skip("src/medikiosk/ does not exist yet")

    violations: list[str] = []

    for py_file in sorted(SRC_ROOT.rglob("*.py")):
        layer = _get_layer(py_file)
        if layer is None:
            continue

        # Skip composition root files — they are the infrastructure wiring boundary
        # and are explicitly permitted to import from adapters/ (see COMPOSITION_ROOT_FILES).
        rel_to_src = py_file.relative_to(SRC_ROOT)
        if str(rel_to_src) in COMPOSITION_ROOT_FILES:
            continue

        allowed = LAYER_RULES[layer]
        relative = py_file.relative_to(SRC_ROOT.parent.parent)

        for lineno, module_name in _extract_imports(py_file):
            # Only check internal imports (medikiosk.*)
            if not module_name.startswith("medikiosk."):
                continue

            # Check if this import is allowed for this layer
            is_allowed = False

            # A layer can always import from itself
            if module_name.startswith(f"medikiosk.{layer}"):
                is_allowed = True
            else:
                for allowed_prefix in allowed:
                    if module_name.startswith(allowed_prefix):
                        is_allowed = True
                        break

            if not is_allowed:
                violations.append(
                    f"{relative}:{lineno} — {layer}/ imports '{module_name}' "
                    f"(allowed: {sorted(allowed) or 'nothing external'})"
                )

    if violations:
        report = "\n".join(f"  • {v}" for v in violations)
        pytest.fail(
            f"Import graph violations found ({len(violations)} total):\n{report}\n\n"
            f"See docs/ARCHITECTURE.md 'The dependency rule'."
        )
