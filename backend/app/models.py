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

# Prices are in INR. `price` is the headline amount shown in the UI.
#
# job_limit / ad_limit / resume_views: 0 means UNLIMITED.
# ad_validity_minutes: how long a posted ad stays live before it auto-expires.
# The free Standard plan is deliberately tight (5 jobs, 1 ad, 5-minute ad) so
# the upgrade path is exercised early.
SUBSCRIPTION_PLANS = [
    {"key": "standard", "name": "Standard", "price": 0, "currency": "INR", "days": 30,
     "job_limit": 5, "ad_limit": 1, "ad_validity_minutes": 5, "resume_views": 25,
     "tagline": "Free forever",
     "features": ["5 job posts", "1 advertisement", "5-minute ad validity",
                  "25 resume views", "Basic support"]},
    {"key": "starter", "name": "Starter", "price": 2999, "currency": "INR", "days": 30,
     "job_limit": 25, "ad_limit": 5, "ad_validity_minutes": 60 * 24 * 7, "resume_views": 500,
     "tagline": "For small teams",
     "features": ["25 job posts", "5 advertisements", "7-day ad validity",
                  "500 resume views", "AI job descriptions", "Email support"]},
    {"key": "growth", "name": "Growth", "price": 7999, "currency": "INR", "days": 90,
     "job_limit": 100, "ad_limit": 20, "ad_validity_minutes": 60 * 24 * 30, "resume_views": 2500,
     "tagline": "Most popular",
     "features": ["100 job posts", "20 advertisements", "30-day ad validity",
                  "2,500 resume views", "All AI features", "Banner promotions",
                  "Priority support"]},
    {"key": "unlimited", "name": "Unlimited", "price": 19999, "currency": "INR", "days": 365,
     "job_limit": 0, "ad_limit": 0, "ad_validity_minutes": 60 * 24 * 90, "resume_views": 0,
     "tagline": "For high-volume hiring",
     "features": ["Unlimited job posts", "Unlimited advertisements", "90-day ad validity",
                  "Unlimited resume views", "All AI features", "Featured banners",
                  "Dedicated account manager"]},
]

DEFAULT_PLAN = "standard"



class User(Base):
    """Central auth record. email doubles as the username (per user stories)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin | enterprise | institute | jobseeker
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)  # true when system-generated
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

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
    email = Column(String, index=True)
    promoter_name = Column(String)
    authorised_person_name = Column(String)
    authorised_person_phone = Column(String)
    authorised_person_email = Column(String)
    designation = Column(String)
    courses = Column(JSON, default=list)        # ["B.Tech", "Diploma", ...]
    present_strength = Column(Integer)
    # Registration asks for capacity and strength as two separate numbers.
    # `present_strength` is kept as the legacy name for the same idea and is
    # mirrored from current_strength on save, so nothing that already reads it
    # (bulk-upload capacity checks, admin reports) breaks.
    total_capacity = Column(Integer)            # seats across every course
    current_strength = Column(Integer)          # students on the rolls today
    pincode = Column(String)
    about = Column(Text)
    website = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Self-registered institutes wait for admin approval
    approval_status = Column(String, default="approved", index=True)
    approved_at = Column(DateTime)
    approved_by = Column(Integer, ForeignKey("users.id"), index=True)
    rejection_reason = Column(Text)
    registration_source = Column(String, default="admin")   # admin | self

    user = relationship("User", back_populates="institute", foreign_keys=[user_id])
    jobseekers = relationship("JobSeeker", back_populates="institute")
    locations = relationship("InstituteLocation", back_populates="institute",
                             cascade="all, delete-orphan")
    course_rows = relationship("InstituteCourse", back_populates="institute",
                               cascade="all, delete-orphan")


class InstituteLocation(Base):
    """A campus / branch of an institute.

    The institute's own address stays on `institutes` and is exposed as the
    PRIMARY location (is_primary=True), created automatically the first time
    locations are read. Additional campuses are rows here, each with its own
    contact person and pincode, and each carrying its own copy of the course
    list — seats and strength differ per campus even when the courses match.
    """
    __tablename__ = "institute_locations"

    id = Column(Integer, primary_key=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=False, index=True)
    name = Column(String)                       # e.g. "Kukatpally campus"
    address1 = Column(String)
    address2 = Column(String)
    city = Column(String)
    district = Column(String)
    state = Column(String)
    country = Column(String, default="INDIA")
    pincode = Column(String, index=True)
    contact_person = Column(String)
    contact_email = Column(String)
    contact_phone = Column(String)
    is_primary = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    institute = relationship("Institute", back_populates="locations")
    course_rows = relationship("InstituteCourse", back_populates="location",
                               cascade="all, delete-orphan")


class InstituteCourse(Base):
    """One course at one location, with its seat capacity and current strength.

    Stored as rows rather than inside Institute.courses (a JSON list of names)
    because the dashboard reports course-wise capacity and course-wise strength,
    and a list of strings cannot carry numbers. Institute.courses is still
    maintained as the flat name list so existing filters keep working.
    """
    __tablename__ = "institute_courses"

    id = Column(Integer, primary_key=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("institute_locations.id"), index=True)
    name = Column(String, nullable=False)
    seats = Column(Integer, default=0)              # max seats for this course
    # NO default. SQLAlchemy applies a column default whenever the value is
    # None at insert time, so `default=0` quietly turned "not answered yet"
    # into "zero students" — and requirement 43 needs those to be different.
    current_strength = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    institute = relationship("Institute", back_populates="course_rows")
    location = relationship("InstituteLocation", back_populates="course_rows")


class InstituteDownloadLog(Base):
    """Every file an institute downloads from the portal, with date and time.

    Separate from UploadBatch: that records data coming IN, this records the
    templates and reports going OUT, which the Data upload screen lists as
    "Download history".
    """
    __tablename__ = "institute_downloads"

    id = Column(Integer, primary_key=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    kind = Column(String, default="template")     # template | students | history
    filename = Column(String)
    file_format = Column(String, default="xlsx")  # xlsx | csv
    downloaded_at = Column(DateTime, default=datetime.utcnow, index=True)


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
    email = Column(String, index=True)
    promoter_name = Column(String)
    authorised_person_name = Column(String)
    designation = Column(String)
    about = Column(Text)
    website = Column(String)  # captured at registration; added by sync_schema()
    gst_no = Column(String)   # for credential authenticity check (user story remark)
    pan_no = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    approval_status = Column(String, default="approved", index=True)
    approved_at = Column(DateTime)
    approved_by = Column(Integer, ForeignKey("users.id"), index=True)
    rejection_reason = Column(Text)
    registration_source = Column(String, default="admin")

    user = relationship("User", back_populates="enterprise", foreign_keys=[user_id])
    jobs = relationship("Job", back_populates="enterprise")


class JobSeeker(Base):
    """Holds the resume/profile. Created either by an institute upload, admin, or self-registration."""
    __tablename__ = "jobseekers"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True, index=True)

    # --- Personal ---
    first_name = Column(String)
    last_name = Column(String)
    dob = Column(String)          # kept as string for simple Excel ingestion
    gender = Column(String)
    phone = Column(String)
    email = Column(String, index=True)
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

    approval_status = Column(String, default="approved", index=True)
    approved_at = Column(DateTime)
    approved_by = Column(Integer, ForeignKey("users.id"), index=True)
    registration_source = Column(String, default="institute")  # institute | admin | self
    resume_template = Column(String, default="classic")  # classic | modern | compact
    # A resume the seeker uploaded themselves. Kept ALONGSIDE the generated
    # one rather than replacing it: recruiters search on the structured
    # profile fields, and a PDF is opaque to that search. The seeker chooses
    # which one recruiters see by default.
    uploaded_resume_url = Column(String)
    uploaded_resume_name = Column(String)
    prefer_uploaded_resume = Column(Boolean, default=False)
    # Extra sections the seeker attaches to an UPLOADED resume. The uploaded
    # file itself is never modified — a PDF's bytes can't be edited safely, and
    # rewriting someone's document without them seeing the result would be
    # worse than not offering it. These render after the file and print with it.
    resume_additions = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="jobseeker", foreign_keys=[user_id])
    institute = relationship("Institute", back_populates="jobseekers")
    applications = relationship("Application", back_populates="jobseeker")
    profile_views = relationship("ProfileView", back_populates="jobseeker")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True)
    enterprise_id = Column(Integer, ForeignKey("enterprises.id"), nullable=True, index=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True, index=True)  # institutes can post too
    posted_by_user_id = Column(Integer, ForeignKey("users.id"), index=True)

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

    status = Column(String, default="active", index=True)        # active | closed
    # A posting runs for at most JOB_MAX_VALIDITY_DAYS and then stops appearing
    # in search. Stored rather than computed so an admin can shorten a specific
    # posting without touching the global cap.
    expires_at = Column(DateTime, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

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
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    jobseeker_id = Column(Integer, ForeignKey("jobseekers.id"), nullable=False, index=True)

    status = Column(String, default="Applied", index=True)   # see APPLICATION_STATUSES
    applied_on = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    jobseeker = relationship("JobSeeker", back_populates="applications")


class ProfileView(Base):
    """Recorded when a recruiter/institute views or downloads a job seeker's profile.
    Powers the 'Recruiter Views' page for the job seeker."""
    __tablename__ = "profile_views"

    id = Column(Integer, primary_key=True)
    jobseeker_id = Column(Integer, ForeignKey("jobseekers.id"), nullable=False, index=True)
    viewer_user_id = Column(Integer, ForeignKey("users.id"), index=True)

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
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Block(Base):
    """A recruiter (or seeker) blocking another user from messaging them."""
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True)
    blocker_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    blocked_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


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
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


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
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), index=True)
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
    plan = Column(String, default=DEFAULT_PLAN)
    ads_posted = Column(Integer, default=0)
    status = Column(String, default="active", index=True)        # active | expired | cancelled
    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    amount = Column(Integer, default=0)
    jobs_posted = Column(Integer, default=0)
    resume_views_used = Column(Integer, default=0)
    auto_renew = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class MediaAsset(Base):
    """Every uploaded image, with who owns it and what it's for.

    Keeping a row per file (rather than only a URL string on the profile) means
    you can list, audit and clean up storage, show a user their upload history,
    and swap the storage backend without losing track of what exists.
    """
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, default="avatar")      # avatar | logo | banner | document
    url = Column(String, nullable=False)
    original_filename = Column(String)
    content_type = Column(String)
    original_bytes = Column(Integer)
    stored_bytes = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    storage = Column(String, default="local")    # local | supabase
    is_active = Column(Boolean, default=True)    # false once replaced
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class OtpCode(Base):
    """One-time codes for mobile / email verification at registration.

    Codes are stored hashed, expire quickly, and are rate-limited per target so
    the endpoint can't be used to spam someone's phone or run up an SMS bill.
    """
    __tablename__ = "otp_codes"

    id = Column(Integer, primary_key=True)
    target = Column(String, index=True, nullable=False)   # phone number or email
    channel = Column(String, default="sms")               # sms | email
    code_hash = Column(String, nullable=False)
    purpose = Column(String, default="register")
    attempts = Column(Integer, default=0)
    verified = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


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
    status = Column(String, default="sent", index=True)  # sent | failed | console
    error = Column(Text)
    provider = Column(String)                # smtp host used
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


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
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class SavedJob(Base):
    """Job bookmarked by a seeker."""
    __tablename__ = "saved_jobs"

    id = Column(Integer, primary_key=True)
    jobseeker_id = Column(Integer, ForeignKey("jobseekers.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class PasswordResetToken(Base):
    """Short-lived token emailed to a user who forgot their password."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Banner(Base):
    """Promotional media shown across the platform.

    Supports image / GIF / video / audio, and can be targeted at job seekers so it
    appears on every job-seeker page (item 4).
    """
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True)
    posted_by_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    title = Column(String)
    company_name = Column(String)
    logo_url = Column(String)
    image_url = Column(String)
    text_content = Column(Text)
    start_date = Column(String)
    end_date = Column(String)
    status = Column(String, default="active", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Institute ads come in exactly two shapes, chosen by a button on Post a Ad:
    #   flyer    — a JPG shrunk to the mobile app's ad slot
    #   scroller — a short line of text that scrolls across that slot
    ad_format = Column(String, default="flyer", index=True)   # flyer | scroller
    media_type = Column(String, default="image")   # image | gif | video | none
    media_url = Column(String)                     # uploaded file
    # An externally hosted video (YouTube / Vimeo / direct .mp4). Kept separate
    # from media_url so an ad can fall back to an uploaded file if the link is
    # ever removed, and so nothing has to be re-uploaded to change the video.
    video_url = Column(String)
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
