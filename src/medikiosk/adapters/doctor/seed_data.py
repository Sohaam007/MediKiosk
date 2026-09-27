"""Seed data for doctors."""

from __future__ import annotations

from uuid import UUID

from medikiosk.domain.contracts.doctor import (
    DoctorAvailabilityStatus,
    DoctorProfile,
    DoctorSeniorityTier,
)

SEED_DOCTORS = [
    DoctorProfile(
        doctor_id=UUID("11111111-1111-1111-1111-111111111111"),
        full_name="Dr. Devi Shetty",
        degrees=["MBBS", "MS", "FRCS"],
        department="Cardiology",
        sub_speciality="Cardiac Surgeon",
        clinical_interests=["Heart Failure", "Arrhythmia"],
        experience_years=34,
        languages=["en", "hi", "kn", "bn"],
        seniority_tier=DoctorSeniorityTier.CHAIRMAN,
        rating=4.9,
        review_count=2410,
        consultation_fee_inr=1500.0,
        registration_fee_inr=150.0,
        followup_free_days=7,
        pmjay_accepted=True,
        tpa_insurers_accepted=["Star Health"],
        chamber_room="Room 102, Heart Center",
        availability_status=DoctorAvailabilityStatus.AVAILABLE,
        opd_start_time="09:00",
        opd_end_time="17:00",
    ),
    DoctorProfile(
        doctor_id=UUID("22222222-2222-2222-2222-222222222222"),
        full_name="Dr. Rahul Verma",
        degrees=["MBBS", "MD"],
        department="General Medicine",
        clinical_interests=["Diabetes", "Hypertension"],
        experience_years=12,
        languages=["en", "hi"],
        seniority_tier=DoctorSeniorityTier.CONSULTANT,
        rating=4.7,
        review_count=850,
        consultation_fee_inr=800.0,
        registration_fee_inr=100.0,
        pmjay_accepted=True,
        tpa_insurers_accepted=[],
        chamber_room="Room 205, Block A",
        availability_status=DoctorAvailabilityStatus.AVAILABLE,
    ),
    DoctorProfile(
        doctor_id=UUID("33333333-3333-3333-3333-333333333333"),
        full_name="Vaidya Anjali Joshi",
        degrees=["BAMS", "MD (Ayurveda)"],
        department="AYUSH",
        clinical_interests=["Prakriti Analysis", "Lifestyle Disorders"],
        experience_years=15,
        languages=["en", "hi", "mr"],
        seniority_tier=DoctorSeniorityTier.SENIOR_CONSULTANT,
        rating=4.8,
        review_count=1200,
        consultation_fee_inr=600.0,
        registration_fee_inr=50.0,
        pmjay_accepted=False,
        chamber_room="Room 501, Wellness Center",
        availability_status=DoctorAvailabilityStatus.IN_CONSULTATION,
    ),
]
