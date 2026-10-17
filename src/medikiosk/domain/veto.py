"""Veto Engine domain re-exports.

Provides backward-compatible domain import path for VetoEngine and VetoRule.
"""

from __future__ import annotations

from medikiosk.domain.triage.veto_engine import VetoEngine, VetoRule

__all__ = ["VetoEngine", "VetoRule"]
