from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    must_change_password: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: Optional[str] = None  # optional when forced first-login change
    new_password: str


# ---------- Institute ----------
class InstituteBase(BaseModel):
    name: str
    email: EmailStr
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "INDIA"
    phone: Optional[str] = None
    promoter_name: Optional[str] = None
    authorised_person_name: Optional[str] = None
    authorised_person_phone: Optional[str] = None
    authorised_person_email: Optional[str] = None
    designation: Optional[str] = None
    courses: Optional[List[str]] = []
    present_strength: Optional[int] = None
    about: Optional[str] = None
    website: Optional[str] = None


class InstituteOut(InstituteBase):
    id: int
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Enterprise ----------
class EnterpriseBase(BaseModel):
    name: str
    email: EmailStr
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "INDIA"
    phone: Optional[str] = None
    promoter_name: Optional[str] = None
    authorised_person_name: Optional[str] = None
    designation: Optional[str] = None
    about: Optional[str] = None
    gst_no: Optional[str] = None
    pan_no: Optional[str] = None


class EnterpriseOut(EnterpriseBase):
    id: int
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


class EnterpriseRegister(EnterpriseBase):
    """Self-registration from the enterprise login page."""
    pass


# ---------- Job Seeker ----------
class EducationItem(BaseModel):
    level: Optional[str] = None            # 10th / Inter / Diploma / Bachelor / Master
    degree: Optional[str] = None
    branch: Optional[str] = None
    institute: Optional[str] = None
    location: Optional[str] = None
    year_of_passing: Optional[str] = None
    percentage: Optional[str] = None


class ExperienceItem(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    years: Optional[str] = None
    description: Optional[str] = None


class ProjectItem(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tech: Optional[str] = None
    link: Optional[str] = None


class JobSeekerBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: EmailStr
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    career_objective: Optional[str] = None
    key_skills: Optional[List[str]] = []
    education: Optional[List[EducationItem]] = []
    experience: Optional[List[ExperienceItem]] = []
    certifications: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    additional_info: Optional[str] = None
    resume_template: Optional[str] = "classic"
    projects: Optional[List[ProjectItem]] = []
    achievements: Optional[List[str]] = []
    profile_type: Optional[str] = "professional"
    headline: Optional[str] = None
    total_experience: Optional[str] = None
    expected_salary: Optional[str] = None
    preferred_locations: Optional[List[str]] = []
    notice_period: Optional[str] = None
    availability: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class JobSeekerSelfRegister(JobSeekerBase):
    pass


class JobSeekerOut(JobSeekerBase):
    id: int
    institute_id: Optional[int] = None
    profile_picture_url: Optional[str] = None

    class Config:
        from_attributes = True


class ResumeTemplateUpdate(BaseModel):
    resume_template: str


# ---------- Jobs ----------
class JobBase(BaseModel):
    title: str
    job_code: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    no_of_positions: Optional[int] = 1
    description: Optional[str] = None
    requirement_education: Optional[str] = None
    requirement_technical: Optional[str] = None
    experience: Optional[str] = None
    salary: Optional[str] = None
    key_skills: Optional[List[str]] = []
    recruiter_name: Optional[str] = None
    recruiter_phone: Optional[str] = None
    recruiter_email: Optional[str] = None
    contact_visible: Optional[bool] = True
    sector: Optional[str] = None
    job_type: Optional[str] = "full_time"
    wage_basis: Optional[str] = "monthly"
    wage_min: Optional[str] = None
    wage_max: Optional[str] = None
    education_level: Optional[str] = None
    is_urgent: Optional[bool] = False
    accommodation: Optional[bool] = False
    food_provided: Optional[bool] = False
    shift: Optional[str] = None
    gender_preference: Optional[str] = None


class JobOut(JobBase):
    id: int
    status: str
    created_at: Any

    class Config:
        from_attributes = True


# ---------- Applications ----------
class ApplicationOut(BaseModel):
    id: int
    job_id: int
    status: str
    applied_on: Any
    job: Optional[JobOut] = None

    class Config:
        from_attributes = True


class ApplicationStatusUpdate(BaseModel):
    status: str


# ---------- Profile views ----------
class ProfileViewOut(BaseModel):
    id: int
    viewer_user_id: Optional[int] = None
    view_count: Optional[int] = 1
    first_viewed_at: Optional[Any] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    recruiter_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    action: str
    viewed_at: Any

    class Config:
        from_attributes = True


# ---------- Generic ----------
class Message(BaseModel):
    message: str


class CredentialResult(BaseModel):
    email: str
    user_id: str
    password: str
    status: str
    email_sent: Optional[bool] = None
    email_status: Optional[str] = None     # sent | console | failed
    email_error: Optional[str] = None
