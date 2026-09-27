from uuid import uuid4

from medikiosk.domain.contracts.doctor import (
    DoctorAvailabilityStatus,
    DoctorProfile,
    DoctorSeniorityTier,
)
from medikiosk.domain.contracts.package import HospitalPackage, PackageCategory


def test_doctor_profile_valid():
    """Test successful creation of DoctorProfile contract."""
    doctor = DoctorProfile(
        doctor_id=uuid4(),
        full_name="Dr. Test User",
        degrees=["MBBS", "MD"],
        experience_years=15,
        seniority_tier=DoctorSeniorityTier.SENIOR_CONSULTANT,
        department="Cardiology",
        sub_speciality="Heart Failure",
        languages=["English", "Hindi"],
        consultation_fee_inr=1000.0,
        rating=4.8,
        review_count=120,
        availability_status=DoctorAvailabilityStatus.AVAILABLE,
    )
    assert doctor.full_name == "Dr. Test User"
    assert doctor.seniority_tier == DoctorSeniorityTier.SENIOR_CONSULTANT
    assert "Hindi" in doctor.languages


def test_hospital_package_valid():
    """Test successful creation of HospitalPackage contract."""
    package = HospitalPackage(
        package_id=uuid4(),
        title="Comprehensive Heart Check",
        category=PackageCategory.CARDIAC,
        description="Full heart screening.",
        inclusions=["ECG", "TMT", "Echo"],
        price_inr=2500.0,
        department="Cardiology",
        is_active=True,
    )
    assert package.title == "Comprehensive Heart Check"
    assert package.category == PackageCategory.CARDIAC
    assert len(package.inclusions) == 3
