"""Everyday and entry-level work, by sector.

QCloneJob is built first for daily-wage, domestic, helper and trade work —
the jobs people see around them every day. The original taxonomy leaned
toward office and IT roles, so a maid, sweeper, dhobi, ward boy or kirana
helper could not find themselves in the skills list at all.

Each sector maps to ROLES (job titles a person would call themselves) and
SKILLS (what they can do). Both are merged into the sector's role list and
skill pool in job_taxonomy.py, so they show up:
  - in the job seeker's "Key skills" picker,
  - in the recruiter's role/skill pickers when posting a job,
  - in job matching (key skills are compared on both sides).

Common Indian job names are kept as people actually say them
("Safai Karmachari", "Dhobi", "Ward Boy"), with the English form alongside
where both are used.
"""

EXTRA = {
    # ---------------------------------------------------------------- trades
    "skilled_trades": {
        "roles": [
            "Plumber", "Plumber Helper", "Pipe Fitter", "Sanitary Fitter", "Electrician", "Electrician Helper",
            "House Wiring Electrician", "Industrial Electrician", "Wireman", "Lineman", "Fitter", "Fitter Helper",
            "Welder", "Arc Welder", "TIG Welder", "MIG Welder", "Gas Welder", "Gas Cutter", "Fabricator",
            "Carpenter", "Carpenter Helper", "Furniture Carpenter", "Modular Kitchen Fitter", "Mason", "Mason Helper",
            "Tile Mason", "Marble Fitter", "Granite Polisher", "Painter", "Wall Painter", "Spray Painter",
            "POP / False Ceiling Worker", "Putty Worker", "Bar Bender", "Shuttering Carpenter", "Scaffolder",
            "Construction Labourer", "Construction Helper", "Site Supervisor", "Construction Foreman",
            "Glass Fitter", "Aluminium Fabricator", "Grill / Gate Fabricator", "Blacksmith", "Locksmith",
            "Key Maker", "AC Technician", "AC Helper", "Refrigerator Mechanic", "Washing Machine Technician",
            "RO / Water Purifier Technician", "Geyser Technician", "Inverter / UPS Technician",
            "CCTV Installer", "DTH Installer", "Solar Panel Installer", "Lift Technician", "Lift Operator",
            "Pump Operator", "Motor Rewinding Mechanic", "Generator (DG) Operator", "Borewell Driller",
            "Waterproofing Applicator", "Roofer", "Upholsterer", "Sofa Repairer", "Curtain Fitter",
            "Mobile Repair Technician", "Laptop Repair Technician", "TV Repair Technician", "Watch Repairer",
            "Shoe Repairer (Cobbler)", "Umbrella / Bag Repairer", "Tailor", "Ladies Tailor", "Gents Tailor",
            "Embroidery Worker", "Handyman", "Maintenance Technician", "Building Maintenance Staff",
        ],
        "skills": [
            "Plumbing", "Pipe Fitting", "Leak Repair", "Drain Cleaning", "Bathroom Fitting", "Water Tank Installation",
            "House Wiring", "Electrical Repair", "Panel Board Wiring", "Earthing", "MCB / DB Installation",
            "Fan & Light Fitting", "Arc Welding", "TIG Welding", "MIG Welding", "Gas Cutting", "Metal Fabrication",
            "Woodwork", "Furniture Making", "Furniture Repair", "Door & Window Fitting", "Bricklaying",
            "Plastering", "Tiling", "Flooring", "Wall Painting", "Texture Painting", "Polishing",
            "False Ceiling", "Bar Bending", "Shuttering", "Concrete Work", "Scaffolding", "Glass Fitting",
            "AC Installation", "AC Servicing", "Gas Charging", "Refrigerator Repair", "Washing Machine Repair",
            "RO Servicing", "Inverter Repair", "CCTV Installation", "Solar Installation", "Motor Rewinding",
            "DG Set Operation", "Waterproofing", "Lock Repair", "Key Cutting", "Upholstery", "Mobile Repair",
            "Stitching", "Alterations", "Blouse Stitching", "Embroidery", "Hand Tools", "Power Tools",
            "Reading Drawings", "Measurement & Marking",
        ],
    },
    "daily_wage": {
        "roles": [
            "Daily Wage Labourer", "Helper", "General Helper", "Loading / Unloading Labourer", "Hamali / Porter",
            "Coolie (Railway Porter)", "Mazdoor", "Head Load Worker", "Construction Mazdoor", "Brick Kiln Worker",
            "Road Construction Worker", "Digging / Excavation Labourer", "Shifting Helper (Packers & Movers)",
            "Godown Helper", "Market Helper", "Mandi Labourer", "Event Setup Helper", "Tent House Worker",
            "Catering Helper", "Dish Washer", "Car Washer", "Bike Washer", "Garden Labourer", "Mali Helper",
            "Water Can Delivery Boy", "Gas Cylinder Delivery Boy", "Newspaper Delivery Boy", "Milk Delivery Boy",
            "Office Boy", "Peon", "Tea Boy", "Errand Runner", "Rag Picker", "Scrap Collector",
        ],
        "skills": [
            "Loading & Unloading", "Lifting Heavy Loads", "Packing", "Shifting Goods", "Digging", "Cleaning",
            "Washing", "Carrying Loads", "Stacking", "Basic Counting", "Following Instructions", "Punctuality",
            "Physical Fitness", "Night Shift Ready", "Team Work",
        ],
    },
    # -------------------------------------------------------------- domestic
    "domestic": {
        "roles": [
            "House Maid", "Full-time Maid", "Part-time Maid", "Live-in Maid", "Bai / Domestic Help", "Cook (Home)",
            "Home Cook (Veg)", "Home Cook (Non-Veg)", "Nanny", "Babysitter", "Japa Maid (New Mother Care)",
            "Elderly Caretaker", "Patient Caretaker (Home)", "Bathroom Cleaner", "Toilet Cleaner", "House Cleaner",
            "Deep Cleaning Staff", "Kitchen Cleaner", "Dish Washer (Home)", "Dhobi", "Washerman / Washerwoman",
            "Ironing Person (Istriwala)", "Laundry Worker", "Dry Cleaner", "Gardener (Mali)", "Home Driver",
            "Watchman (Home)", "Pet Sitter", "Dog Walker", "Pet Groomer", "Home Tutor", "Cook cum Maid",
            "Housekeeper", "Butler", "Pest Control Worker", "Water Tank Cleaner", "Sofa / Carpet Cleaner",
        ],
        "skills": [
            "Sweeping", "Mopping", "Dusting", "Utensil Washing", "Bathroom Cleaning", "Toilet Cleaning",
            "Kitchen Cleaning", "Deep Cleaning", "Floor Scrubbing", "Cloth Washing", "Ironing", "Folding Clothes",
            "Indian Cooking", "North Indian Cooking", "South Indian Cooking", "Roti / Chapati Making",
            "Tiffin Preparation", "Child Care", "Baby Bathing", "Elder Care", "Feeding Assistance",
            "Bed Making", "Grocery Shopping", "Vegetable Cutting", "Pet Care", "Plant Watering",
            "Gardening", "Lawn Mowing", "Trustworthy", "Hygiene Awareness", "Pest Control",
            "Water Tank Cleaning", "Carpet Shampooing",
        ],
    },
    # ------------------------------------------------------------ healthcare
    "healthcare": {
        "roles": [
            "Doctor", "General Physician (MBBS)", "Family Doctor", "Neurologist", "Neurosurgeon", "Cardiologist",
            "Cardiac Surgeon", "Orthopaedic Surgeon", "General Surgeon", "Paediatrician", "Gynaecologist",
            "Obstetrician", "Dermatologist", "Psychiatrist", "Psychologist", "ENT Specialist", "Ophthalmologist",
            "Urologist", "Nephrologist", "Gastroenterologist", "Pulmonologist", "Oncologist", "Endocrinologist",
            "Diabetologist", "Rheumatologist", "Radiologist", "Pathologist", "Anaesthetist", "Dentist",
            "Orthodontist", "Dental Surgeon", "Dental Assistant", "Ayurveda Doctor (BAMS)", "Homeopathy Doctor (BHMS)",
            "Unani Doctor", "Siddha Doctor", "Resident Doctor", "Duty Doctor", "Casualty Medical Officer",
            "Nurse", "Staff Nurse", "Sister (Nursing Sister)", "Head Nurse", "Nursing Superintendent",
            "ICU Nurse", "OT Nurse", "Ward Sister", "ANM", "GNM", "Ward Boy", "Ward Aaya", "Ward Attendant",
            "Hospital Attendant", "Patient Care Assistant", "Stretcher Bearer", "OT Assistant", "OT Technician",
            "Hospital Housekeeping Staff", "Hospital Sweeper", "Hospital Cleaner", "Hospital Security Guard",
            "Hospital Receptionist", "Front Desk Executive (Hospital)", "OPD Coordinator", "Medical Records Clerk",
            "Hospital Billing Executive", "Insurance / TPA Desk Executive", "Hospital Cashier", "Ambulance Driver",
            "Ambulance Attendant", "Dietitian", "Hospital Kitchen Staff", "Physiotherapist", "Occupational Therapist",
            "Speech Therapist", "Optometrist", "Audiologist", "Hospital Administrator", "Hospital Manager",
            "Medical Superintendent", "Biomedical Engineer", "CSSD Technician", "Mortuary Attendant",
        ],
        "skills": [
            "Patient Care", "Patient Handling", "Bed Making (Hospital)", "Patient Shifting", "Wheelchair Handling",
            "Stretcher Handling", "Vitals Monitoring", "BP Checking", "Sugar Testing", "Injection Giving",
            "Dressing & Wound Care", "Catheter Care", "Feeding Tube Care", "Oxygen Administration", "Nebulization",
            "Medicine Distribution", "ICU Care", "OT Assistance", "Sterilization", "Infection Control",
            "Biomedical Waste Handling", "Hospital Cleaning", "Ward Management", "First Aid", "CPR / BLS",
            "Diagnosis", "Prescription Writing", "Clinical Examination", "Surgery", "Dental Procedures",
            "Teeth Cleaning (Scaling)", "Root Canal", "Patient Counselling", "Hospital Billing", "TPA / Insurance Claims",
            "OPD Management", "Appointment Scheduling", "Medical Records", "HIS Software",
        ],
    },
    "paramedical": {
        "roles": [
            "Lab Technician", "Lab Assistant", "Phlebotomist (Blood Collector)", "Sample Collection Boy",
            "X-Ray Technician", "CT Scan Technician", "MRI Technician", "ECG Technician", "Dialysis Technician",
            "Cath Lab Technician", "Blood Bank Technician", "Optician", "Health Worker", "ASHA Worker",
            "Anganwadi Worker", "Multipurpose Health Worker", "Home Health Aide", "Medical Transcriptionist",
        ],
        "skills": [
            "Blood Collection", "Sample Handling", "Lab Testing", "X-Ray Operation", "ECG Recording",
            "Dialysis", "Report Preparation", "Home Sample Collection", "Health Survey", "Vaccination Support",
        ],
    },
    # ----------------------------------------------------------------- pharma
    "pharma": {
        "roles": [
            "Pharmacist", "Chemist", "Medical Shop Helper", "Pharmacy Assistant", "Medical Shop Salesman",
            "Hospital Pharmacist", "Medical Representative (MR)", "Area Sales Manager (Pharma)",
            "Production Operator (Pharma)", "Production Chemist", "Machine Operator (Tablet / Capsule)",
            "Packing Helper (Pharma)", "QC Chemist", "QA Executive (Pharma)", "Microbiologist",
            "Warehouse Helper (Pharma)", "Store Keeper (Pharma)", "Regulatory Affairs Executive",
            "Formulation Scientist", "Pharma Delivery Boy",
        ],
        "skills": [
            "Medicine Dispensing", "Prescription Reading", "Medicine Billing", "Drug Knowledge", "Stock Expiry Check",
            "Cold Chain Handling", "Tablet Compression", "Capsule Filling", "Blister Packing", "Strip Packing",
            "GMP", "Clean Room Practices", "QC Testing", "HPLC", "Documentation (Pharma)", "Doctor Detailing",
            "Field Sales (Pharma)",
        ],
    },
    # -------------------------------------------------------- hospitality / food
    "hospitality": {
        "roles": [
            "Room Boy", "Housekeeping Boy", "Housekeeping Attendant", "Laundry Boy", "Bell Boy", "Doorman",
            "Valet Parking Driver", "Waiter", "Steward", "Captain (Restaurant)", "Kitchen Helper", "Commis Chef",
            "Cook", "Chef", "Tandoor Cook", "South Indian Cook", "Chinese Cook", "Halwai (Sweet Maker)",
            "Roti Maker", "Dosa Master", "Tea / Coffee Maker (Chaiwala)", "Juice Maker", "Utensil Cleaner",
            "Canteen Boy", "Mess Worker", "Cafeteria Attendant", "Banquet Helper",
        ],
        "skills": [
            "Room Cleaning", "Linen Change", "Guest Service", "Table Setting", "Serving Food", "Order Taking",
            "Cooking", "Tandoor Cooking", "Sweet Making", "Tea Making", "Juice Making", "Kitchen Hygiene",
            "Utensil Cleaning", "Food Packing", "Bulk Cooking",
        ],
    },
    # ----------------------------------------------------------------- retail
    "retail": {
        "roles": [
            "Shop Helper", "Salesman / Saleswoman", "Counter Sales", "Sales Girl / Sales Boy", "Cashier",
            "Billing Executive", "Billing Clerk", "Store Helper", "Store Keeper", "Floor Staff", "Shelf Stocker",
            "Garment Shop Salesman", "Footwear Shop Salesman", "Jewellery Shop Salesman", "Mobile Shop Salesman",
            "Electronics Showroom Salesman", "Mall Housekeeping", "Petrol Pump Attendant", "Gas Agency Staff",
            "Vegetable Seller", "Fruit Seller", "Street Vendor", "Cart Puller", "Bakery Helper", "Sweet Shop Helper",
            "Hardware Shop Helper", "Stationery Shop Helper", "Pan Shop Helper", "Meat / Chicken Shop Worker",
            "Fish Seller",
        ],
        "skills": [
            "Billing", "Cash Counting", "UPI / Card Payments", "Customer Handling", "Product Display",
            "Stock Counting", "Price Tagging", "Weighing", "Packing Items", "Shop Cleaning", "Selling Skills",
            "Fuel Dispensing", "Meat Cutting", "Fish Cleaning",
        ],
    },
    "kirana_stores": {
        "roles": [
            "Kirana Shop Helper", "Kirana Store Salesman", "Grocery Packing Boy", "Grocery Delivery Boy",
            "Kirana Billing Boy", "Supermarket Helper", "Supermarket Cashier", "Ration Shop Helper",
        ],
        "skills": [
            "Grocery Packing", "Weighing Groceries", "Home Delivery", "Kirana Billing", "Stock Arrangement",
            "Loose Item Packing", "Ration Distribution",
        ],
    },
    # -------------------------------------------------------------- transport
    "logistics": {
        "roles": [
            "Driver", "Car Driver", "Personal Driver", "Company Driver", "Cab Driver", "Taxi Driver",
            "Auto Driver", "E-Rickshaw Driver", "Bike Delivery Boy", "Delivery Boy", "Delivery Executive",
            "Courier Boy", "Food Delivery Partner", "Truck Driver", "Lorry Driver", "Tanker Driver",
            "Tempo Driver", "Pickup Van Driver", "School Bus Driver", "Bus Driver", "Bus Conductor",
            "Driver cum Helper", "Cleaner (Truck / Bus)", "Vehicle Cleaner Helper", "Khalasi", "Loader",
            "Warehouse Helper", "Warehouse Supervisor", "Forklift Operator", "Picker / Packer", "Dispatch Clerk",
            "Transport Supervisor", "Transport Manager", "Fleet Manager", "Fleet Supervisor", "Logistics Coordinator",
            "Route Planner", "Traffic Controller", "Parking Attendant", "Toll Booth Operator",
        ],
        "skills": [
            "Driving", "Car Driving", "Two-Wheeler Driving", "Heavy Vehicle Driving", "LMV Driving",
            "Driving Licence", "Badge (Commercial Licence)", "Route Knowledge", "Google Maps", "Safe Driving",
            "Vehicle Cleaning", "Basic Vehicle Repair", "Tyre Changing", "Loading Vehicles", "Parcel Delivery",
            "Cash on Delivery Handling", "Delivery App Usage", "Fleet Management", "Trip Planning",
            "Vehicle Documentation", "Picking & Packing", "Forklift Driving", "E-way Bill", "Dispatch Handling",
        ],
    },
    # ---------------------------------------------------- security / sanitation
    "security": {
        "roles": [
            "Security Guard", "Lady Security Guard", "Watchman", "Gatekeeper", "Chowkidar", "Bouncer",
            "Security Supervisor", "Housekeeping Staff", "Housekeeping Supervisor", "Sweeper", "Cleaner",
            "Safai Karmachari", "Office Cleaner", "Toilet Cleaner (Commercial)", "Facility Executive",
        ],
        "skills": [
            "Gate Duty", "Visitor Register", "Patrolling", "CCTV Monitoring", "Crowd Control", "Fire Safety",
            "Night Duty", "Sweeping (Commercial)", "Floor Mopping", "Scrubbing Machine Operation",
            "Washroom Cleaning", "Glass Cleaning", "Garbage Disposal",
        ],
    },
    "waste": {
        "roles": [
            "Safai Karmachari", "Sanitation Worker", "Garbage Collector", "Door-to-Door Waste Collector",
            "Street Sweeper", "Drain Cleaner", "Sewer Cleaner", "Septic Tank Cleaner", "Garbage Truck Driver",
            "Waste Segregation Worker", "Recycling Plant Worker", "Scrap Dealer Helper", "Sanitation Supervisor",
        ],
        "skills": [
            "Waste Collection", "Waste Segregation", "Street Sweeping", "Drain Cleaning (Municipal)",
            "Safety Gear Usage", "Composting", "Recycling", "Garbage Vehicle Loading",
        ],
    },
    # ---------------------------------------------------------- manufacturing
    "manufacturing": {
        "roles": [
            "Machine Operator", "Helper (Factory)", "Factory Worker", "Production Worker", "Production Supervisor",
            "Line Operator", "Assembly Line Worker", "CNC Operator", "VMC Operator", "Lathe Operator",
            "Turner", "Machinist", "Grinder", "Press Operator", "Moulding Operator", "Packing Helper",
            "Packing Supervisor", "Quality Checker", "Quality Inspector", "Store Helper (Factory)",
            "Boiler Operator", "Maintenance Fitter", "Maintenance Electrician", "Painter (Industrial)",
            "Buffing / Polishing Worker", "Sheet Metal Worker", "Plant Operator", "Shift Incharge",
        ],
        "skills": [
            "Machine Operation", "CNC Operation", "Lathe Work", "Turning", "Milling", "Grinding",
            "Press Operation", "Injection Moulding", "Assembly Work", "Packing (Factory)", "Labelling",
            "Quality Checking", "Measuring Instruments", "Vernier Caliper", "Micrometer", "5S",
            "Safety Rules (Factory)", "Shift Work", "Boiler Operation", "Production Reporting",
        ],
    },
    "textiles": {
        "roles": [
            "Tailor (Factory)", "Sewing Machine Operator", "Cutting Master", "Checker (Garments)", "Ironing Man (Garments)",
            "Thread Cutter", "Packing Boy (Garments)", "Weaver", "Handloom Weaver", "Power Loom Operator",
            "Spinning Operator", "Dyeing Worker", "Printing Worker (Textile)", "Zari / Embroidery Artisan",
        ],
        "skills": [
            "Sewing Machine Operation", "Overlock Machine", "Fabric Cutting", "Pattern Making", "Garment Checking",
            "Thread Cutting", "Weaving", "Dyeing", "Block Printing", "Hand Embroidery",
        ],
    },
    "food_processing": {
        "roles": [
            "Food Packing Helper", "Bakery Worker", "Baker", "Dairy Plant Worker", "Milk Collection Staff",
            "Rice Mill Worker", "Flour Mill Worker (Chakki)", "Oil Mill Worker", "Pickle / Papad Maker",
            "Namkeen Maker", "Cold Storage Worker",
        ],
        "skills": [
            "Food Packing", "Baking", "Milk Testing", "Grain Cleaning", "Flour Milling", "Food Safety",
            "Sealing Machine", "Cold Storage Handling",
        ],
    },
    # ------------------------------------------------------------ agriculture
    "agriculture": {
        "roles": [
            "Farm Labourer", "Kisan / Farmer", "Tractor Driver", "Harvester Operator", "Dairy Farm Worker",
            "Milkman (Doodhwala)", "Cattle Caretaker", "Poultry Farm Worker", "Goat / Sheep Farm Worker",
            "Fishery Worker", "Fisherman", "Plantation Worker", "Tea Garden Worker", "Nursery Worker",
            "Gardener", "Mali", "Landscaping Worker", "Irrigation Worker", "Farm Supervisor",
        ],
        "skills": [
            "Ploughing", "Sowing", "Harvesting", "Tractor Driving", "Irrigation", "Spraying Pesticide",
            "Milking", "Cattle Feeding", "Poultry Care", "Fishing", "Plant Nursery", "Pruning", "Organic Farming",
        ],
    },
    # -------------------------------------------------------- government / city
    "government": {
        "roles": [
            "Municipal Worker", "Municipal Sweeper", "Municipal Driver", "Municipal Clerk", "Junior Engineer (Municipal)",
            "Sanitary Inspector", "Health Inspector", "Tax Collector (Municipal)", "Ward Officer",
            "Water Supply Operator", "Valve Man (Water Supply)", "Pump House Operator", "Street Light Electrician",
            "Road Maintenance Worker", "Park Maintenance Worker", "Gardener (Municipal)", "Fireman",
            "Fire Station Driver", "Peon (Government Office)", "Record Room Clerk", "Village Revenue Assistant",
            "Panchayat Secretary", "Data Entry Operator (Govt)", "Teacher (Govt School)", "Anganwadi Helper",
            "Mid-Day Meal Cook", "Postman", "Gramin Dak Sevak", "Railway Track Man", "Gangman", "Home Guard",
            "Traffic Warden",
        ],
        "skills": [
            "Water Supply Operation", "Street Light Maintenance", "Road Repair", "Public Park Maintenance",
            "Fire Fighting", "Rescue Operations", "Mail Delivery", "Record Keeping", "Government Procedures",
            "Tax Collection", "Mid-Day Meal Cooking",
        ],
    },
    # ---------------------------------------------------------------------- IT
    "it": {
        "roles": [
            "Software Developer", "Software Engineer", "Web Developer", "Frontend Developer", "Backend Developer",
            "Full Stack Developer", "Mobile App Developer", "Android Developer", "iOS Developer", "Python Developer",
            "Java Developer", ".NET Developer", "PHP Developer", "React Developer", "Data Analyst", "Data Scientist",
            "Data Engineer", "ML Engineer", "AI Engineer", "DevOps Engineer", "Cloud Engineer", "QA / Tester",
            "Manual Tester", "Automation Tester", "UI / UX Designer", "Graphic Designer", "System Administrator",
            "Network Engineer", "Network Technician", "IT Support Executive", "Desktop Support Engineer",
            "Hardware Technician", "Computer Operator", "Data Entry Operator", "Back Office Executive",
            "Technical Support (Voice)", "Cyber Security Analyst", "Database Administrator", "Project Manager (IT)",
            "Scrum Master", "Business Analyst", "Product Manager", "Technical Writer",
        ],
        "skills": [
            "Computer Basics", "MS Word", "MS Excel", "Typing (English)", "Typing (Hindi)", "Data Entry",
            "Internet Usage", "Email Handling", "Printer & Scanner Handling", "Computer Hardware",
            "Computer Assembly", "LAN Cabling", "Windows Installation", "Tally", "Google Sheets",
        ],
    },
    # --------------------------------------------------------- other everyday
    "beauty_events": {
        "roles": [
            "Barber", "Hair Cutter", "Hair Stylist", "Beautician", "Beauty Parlour Helper", "Makeup Artist",
            "Bridal Makeup Artist", "Mehendi Artist", "Nail Technician", "Massage Therapist", "Spa Therapist",
            "Salon Receptionist", "Decorator", "Flower Decorator", "Tent / Pandal Worker", "Sound System Operator",
            "DJ", "Photographer", "Videographer", "Catering Supervisor", "Wedding Planner Assistant",
        ],
        "skills": [
            "Hair Cutting", "Shaving", "Hair Colouring", "Facial", "Threading", "Waxing", "Manicure", "Pedicure",
            "Makeup", "Mehendi Design", "Massage", "Flower Decoration", "Stage Decoration", "Sound Setup",
            "Photography", "Video Shooting",
        ],
    },
    "education": {
        "roles": [
            "Teacher", "Primary Teacher", "Pre-Primary Teacher", "Tuition Teacher", "Home Tutor", "Ayah (School)",
            "School Peon", "School Bus Attendant", "Lab Assistant (School)", "Librarian", "Hostel Warden",
            "Hostel Cook", "School Gardener", "Coaching Centre Counsellor", "Principal", "Vice Principal",
        ],
        "skills": [
            "Teaching", "Classroom Management", "Lesson Planning", "Child Handling", "Spoken English",
            "Hindi Teaching", "Maths Teaching", "Tuition", "Library Management",
        ],
    },
    "automotive": {
        "roles": [
            "Car Mechanic", "Bike Mechanic", "Two-Wheeler Mechanic", "Auto Electrician", "Denter", "Car Painter",
            "Car Washer", "Car Detailer", "Puncture Repair", "Tyre Fitter", "Wheel Alignment Technician",
            "Service Advisor", "Workshop Helper", "Spare Parts Salesman", "Diesel Mechanic", "Truck Mechanic",
        ],
        "skills": [
            "Engine Repair", "Bike Servicing", "Car Servicing", "Brake Repair", "Clutch Repair", "Oil Change",
            "Denting", "Car Painting", "Puncture Repair", "Wheel Balancing", "Car Washing", "Diagnostics (OBD)",
        ],
    },
    "bfsi": {
        "roles": [
            "Bank Peon", "Cash Counter Staff", "Collection Agent", "Recovery Agent", "Insurance Agent",
            "Loan Agent", "Field Officer (Microfinance)", "Bank Mitra", "ATM Guard", "Accountant", "Accounts Assistant",
            "Billing Person", "Bookkeeper",
        ],
        "skills": [
            "Cash Handling", "Cash Counting Machine", "Collection", "Field Visits", "KYC Collection",
            "Bookkeeping", "Accounts Writing", "GST Billing", "Tally Entry",
        ],
    },
    "corporate": {
        "roles": [
            "Receptionist", "Front Office Executive", "Office Assistant", "Office Admin", "Admin Executive",
            "HR Executive", "HR Assistant", "Telecaller", "Customer Care Executive", "Call Centre Executive",
            "Sales Executive", "Field Sales Executive", "Marketing Executive", "Accountant", "Store Incharge",
            "Purchase Executive", "Personal Assistant", "Office Driver", "Pantry Boy", "Housekeeping (Office)",
        ],
        "skills": [
            "Telecalling", "Customer Service", "Phone Handling", "Spoken Hindi", "Spoken English",
            "Spoken Telugu", "Spoken Tamil", "Spoken Kannada", "Spoken Marathi", "Communication Skills",
            "Field Sales", "Lead Generation", "Office Administration", "Filing", "Photocopy / Xerox",
        ],
    },
    "energy": {
        "roles": [
            "Electric Lineman", "Meter Reader", "Substation Operator", "Solar Technician", "Wind Turbine Technician",
            "Gas Pipeline Fitter", "LPG Delivery Man", "Petrol Pump Manager",
        ],
        "skills": ["Meter Reading", "Line Maintenance", "Substation Operation", "Solar Panel Cleaning", "LPG Handling"],
    },
    "telecom": {
        "roles": [
            "Tower Technician", "Fibre Splicer", "Cable Operator", "Broadband Technician", "SIM Card Promoter",
            "Mobile Recharge Shop Staff",
        ],
        "skills": ["Fibre Splicing", "Cable Laying", "Router Installation", "Tower Climbing", "SIM Activation"],
    },
    "ecommerce": {
        "roles": [
            "E-commerce Delivery Boy", "Last Mile Delivery Executive", "Sorter (Hub)", "Return Pickup Executive",
            "Warehouse Picker", "Catalogue Executive",
        ],
        "skills": ["Parcel Sorting", "Scanner Usage", "Barcode Scanning", "Returns Handling", "Delivery Route Planning"],
    },
    "realestate": {
        "roles": [
            "Property Dealer / Broker", "Site Supervisor (Real Estate)", "Apartment Caretaker", "Society Manager",
            "Society Watchman", "Society Housekeeping", "Facility Manager",
        ],
        "skills": ["Property Showing", "Tenant Handling", "Society Maintenance", "Rent Collection"],
    },
    "religious": {
        "roles": ["Pujari / Priest", "Temple Helper", "Church Caretaker", "Mosque Caretaker (Khadim)", "Gurudwara Sevadar"],
        "skills": ["Puja Rituals", "Temple Maintenance", "Prasad Preparation"],
    },
    "sports_wellness": {
        "roles": ["Gym Trainer", "Yoga Instructor", "Swimming Coach", "Sports Coach", "Lifeguard", "Gym Cleaner"],
        "skills": ["Fitness Training", "Yoga", "Swimming", "Life Saving", "Diet Guidance"],
    },
    "veterinary": {
        "roles": ["Veterinary Doctor", "Veterinary Assistant", "Animal Caretaker", "Pet Shop Helper", "Kennel Attendant"],
        "skills": ["Animal Handling", "Animal Feeding", "Pet Grooming", "Animal First Aid"],
    },
    "media": {
        "roles": ["Printing Press Operator", "Flex Printing Operator", "Signboard Painter", "Newspaper Hawker", "Video Editor"],
        "skills": ["Flex Printing", "Offset Printing", "Sign Painting", "Video Editing"],
    },
    "legal": {
        "roles": ["Advocate", "Lawyer", "Court Clerk", "Munshi (Advocate's Clerk)", "Notary", "Typist (Court)"],
        "skills": ["Legal Drafting", "Court Filing", "Affidavit Typing"],
    },
    "travel": {
        "roles": ["Travel Agent", "Tour Guide", "Ticket Booking Agent", "Hotel Booking Executive"],
        "skills": ["Ticket Booking", "IRCTC Booking", "Tour Guiding"],
    },
    "mining": {
        "roles": ["Mine Worker", "Quarry Worker", "Stone Cutter", "Blaster", "Mining Supervisor"],
        "skills": ["Stone Cutting", "Quarrying", "Blasting Safety"],
    },
    "defence": {
        "roles": ["Ex-Serviceman", "Armed Guard", "Gunman", "Security Officer (Ex-Army)"],
        "skills": ["Weapon Handling", "Arms Licence", "Discipline"],
    },
}

# Shown first in the Key skills picker before the person types anything:
# the work this platform is mainly for.
EVERYDAY_FIRST = [
    "Plumber", "Electrician", "Carpenter", "Painter", "Mason", "Welder", "Fitter", "Driver", "Delivery Boy",
    "House Maid", "Cook (Home)", "Nanny", "Elderly Caretaker", "Bathroom Cleaner", "House Cleaner", "Dhobi",
    "Security Guard", "Watchman", "Sweeper", "Safai Karmachari", "Cleaner", "Helper", "Daily Wage Labourer",
    "Loading / Unloading Labourer", "Ward Boy", "Nurse", "Sister (Nursing Sister)", "Pharmacist",
    "Kirana Shop Helper", "Shop Helper", "Cashier", "Billing Person", "Salesman / Saleswoman", "Waiter",
    "Kitchen Helper", "Office Boy", "Peon", "Tailor", "Barber", "Beautician", "Machine Operator",
    "Factory Worker", "Packing Helper", "Warehouse Helper", "Gardener (Mali)", "AC Technician",
    "Mobile Repair Technician", "Car Mechanic", "Bike Mechanic", "Farm Labourer", "Tractor Driver",
    "Data Entry Operator", "Computer Operator", "Telecaller", "Receptionist",
]


# New industries for everyday work that had no home of their own. Same shape
# as job_taxonomy.SECTORS; "skills" becomes that industry's skill pool.
NEW_SECTORS = [
    {"key": "hospital_support", "name": "Hospital Support Staff", "icon": "heart",
     "education": "8th", "wage_basis": "monthly", "blurb": "Ward boys, aayas, attendants, hospital cleaning",
     "roles": ["Ward Boy", "Ward Aaya", "Ward Attendant", "Hospital Attendant", "Patient Care Assistant",
               "Stretcher Bearer", "OT Assistant", "Hospital Sweeper", "Hospital Cleaner",
               "Hospital Housekeeping Staff", "Hospital Kitchen Staff", "Hospital Laundry Staff",
               "Hospital Security Guard", "Ambulance Driver", "Ambulance Attendant", "Mortuary Attendant",
               "Hospital Billing Executive", "Hospital Receptionist", "Medical Records Clerk"],
     "skills": ["Patient Shifting", "Wheelchair Handling", "Stretcher Handling", "Bed Making (Hospital)",
                "Hospital Cleaning", "Biomedical Waste Handling", "Infection Control", "Patient Care",
                "Feeding Assistance", "Hospital Billing", "First Aid"]},
    {"key": "medical_stores", "name": "Medical Stores & Pharmacy", "icon": "flask",
     "education": "12th", "wage_basis": "monthly", "blurb": "Pharmacists, chemist shop staff, delivery",
     "roles": ["Pharmacist", "Chemist", "Medical Shop Helper", "Medical Shop Salesman", "Pharmacy Assistant",
               "Pharmacy Billing Staff", "Medicine Delivery Boy", "Pharmacy Store Manager"],
     "skills": ["Medicine Dispensing", "Prescription Reading", "Medicine Billing", "Stock Expiry Check",
                "Drug Knowledge", "Cold Chain Handling", "Home Delivery"]},
    {"key": "housekeeping_facility", "name": "Housekeeping & Cleaning Services", "icon": "sparkle",
     "education": "none", "wage_basis": "monthly", "blurb": "Sweepers, cleaners, office & society housekeeping",
     "roles": ["Housekeeping Staff", "Housekeeping Supervisor", "Sweeper", "Cleaner", "Safai Karmachari",
               "Office Cleaner", "Bathroom Cleaner", "Toilet Cleaner", "Deep Cleaning Staff",
               "Glass / Facade Cleaner", "Sofa / Carpet Cleaner", "Water Tank Cleaner", "Pest Control Worker",
               "Society Housekeeping", "Mall Housekeeping", "Pantry Boy"],
     "skills": ["Sweeping", "Mopping", "Dusting", "Washroom Cleaning", "Floor Scrubbing",
                "Scrubbing Machine Operation", "Glass Cleaning", "Deep Cleaning", "Garbage Disposal",
                "Cleaning Chemicals Handling", "Pest Control"]},
    {"key": "laundry", "name": "Laundry, Dhobi & Dry Cleaning", "icon": "bed",
     "education": "none", "wage_basis": "daily", "blurb": "Dhobi, ironing, laundry and dry cleaning",
     "roles": ["Dhobi", "Washerman / Washerwoman", "Ironing Person (Istriwala)", "Laundry Worker",
               "Laundry Machine Operator", "Dry Cleaner", "Stain Removal Specialist", "Laundry Delivery Boy",
               "Laundry Shop Manager"],
     "skills": ["Cloth Washing", "Ironing", "Steam Ironing", "Folding Clothes", "Stain Removal",
                "Dry Cleaning", "Laundry Machine Operation", "Garment Sorting"]},
    {"key": "repair_services", "name": "Repair & Home Maintenance", "icon": "tools",
     "education": "iti", "wage_basis": "daily", "blurb": "AC, RO, appliance, mobile and home repairs",
     "roles": ["AC Technician", "Refrigerator Mechanic", "Washing Machine Technician",
               "RO / Water Purifier Technician", "Geyser Technician", "Inverter / UPS Technician",
               "TV Repair Technician", "Mobile Repair Technician", "Laptop Repair Technician", "Handyman",
               "Plumber", "Electrician", "Carpenter", "Painter", "Locksmith", "Watch Repairer",
               "Shoe Repairer (Cobbler)"],
     "skills": ["AC Servicing", "Gas Charging", "Refrigerator Repair", "Washing Machine Repair", "RO Servicing",
                "Inverter Repair", "Mobile Repair", "Plumbing", "House Wiring", "Furniture Repair",
                "Lock Repair", "Customer Handling"]},
    {"key": "packers_courier", "name": "Packers, Movers & Courier", "icon": "package",
     "education": "8th", "wage_basis": "daily", "blurb": "Shifting, packing, courier and parcel delivery",
     "roles": ["Packer", "Shifting Helper (Packers & Movers)", "Loader", "Mover Truck Driver", "Courier Boy",
               "Parcel Delivery Boy", "Courier Counter Staff", "Sorter (Hub)", "Shifting Supervisor"],
     "skills": ["Packing", "Bubble Wrapping", "Furniture Dismantling", "Loading & Unloading", "Parcel Delivery",
                "Parcel Sorting", "Barcode Scanning"]},
    {"key": "bakery_sweets", "name": "Bakery, Sweets & Street Food", "icon": "utensils",
     "education": "none", "wage_basis": "daily", "blurb": "Bakers, halwais, chaat and tea stalls",
     "roles": ["Baker", "Bakery Helper", "Halwai (Sweet Maker)", "Sweet Shop Helper", "Namkeen Maker",
               "Chaat Maker", "Pani Puri Maker", "Dosa Master", "Tea / Coffee Maker (Chaiwala)",
               "Juice Maker", "Fast Food Cook", "Street Food Vendor", "Tiffin Service Cook"],
     "skills": ["Baking", "Sweet Making", "Namkeen Making", "Chaat Making", "Tea Making", "Juice Making",
                "Tandoor Cooking", "Food Hygiene", "Food Packing"]},
    {"key": "fuel_gas", "name": "Petrol Pumps & Gas Agencies", "icon": "bolt",
     "education": "8th", "wage_basis": "monthly", "blurb": "Pump attendants, LPG delivery, gas agency staff",
     "roles": ["Petrol Pump Attendant", "Fuel Filler", "Petrol Pump Cashier", "Petrol Pump Manager",
               "LPG Delivery Man", "Gas Agency Staff", "CNG Station Attendant", "Air / Puncture Boy"],
     "skills": ["Fuel Dispensing", "Cash Handling", "UPI / Card Payments", "LPG Handling", "Safety Rules (Fuel)",
                "Puncture Repair"]},
    {"key": "tailoring", "name": "Tailoring & Boutique", "icon": "thread",
     "education": "none", "wage_basis": "piece_rate", "blurb": "Tailors, embroidery, alterations, boutiques",
     "roles": ["Tailor", "Ladies Tailor", "Gents Tailor", "Blouse Tailor", "Alteration Tailor",
               "Embroidery Worker", "Zari / Embroidery Artisan", "Boutique Helper", "Cutting Master"],
     "skills": ["Stitching", "Alterations", "Blouse Stitching", "Fabric Cutting", "Pattern Making",
                "Sewing Machine Operation", "Embroidery", "Measurement Taking"]},
    {"key": "dairy_poultry", "name": "Dairy, Poultry & Fisheries", "icon": "leaf",
     "education": "none", "wage_basis": "daily", "blurb": "Dairy farms, milk collection, poultry, fishing",
     "roles": ["Dairy Farm Worker", "Milkman (Doodhwala)", "Milk Collection Staff", "Cattle Caretaker",
               "Poultry Farm Worker", "Hatchery Worker", "Goat / Sheep Farm Worker", "Fishery Worker",
               "Fisherman", "Fish Seller"],
     "skills": ["Milking", "Cattle Feeding", "Milk Testing", "Poultry Care", "Egg Collection", "Fishing",
                "Fish Cleaning", "Animal Handling"]},
    {"key": "salon", "name": "Salon & Beauty Parlour", "icon": "sparkle",
     "education": "none", "wage_basis": "monthly", "blurb": "Barbers, beauticians, mehendi and makeup",
     "roles": ["Barber", "Hair Cutter", "Hair Stylist", "Beautician", "Beauty Parlour Helper", "Makeup Artist",
               "Bridal Makeup Artist", "Mehendi Artist", "Nail Technician", "Salon Receptionist"],
     "skills": ["Hair Cutting", "Shaving", "Hair Colouring", "Facial", "Threading", "Waxing", "Makeup",
                "Mehendi Design", "Manicure", "Pedicure"]},
    {"key": "municipal_services", "name": "Municipal & Civic Services", "icon": "building",
     "education": "8th", "wage_basis": "monthly", "blurb": "Sanitation, water supply, street lights, parks",
     "roles": ["Municipal Worker", "Municipal Sweeper", "Safai Karmachari", "Garbage Collector",
               "Garbage Truck Driver", "Drain Cleaner", "Valve Man (Water Supply)", "Pump House Operator",
               "Street Light Electrician", "Road Maintenance Worker", "Park Maintenance Worker",
               "Gardener (Municipal)", "Sanitary Inspector", "Municipal Clerk", "Fireman"],
     "skills": ["Street Sweeping", "Waste Collection", "Drain Cleaning (Municipal)", "Water Supply Operation",
                "Street Light Maintenance", "Road Repair", "Public Park Maintenance", "Safety Gear Usage"]},
]
