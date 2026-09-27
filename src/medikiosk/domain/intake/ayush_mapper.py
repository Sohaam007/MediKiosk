"""AYUSH and NAMASTE Terminology Mapper.

Deterministically maps traditional Ayurvedic clinical entities to standardized
CodeSystem.NAMASTE and CodeSystem.ICD11_TM codes.
"""

import uuid
from typing import Any, ClassVar

from medikiosk.domain.contracts import CodeSystem, EntityType, MedicalEntity


class AYUSHMapper:
    """Deterministic mapper for Ayurvedic clinical concepts."""

    _MAPPINGS: ClassVar[dict[str, dict[str, Any]]] = {
        "mishamagni": {"namaste": "N-AG-01", "icd11_tm": "SA01", "type": EntityType.SYMPTOM},
        "tikshnagni": {"namaste": "N-AG-02", "icd11_tm": "SA02", "type": EntityType.SYMPTOM},
        "mandagni": {"namaste": "N-AG-03", "icd11_tm": "SA03", "type": EntityType.SYMPTOM},
        "samagni": {"namaste": "N-AG-04", "icd11_tm": "SA04", "type": EntityType.SYMPTOM},
        "krura koshtha": {"namaste": "N-KO-01", "icd11_tm": "SA05", "type": EntityType.SYMPTOM},
        "mridu koshtha": {"namaste": "N-KO-02", "icd11_tm": "SA06", "type": EntityType.SYMPTOM},
        "vata-pitta prakriti": {
            "namaste": "N-PR-01",
            "icd11_tm": "SA07",
            "type": EntityType.SYMPTOM,
        },
    }

    @staticmethod
    def map_term(term: str, entity_id: uuid.UUID, prefer_icd11: bool = False) -> MedicalEntity:
        """Map a clinical term to an Ayurvedic standardized code.

        Args:
            term: The term to map.
            entity_id: The UUID to use for the returned entity.
            prefer_icd11: If True, uses ICD11_TM as the code system. Defaults to NAMASTE.

        Returns:
            A frozen MedicalEntity contract populated with the mapped data,
            or a fallback entity with CodeSystem.NONE if unmapped.
        """
        normalized_term = term.strip().lower()
        mapping = AYUSHMapper._MAPPINGS.get(normalized_term)

        if mapping:
            code_system = CodeSystem.ICD11_TM if prefer_icd11 else CodeSystem.NAMASTE
            code = mapping["icd11_tm"] if prefer_icd11 else mapping["namaste"]
            entity_type = mapping["type"]
            normalized_name = normalized_term.title()
        else:
            code_system = CodeSystem.NONE
            code = None
            entity_type = EntityType.SYMPTOM
            normalized_name = term.strip()

        # EntityType is a string Enum in the contract.
        return MedicalEntity(
            entity_id=entity_id,
            entity_type=entity_type,
            text=term.strip(),
            normalized_name=normalized_name,
            code_system=code_system,
            code=code,
        )
