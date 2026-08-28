from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Float
)
from sqlalchemy.orm import relationship
from .database import Base

# Roles used across the app
ROLE_ADMIN = "admin"
ROLE_ENTERPRISE = "enterprise"
ROLE_INSTITUTE = "institute"
ROLE_JOBSEEKER = "jobseeker"
ROLE_MANAGER = "manager"          # admin-created staff user with limited powers

# Application status values (job seeker sees these on "Applied Jobs")
APPLICATION_STATUSES = [
    "Applied", "Under Review", "Shortlisted",
    "Interview - Phase 1", "Interview - Phase 2", "Interview - Phase 3",
    "Managerial Round", "Offered", "Hired", "On Hold", "Rejected",
]
# Statuses that mean the candidate is still in play (used for pipeline filters).
ACTIVE_STATUSES = [s for s in APPLICATION_STATUSES if s not in ("Rejected", "Hired")]

# Profile types drive which resume sections and strength checks apply (item 1).
PROFILE_TYPES = ["professional", "worker"]

# Accounts that sign up themselves need admin approval before they go live.
APPROVAL_STATUSES = ["pending", "approved", "rejected"]

# Prices are in USD. `price` is the headline amount shown in the UI.
SUBSCRIPTION_PLANS = [
    {"key": "free",     "name": "Free",     "price": 0,   "currency": "USD", "days": 30,
     "job_limit": 3,   "resume_views": 25,   "tagline": "Try it out",
     "features": ["3 job posts", "25 resume views", "Basic support"]},
    {"key": "starter",  "name": "Starter",  "price": 100, "currency": "USD", "days": 30,
     "job_limit": 25,  "resume_views": 500,  "tagline": "For small teams",
     "features": ["25 job posts", "500 resume views", "AI job descriptions", "Email support"]},
    {"key": "growth",   "name": "Growth",   "price": 200, "currency": "USD", "days": 90,
     "job_limit": 100, "resume_views": 2500, "tagline": "Most popular",
     "features": ["100 job posts", "2,500 resume views", "All AI features",
                  "Banner promotions", "Priority support"]},
    {"key": "unlimited","name": "Unlimited","price": 500, "currency": "USD", "days": 365,
     "job_limit": 0,   "resume_views": 0,    "tagline": "For high-volume hiring",
     "features": ["Unlimited job posts", "Unlimited resume views", "All AI features",
                  "Featured banners", "Dedicated account manager"]},
]


class User(Base):
    """Central auth record. email doubles as the username (per user stories)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin | enterprise | institute | jobseeker
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)  # true when system-generated
    created_at = Column(DateTime, default=datetime.utcnow)

    # Chat presence & privacy settings
    last_seen_at = Column(DateTime)
    show_last_seen = Column(Boolean, default=True)
    show_online_status = Column(Boolean, default=True)
    show_read_receipts = Column(Boolean, default=True)

    # Institute/Enterprise/JobSeeker each have TWO FKs to users (owner + approver),
    # so the owner side must be named explicitly.
    institute = relationship("Institute", back_populates="user", uselist=False,
                             foreign_keys="Institute.user_id")
    enterprise = relationship("Enterprise", back_populates="user", uselist=False,
                              foreign_keys="Enterprise.user_id")
    jobseeker = relationship("JobSeeker", back_populates="user", uselist=False,
                             foreign_keys="JobSeeker.user_id")


class Institute(Base):
    __tablename__ = "institutes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)

    name = Column(String, nullable=False)
    logo_url = Column(String)
    address1 = Column(String)
    address2 = Column(String)
    city = Column(String)
    district = Column(String)
    state = Column(String)
    country = Column(String, default="INDIA")
    phone = Column(String)
    email = Column(String)
    promoter_name = Column(String)
    authorised_person_name = Column(String)
    authorised_person_phone = Column(String)
    authorised_person_email = Column(String)
    designation = Column(String)
    courses = Column(JSON, default=list)        # ["B.Tech", "Diploma", ...]
    present_strength = Column(Integer)
    about = Column(Text)
    website = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Self-registered institutes wait for admin approval
    approval_status = Column(String, default="approved")
    approved_at = Column(DateTime)
    approved_by = Column(Integer, ForeignKey("users.id"))
    rejection_reason = Column(Text)
    registration_source = Column(String, default="admin")   # admin | self

    user = relationship("User", back_populates="institute", foreign_keys=[user_id])
    jobseekers = relationship("JobSeeker", back_populates="institute")


class Enterprise(Base):
    __tablename__ = "enterprises"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)

    name = Column(String, nullable=False)
    logo_url = Column(String)
    address1 = Column(String)
    address2 = Column(String)
    city = Column(String)
    district = Column(String)
    state = Column(String)
    country = Column(String, default="INDIA")
    phone = Column(String)
    email = Column(String)
    promoter_name = Column(String)
    authorised_person_name = Column(String)
    designation = Column(String)
    about = Column(Text)
    gst_no = Column(String)   # for credential authenticity check (user story remark)
    pan_no = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    approval_status = Column(String, default="approved")
    approved_at = Column(DateTime)
    approved_by = Column(Integer, ForeignKey("users.id"))
    rejection_reason = Column(Text)
    registration_source = Column(String, default="admin")

    user = relationship("User", back_populates="enterprise", foreign_keys=[user_id])
    jobs = relationship("Job", back_populates="enterprise")


class JobSeeker(Base):
    """Holds the resume/profile. Created either by an institute upload, admin, or self-registration."""
    __tablename__ = "jobseekers"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True)

    # --- Personal ---
    first_name = Column(String)
    last_name = Column(String)
    dob = Column(String)          # kept as string for simple Excel ingestion
    gender = Column(String)
    phone = Column(String)
    email = Column(String)
    location = Column(String)
    city = Column(String)
    state = Column(String)
    profile_picture_url = Column(String)

    # --- Resume content ---
    career_objective = Column(Text)
    key_skills = Column(JSON, default=list)     # ["Python", "AutoCAD", ...]
    education = Column(JSON, default=list)       # [{level, degree, branch, institute, location, year_of_passing, percentage}]
    experience = Column(JSON, default=list)      # [{company, role, years, description}]
    certifications = Column(JSON, default=list)
    languages = Column(JSON, default=list)
    additional_info = Column(Text)               # free text the seeker adds later
    projects = Column(JSON, default=list)        # [{title, description, tech, link}]
    achievements = Column(JSON, default=list)
    profile_type = Column(String, default="professional")  # professional | worker
    headline = Column(String)                    # e.g. "Mechanical Engineer | CAD"
    total_experience = Column(String)            # e.g. "2 years"
    expected_salary = Column(String)
    preferred_locations = Column(JSON, default=list)
    notice_period = Column(String)
    availability = Column(String)                # Immediate / 15 days / ...
    linkedin_url = Column(String)
    portfolio_url = Column(String)

    approval_status = Column(String, default="approved")
    approved_at = Column(DateTime)
    approved_by = Column(Integer, ForeignKey("users.id"))
    registration_source = Column(String, default="institute")  # institute | admin | self
    resume_template = Column(String, default="classic")  # classic | modern | compact

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="jobseeker", foreign_keys=[user_id])
    institute = relationship("Institute", back_populates="jobseekers")
    applications = relationship("Application", back_populates="jobseeker")
    profile_views = relationship("ProfileView", back_populates="jobseeker")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True)
    enterprise_id = Column(Integer, ForeignKey("enterprises.id"), nullable=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True)  # institutes can post too
    posted_by_user_id = Column(Integer, ForeignKey("users.id"))

    job_code = Column(String)          # e.g. HR/001
    title = Column(String, nullable=False)
    category = Column(String)          # Engineering / HR / Finance ...
    location = Column(String)
    no_of_positions = Column(Integer, default=1)
    description = Column(Text)
    requirement_education = Column(Text)
    requirement_technical = Column(Text)
    experience = Column(String)
    salary = Column(String)
    key_skills = Column(JSON, default=list)

    recruiter_name = Column(String)
    recruiter_phone = Column(String)
    recruiter_email = Column(String)
    contact_visible = Column(Boolean, default=True)  # recruiter can hide contact details

    status = Column(String, default="active")        # active | closed
    created_at = Column(DateTime, default=datetime.utcnow)

    # Full-market fields (covers daily wage through postgraduate roles)
    sector = Column(String)                 # job_taxonomy sector key
    job_type = Column(String, default="full_time")   # full_time | daily | contract | ...
    wage_basis = Column(String, default="monthly")   # daily | monthly | annual | ...
    wage_min = Column(String)
    wage_max = Column(String)
    education_level = Column(String)        # none | 10th | iti | graduate | ...
    is_urgent = Column(Boolean, default=False)
    accommodation = Column(Boolean, default=False)   # common for hotel/domestic/farm roles
    food_provided = Column(Boolean, default=False)
    shift = Column(String)                  # Day / Night / Rotational
    gender_preference = Column(String)      # kept only where legally allowed (e.g. female caretaker)
    vacancies_filled = Column(Integer, default=0)

    enterprise = relationship("Enterprise", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    jobseeker_id = Column(Integer, ForeignKey("jobseekers.id"), nullable=False)

    status = Column(String, default="Applied")   # see APPLICATION_STATUSES
    applied_on = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    jobseeker = relationship("JobSeeker", back_populates="applications")


class ProfileView(Base):
    """Recorded when a recruiter/institute views or downloads a job seeker's profile.
    Powers the 'Recruiter Views' page for the job seeker."""
    __tablename__ = "profile_views"

    id = Column(Integer, primary_key=True)
    jobseeker_id = Column(Integer, ForeignKey("jobseekers.id"), nullable=False)
    viewer_user_id = Column(Integer, ForeignKey("users.id"))

    company_name = Column(String)
    location = Column(String)
    recruiter_name = Column(String)
    contact_phone = Column(String)
    contact_email = Column(String)
    action = Column(String, default="Viewed")   # Viewed | Downloaded
    viewed_at = Column(DateTime, default=datetime.utcnow)     # most recent view
    first_viewed_at = Column(DateTime, default=datetime.utcnow)
    view_count = Column(Integer, default=1)

    jobseeker = relationship("JobSeeker", back_populates="profile_views")


class Message(Base):
    """Direct message between a job seeker and a recruiter (enterprise)."""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Block(Base):
    """A recruiter (or seeker) blocking another user from messaging them."""
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True)
    blocker_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blocked_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class BannerSlot(Base):
    """Registry of page slots.

    Each distinct page gets a stable, sequential index the first time it asks for
    a banner. Sequential indexes let us round-robin banners across pages, which
    guarantees neighbouring pages show *different* advertisers — a hash alone
    collides and repeats.
    """
    __tablename__ = "banner_slots"

    id = Column(Integer, primary_key=True)
    slot = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class BannerEvent(Base):
    """Daily impression/click totals per banner, used for trend charts.

    Aggregated per day rather than one row per event, so the table stays small
    even at high traffic.
    """
    __tablename__ = "banner_events"

    id = Column(Integer, primary_key=True)
    banner_id = Column(Integer, ForeignKey("banners.id"), nullable=False, index=True)
    day = Column(String, nullable=False, index=True)      # YYYY-MM-DD
    slot = Column(String)                                  # which page it was shown on
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)


class UploadBatch(Base):
    """Audit trail for institute Excel uploads — captures when data was uploaded."""
    __tablename__ = "upload_batches"

    id = Column(Integer, primary_key=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=False, index=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    total_rows = Column(Integer, default=0)
    created_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    notes = Column(Text)


class Subscription(Base):
    """Paid plan for an enterprise or institute account."""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan = Column(String, default="free")
    status = Column(String, default="active")        # active | expired | cancelled
    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    amount = Column(Integer, default=0)
    jobs_posted = Column(Integer, default=0)
    resume_views_used = Column(Integer, default=0)
    auto_renew = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailLog(Base):
    """Every outgoing email attempt and its real outcome.

    Without this, a failed send is invisible: the app reports success and the
    recipient simply never receives anything.
    """
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True)
    to_email = Column(String, index=True)
    subject = Column(String)
    kind = Column(String)                    # credentials | reset | alert | test | other
    status = Column(String, default="sent")  # sent | failed | console
    error = Column(Text)
    provider = Column(String)                # smtp host used
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """In-app notification. kind: application | view | message | job | system"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, default="system")
    title = Column(String, nullable=False)
    body = Column(Text)
    link = Column(String)            # in-app route to open
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SavedJob(Base):
    """Job bookmarked by a seeker."""
    __tablename__ = "saved_jobs"

    id = Column(Integer, primary_key=True)
    jobseeker_id = Column(Integer, ForeignKey("jobseekers.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    """Short-lived token emailed to a user who forgot their password."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Banner(Base):
    """Promotional media shown across the platform.

    Supports image / GIF / video / audio, and can be targeted at job seekers so it
    appears on every job-seeker page (item 4).
    """
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True)
    posted_by_user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    company_name = Column(String)
    logo_url = Column(String)
    image_url = Column(String)
    text_content = Column(Text)
    start_date = Column(String)
    end_date = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    media_type = Column(String, default="image")   # image | gif | video | audio | none
    media_url = Column(String)
    poster_url = Column(String)                    # still frame for video
    cta_label = Column(String)
    cta_link = Column(String)
    audience = Column(String, default="jobseekers")  # jobseekers | recruiters | all
    theme = Column(String, default="navy")
    autoplay = Column(Boolean, default=True)
    muted = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
