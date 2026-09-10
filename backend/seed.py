"""Seed initial data. Run once after install:  python seed.py

Creates:
  - Super Admin           admin@qclonejob.com / admin123
  - Default institute     coco@qclonejob.com  / inst123   (Coco Soft Institute)
  - Demo enterprise       hr@campus.com  / ent123    (Campus Connect Limited) + one job
"""
from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password
from app.migrate import sync_schema
from app.config import settings

print(f"Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")

# Create any missing tables, then add any columns missing from tables that
# already exist. Without the second step an older hire.db (or Supabase schema)
# fails with errors like "no such column: jobs.sector".
Base.metadata.create_all(bind=engine)
sync_schema()

db = SessionLocal()


def ensure_user(email, password, role):
    u = db.query(models.User).filter_by(email=email).first()
    if u:
        return u, False
    u = models.User(email=email, password_hash=hash_password(password), role=role,
                    must_change_password=False)
    db.add(u)
    db.flush()
    return u, True


# --- Admin ---
ensure_user("admin@qclonejob.com", "admin123", models.ROLE_ADMIN)

# --- Default institute (for voluntary registrations) ---
inst_user, created = ensure_user("coco@qclonejob.com", "inst123", models.ROLE_INSTITUTE)
if created:
    db.add(models.Institute(
        user_id=inst_user.id, name="Coco Soft Institute", email="coco@qclonejob.com",
        city="Hyderabad", state="Telangana", country="INDIA",
        promoter_name="Coco Soft", authorised_person_name="Admin",
        courses=["B.Tech", "Diploma", "MBA"], present_strength=500,
    ))

# --- Demo enterprise + job ---
ent_user, created = ensure_user("hr@campus.com", "ent123", models.ROLE_ENTERPRISE)
if created:
    ent = models.Enterprise(
        user_id=ent_user.id, name="Campus Connect Limited", email="hr@campus.com",
        city="Hyderabad", state="Telangana", country="INDIA",
        authorised_person_name="Priya Sharma", designation="HR Manager", phone="9000012345",
    )
    db.add(ent)
    db.flush()
    db.add(models.Job(
        enterprise_id=ent.id, posted_by_user_id=ent_user.id, job_code="MECH/001",
        title="Trainee Mechanical Engineer", category="Engineering", location="Hyderabad",
        no_of_positions=3, description="Support automobile design and CAD workflows.",
        requirement_education="Bachelors in Mechanical", requirement_technical="AutoCAD, SolidWorks",
        experience="0-1 years", salary="3-4 LPA", key_skills=["AutoCAD", "SolidWorks"],
        recruiter_name="Priya Sharma", recruiter_phone="9000012345",
        recruiter_email="hr@campus.com", contact_visible=True,
    ))

# --- Sample jobs across the whole market (daily wage -> postgraduate) ---
SAMPLE_JOBS = [
    ("Electrician", "skilled_trades", "daily", "daily", "iti", "700", "1000", "Hyderabad", ["Wiring", "Motor Repair"]),
    ("Plumber", "skilled_trades", "daily", "daily", "none", "600", "900", "Hyderabad", ["Pipe Fitting"]),
    ("House Maid", "domestic", "part_time", "monthly", "none", "8000", "12000", "Hyderabad", ["Cleaning", "Cooking"]),
    ("Elderly Caretaker", "domestic", "full_time", "monthly", "none", "12000", "18000", "Secunderabad", ["Patient Care"]),
    ("Home Cook", "domestic", "part_time", "monthly", "none", "9000", "15000", "Hyderabad", ["South Indian Cooking"]),
    ("Chef", "hospitality", "full_time", "monthly", "10th", "25000", "40000", "Hyderabad", ["Continental", "Tandoor"]),
    ("Waiter / Server", "hospitality", "full_time", "monthly", "10th", "12000", "16000", "Hyderabad", ["Customer Service"]),
    ("Bearer", "hospitality", "full_time", "monthly", "none", "11000", "14000", "Vijayawada", ["Table Service"]),
    ("Ward Boy", "healthcare", "full_time", "monthly", "10th", "13000", "17000", "Hyderabad", ["Patient Handling"]),
    ("Staff Nurse", "healthcare", "full_time", "monthly", "graduate", "22000", "32000", "Hyderabad", ["Nursing", "ICU"]),
    ("Lab Technician", "healthcare", "full_time", "monthly", "diploma", "18000", "26000", "Warangal", ["Pathology"]),
    ("Farm Worker", "agriculture", "daily", "daily", "none", "450", "600", "Nalgonda", ["Harvesting"]),
    ("Tractor Driver", "agriculture", "full_time", "monthly", "none", "14000", "18000", "Karimnagar", ["Tractor Operation"]),
    ("Dairy Farm Worker", "agriculture", "full_time", "monthly", "none", "12000", "15000", "Medak", ["Milking", "Cattle Care"]),
    ("Kirana Store Helper", "retail", "full_time", "monthly", "8th", "10000", "13000", "Hyderabad", ["Billing", "Stocking"]),
    ("Counter Salesman", "retail", "full_time", "monthly", "10th", "13000", "18000", "Hyderabad", ["Sales"]),
    ("Delivery Executive", "logistics", "full_time", "monthly", "10th", "15000", "22000", "Hyderabad", ["Two Wheeler", "Navigation"]),
    ("Truck Driver", "logistics", "full_time", "monthly", "8th", "20000", "28000", "Hyderabad", ["Heavy Licence"]),
    ("Security Guard", "security", "full_time", "monthly", "10th", "13000", "17000", "Hyderabad", ["Vigilance"]),
    ("Machine Operator", "manufacturing", "full_time", "monthly", "iti", "16000", "22000", "Patancheru", ["CNC"]),
    ("Software Engineer", "it", "full_time", "annual", "graduate", "6", "12", "Hyderabad", ["Python", "React"]),
    ("Data Analyst", "it", "full_time", "annual", "graduate", "5", "9", "Bengaluru", ["SQL", "Excel"]),
    ("Accountant", "corporate", "full_time", "monthly", "graduate", "20000", "30000", "Hyderabad", ["Tally", "GST"]),
    ("Insurance Advisor", "corporate", "full_time", "monthly", "12th", "15000", "25000", "Hyderabad", ["Sales"]),
    ("Recruiter", "corporate", "full_time", "annual", "graduate", "3", "6", "Hyderabad", ["Sourcing"]),
    ("School Teacher", "education", "full_time", "monthly", "graduate", "18000", "28000", "Hyderabad", ["Teaching"]),
    ("Municipality Contract Worker", "government", "contract", "daily", "none", "500", "700", "Hyderabad", ["Sanitation"]),
    ("Beautician", "beauty_events", "full_time", "monthly", "none", "12000", "20000", "Hyderabad", ["Facial", "Hair"]),
    ("Tailor", "beauty_events", "full_time", "monthly", "none", "13000", "20000", "Hyderabad", ["Stitching"]),
    ("Construction Worker", "daily_wage", "daily", "daily", "none", "500", "700", "Hyderabad", ["Masonry Helper"]),
]
ent_row = db.query(models.Enterprise).first()
if ent_row and db.query(models.Job).count() < 5:
    for (title, sector, jtype, wbasis, edu, wmin, wmax, loc, skills) in SAMPLE_JOBS:
        db.add(models.Job(
            enterprise_id=ent_row.id, posted_by_user_id=ent_row.user_id,
            title=title, sector=sector, job_type=jtype, wage_basis=wbasis,
            education_level=edu, wage_min=wmin, wage_max=wmax, location=loc,
            category=sector, key_skills=skills, no_of_positions=2,
            description=f"We are hiring a {title}. Apply through Hire.",
            recruiter_name="Priya Sharma", recruiter_email="hr@campus.com",
            recruiter_phone="9000012345", contact_visible=True, status="active",
        ))
    db.commit()
    print(f"  Seeded {len(SAMPLE_JOBS)} jobs across all sectors")

db.commit()
print("Seed complete.")
print("  Admin      : admin@qclonejob.com / admin123")
print("  Institute  : coco@qclonejob.com  / inst123")
print("  Enterprise : hr@campus.com  / ent123")
db.close()
