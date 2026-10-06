"""Seed data for hospital packages."""

from __future__ import annotations

from uuid import UUID

from medikiosk.domain.contracts.package import HospitalPackage, PackageCategory

SEED_PACKAGES = [
    HospitalPackage(
        package_id=UUID("44444444-4444-4444-4444-444444444444"),
        title="Healthy Heart Check",
        category=PackageCategory.CARDIAC,
        description="Comprehensive cardiac screening.",
        inclusions=["ECG", "Lipid Profile", "Troponin-T", "Cardiologist Review"],
        price_inr=1499.0,
        department="Cardiology",
        is_active=True,
    ),
    HospitalPackage(
        package_id=UUID("55555555-5555-5555-5555-555555555555"),
        title="Ayush Rasayana & Metabolic",
        category=PackageCategory.AYUSH_HOLISTIC,
        description="Holistic Ayurvedic assessment and metabolic screening.",
        inclusions=[
            "Dashavidha Pariksha",
            "Prakriti assessment",
            "HbA1c",
            "LFT",
            "Ayurvedic consultation",
        ],
        price_inr=1199.0,
        department="AYUSH",
        is_active=True,
    ),
    HospitalPackage(
        package_id=UUID("66666666-6666-6666-6666-666666666666"),
        title="Senior Citizen Wellness 360",
        category=PackageCategory.SENIOR_WELLNESS,
        description="Full body checkup for senior citizens.",
        inclusions=["CBC", "Renal Panel", "Bone Mineral Density", "Physician review"],
        target_age_min=60,
        price_inr=2499.0,
        department="General Medicine",
        is_active=True,
    ),
    HospitalPackage(
        package_id=UUID("77777777-7777-7777-7777-777777777777"),
        title="Fever & Dengue Panel",
        category=PackageCategory.ACUTE_FEVER,
        description="Rapid testing for acute fever.",
        inclusions=["Dengue NS1", "Rapid Malaria", "CBC with Platelet Count"],
        target_symptoms=["fever", "chills", "body ache"],
        price_inr=850.0,
        department="General Medicine",
        is_active=True,
    ),
]
