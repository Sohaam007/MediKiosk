# ADR 0004: Add AYUSH Code Systems to Contracts

## Status
Accepted

## Context
Wave 6 introduces the clinical core, specifically the `AYUSH & NAMASTE Terminology Mapper` (`DOM-2`). This mapper needs to output standardized `MedicalEntity` contracts mapping traditional Ayurvedic clinical entities to standardized codes.
The current `CodeSystem` enum in `domain/contracts` only supports western/allopathic code systems (`SNOMED_CT`, `ICD10`, `LOINC`, `ATC`) and `NONE`. 
To support Ayurvedic terms, we need to map them to `NAMASTE` (National Ayush Morbidity and Standardized Terminologies Electronic Portal) and `ICD11_TM` (ICD-11 Traditional Medicine Module II).

## Decision
We will widen the `CodeSystem` enum in `domain/contracts/entities.py` by adding two new members:
- `NAMASTE = "namaste"`
- `ICD11_TM = "icd11_tm"`

## Consequences
- `AYUSHMapper` can now accurately classify entities.
- Consumers of `MedicalEntity` objects downstream (like `SummaryService` or `FHIRService`) will need to handle or ignore these new `CodeSystem` values, which should not cause breakage as they are serialized as standard string enums.
- The change is strictly additive to the enum and doesn't modify the shape of the frozen `MedicalEntity` Pydantic model itself.
