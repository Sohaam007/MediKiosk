"""SQLAlchemy ORM models for MediKiosk.

All models use SQLAlchemy 2.0 mapped_column style with Mapped[] annotations.
Models are mutable (for SQLAlchemy). Domain contracts are frozen Pydantic models.
Conversion happens in the repository layer.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all MediKiosk ORM models."""

    pass


class SessionModel(Base):
    """ORM model for SessionState domain contract."""

    __tablename__ = "sessions"

    session_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default")
    department_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="general")
    patient_language: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    consent_status: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    intake_progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    informant_type: Mapped[str] = mapped_column(String(20), default="patient", nullable=False)
    informant_relationship: Mapped[str | None] = mapped_column(String(200), nullable=True)
    token_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    chamber_room: Mapped[str | None] = mapped_column(String(50), nullable=True)
    billing_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    total_fees_inr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    selected_doctor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    selected_package_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    predicted_wait_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    audit_events: Mapped[list[AuditEventModel]] = relationship(
        "AuditEventModel",
        back_populates="session",
        primaryjoin="SessionModel.session_id == AuditEventModel.session_id",
        foreign_keys="[AuditEventModel.session_id]",
        cascade="save-update, merge",
        passive_deletes=True,
    )
    documents: Mapped[list[DocumentModel]] = relationship(
        "DocumentModel", back_populates="session", cascade="all, delete-orphan"
    )
    consent_records: Mapped[list[ConsentModel]] = relationship(
        "ConsentModel", back_populates="session", cascade="all, delete-orphan"
    )


class AuditEventModel(Base):
    """ORM model for AuditEvent. Append-only — never UPDATE or DELETE."""

    __tablename__ = "audit_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[SessionModel | None] = relationship(
        "SessionModel",
        back_populates="audit_events",
        primaryjoin="SessionModel.session_id == AuditEventModel.session_id",
        foreign_keys="[AuditEventModel.session_id]",
    )


class DocumentModel(Base):
    """ORM model for DocumentScan domain contract."""

    __tablename__ = "documents"

    scan_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)
    image_ref: Mapped[str] = mapped_column(String(500), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    session: Mapped[SessionModel] = relationship("SessionModel", back_populates="documents")


class ConsentModel(Base):
    """ORM model for ConsentRecord. Records are never updated after creation."""

    __tablename__ = "consent_records"

    consent_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purpose: Mapped[str] = mapped_column(String(40), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consent_text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    verification_method: Mapped[str] = mapped_column(String(20), nullable=False)

    session: Mapped[SessionModel] = relationship("SessionModel", back_populates="consent_records")


class SummaryModel(Base):
    """ORM model for ClinicalSummary domain contract."""

    __tablename__ = "summaries"

    summary_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    sections: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False)

    session: Mapped[SessionModel] = relationship("SessionModel")


class FHIRBundleModel(Base):
    """ORM model for FHIRBundle domain contract."""

    __tablename__ = "fhir_bundles"

    bundle_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    bundle_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    resource_count: Mapped[int] = mapped_column(Integer, nullable=False)
    validation_passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    validation_errors: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_transcript_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    session: Mapped[SessionModel] = relationship("SessionModel")
