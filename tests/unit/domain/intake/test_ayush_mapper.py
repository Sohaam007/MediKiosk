import uuid

from medikiosk.domain.contracts import CodeSystem, EntityType
from medikiosk.domain.intake.ayush_mapper import AYUSHMapper


def test_ayush_mapper_maps_namaste():
    entity = AYUSHMapper.map_term("Mandagni", uuid.uuid4())
    assert entity.code_system == CodeSystem.NAMASTE
    assert entity.code == "N-AG-03"
    assert entity.normalized_name == "Mandagni"
    assert entity.entity_type == EntityType.SYMPTOM


def test_ayush_mapper_maps_icd11():
    entity = AYUSHMapper.map_term("Vata-Pitta Prakriti", uuid.uuid4(), prefer_icd11=True)
    assert entity.code_system == CodeSystem.ICD11_TM
    assert entity.code == "SA07"
    assert entity.normalized_name == "Vata-Pitta Prakriti"
    assert entity.entity_type == EntityType.SYMPTOM


def test_ayush_mapper_case_insensitivity():
    entity = AYUSHMapper.map_term(" kRura koSHtha ", uuid.uuid4())
    assert entity.code_system == CodeSystem.NAMASTE
    assert entity.code == "N-KO-01"
    assert entity.normalized_name == "Krura Koshtha"


def test_ayush_mapper_unmapped_fallback():
    entity = AYUSHMapper.map_term("Unknown Ayush Term", uuid.uuid4())
    assert entity.code_system == CodeSystem.NONE
    assert entity.code is None
    assert entity.normalized_name == "Unknown Ayush Term"
    assert entity.entity_type == EntityType.SYMPTOM
