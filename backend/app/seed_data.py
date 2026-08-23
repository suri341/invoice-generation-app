from app.database import SessionLocal, init_db
from app.models.part import Part
from app.models.customer import Customer
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


RICE_MILL_PARTS = [
    {
        "name": "Rice Mill Shaft (Main)",
        "category": "Shafts",
        "description": "Heavy-duty main shaft for rice mill machinery",
        "unit": "Piece",
        "hsn_code": "84339000",
        "price": 15000.00,
        "image_url": "https://via.placeholder.com/150?text=Main+Shaft"
    },
    {
        "name": "Rice Mill Shaft (Secondary)",
        "category": "Shafts",
        "description": "Secondary shaft for rice mill processing",
        "unit": "Piece",
        "hsn_code": "84339000",
        "price": 8500.00,
        "image_url": "https://via.placeholder.com/150?text=Secondary+Shaft"
    },
    {
        "name": "Ball Bearing 6208",
        "category": "Bearings",
        "description": "Deep groove ball bearing for rice mill",
        "unit": "Piece",
        "hsn_code": "84821000",
        "price": 450.00,
        "image_url": "https://via.placeholder.com/150?text=Ball+Bearing"
    },
    {
        "name": "Roller Bearing 22208",
        "category": "Bearings",
        "description": "Spherical roller bearing for heavy load",
        "unit": "Piece",
        "hsn_code": "84822000",
        "price": 1250.00,
        "image_url": "https://via.placeholder.com/150?text=Roller+Bearing"
    },
    {
        "name": "V-Belt A-60",
        "category": "Belts & Pulleys",
        "description": "V-belt for power transmission",
        "unit": "Piece",
        "hsn_code": "40103100",
        "price": 350.00,
        "image_url": "https://via.placeholder.com/150?text=V-Belt"
    },
    {
        "name": "Cast Iron Pulley 12 inch",
        "category": "Belts & Pulleys",
        "description": "Heavy duty cast iron pulley",
        "unit": "Piece",
        "hsn_code": "84839000",
        "price": 2500.00,
        "image_url": "https://via.placeholder.com/150?text=Pulley"
    },
    {
        "name": "Electric Motor 5 HP",
        "category": "Motors",
        "description": "Three-phase electric motor 5 HP",
        "unit": "Piece",
        "hsn_code": "85015200",
        "price": 12000.00,
        "image_url": "https://via.placeholder.com/150?text=Motor+5HP"
    },
    {
        "name": "Electric Motor 10 HP",
        "category": "Motors",
        "description": "Three-phase electric motor 10 HP",
        "unit": "Piece",
        "hsn_code": "85015200",
        "price": 22000.00,
        "image_url": "https://via.placeholder.com/150?text=Motor+10HP"
    },
    {
        "name": "Rubber Roller (Husking)",
        "category": "Rubber Rollers",
        "description": "Rubber roller for paddy husking",
        "unit": "Piece",
        "hsn_code": "84379000",
        "price": 4500.00,
        "image_url": "https://via.placeholder.com/150?text=Rubber+Roller"
    },
    {
        "name": "Rubber Roller (Polishing)",
        "category": "Rubber Rollers",
        "description": "Polishing roller for rice finishing",
        "unit": "Piece",
        "hsn_code": "84379000",
        "price": 3800.00,
        "image_url": "https://via.placeholder.com/150?text=Polishing+Roller"
    },
    {
        "name": "Wire Mesh Screen 1.5mm",
        "category": "Screens & Sieves",
        "description": "Stainless steel wire mesh for rice sorting",
        "unit": "Square Meter",
        "hsn_code": "73144200",
        "price": 850.00,
        "image_url": "https://via.placeholder.com/150?text=Wire+Mesh"
    },
    {
        "name": "Wire Mesh Screen 2mm",
        "category": "Screens & Sieves",
        "description": "Stainless steel wire mesh for paddy sorting",
        "unit": "Square Meter",
        "hsn_code": "73144200",
        "price": 750.00,
        "image_url": "https://via.placeholder.com/150?text=Wire+Mesh+2mm"
    },
    {
        "name": "Centrifugal Blower 1 HP",
        "category": "Blowers & Fans",
        "description": "Centrifugal blower for husk removal",
        "unit": "Piece",
        "hsn_code": "84145900",
        "price": 8500.00,
        "image_url": "https://via.placeholder.com/150?text=Blower"
    },
    {
        "name": "Exhaust Fan 18 inch",
        "category": "Blowers & Fans",
        "description": "Heavy duty exhaust fan for ventilation",
        "unit": "Piece",
        "hsn_code": "84145100",
        "price": 3200.00,
        "image_url": "https://via.placeholder.com/150?text=Exhaust+Fan"
    },
    {
        "name": "Gear Box (Reduction 1:10)",
        "category": "Gears & Gear Boxes",
        "description": "Speed reduction gear box",
        "unit": "Piece",
        "hsn_code": "84834090",
        "price": 18000.00,
        "image_url": "https://via.placeholder.com/150?text=Gear+Box"
    },
    {
        "name": "Helical Gear Set",
        "category": "Gears & Gear Boxes",
        "description": "Helical gear set for smooth operation",
        "unit": "Set",
        "hsn_code": "84839000",
        "price": 6500.00,
        "image_url": "https://via.placeholder.com/150?text=Helical+Gear"
    },
    {
        "name": "Emery Stone (Cone Type)",
        "category": "Stones & Abrasives",
        "description": "Cone type emery stone for rice polishing",
        "unit": "Piece",
        "hsn_code": "68042200",
        "price": 2800.00,
        "image_url": "https://via.placeholder.com/150?text=Emery+Stone"
    },
    {
        "name": "Emery Stone (Cylinder Type)",
        "category": "Stones & Abrasives",
        "description": "Cylinder type emery stone for polishing",
        "unit": "Piece",
        "hsn_code": "68042200",
        "price": 3200.00,
        "image_url": "https://via.placeholder.com/150?text=Cylinder+Stone"
    },
    {
        "name": "Rice Mill Door Assembly",
        "category": "Accessories",
        "description": "Complete door assembly with hinges",
        "unit": "Set",
        "hsn_code": "84379000",
        "price": 4500.00,
        "image_url": "https://via.placeholder.com/150?text=Door+Assembly"
    },
    {
        "name": "Elevator Bucket (Heavy Duty)",
        "category": "Accessories",
        "description": "Heavy duty bucket for rice elevator",
        "unit": "Piece",
        "hsn_code": "84319000",
        "price": 180.00,
        "image_url": "https://via.placeholder.com/150?text=Elevator+Bucket"
    }
]


SAMPLE_CUSTOMERS = [
    {
        "name": "Ravi Kumar",
        "company_name": "Sri Lakshmi Rice Mills",
        "email": "ravi@srilakshmi.com",
        "phone": "9876543210",
        "address": "Plot No. 45, Industrial Area",
        "city": "Guntur",
        "state": "Andhra Pradesh",
        "pincode": "522004",
        "gstin": "37AABCS1234F1Z5"
    },
    {
        "name": "Suresh Reddy",
        "company_name": "Vijaya Rice Industries",
        "email": "suresh@vijayarice.com",
        "phone": "9988776655",
        "address": "NH-16, Vijayawada Road",
        "city": "Vijayawada",
        "state": "Andhra Pradesh",
        "pincode": "520008",
        "gstin": "37BBCDE5678G2Z6"
    },
    {
        "name": "Venkat Rao",
        "company_name": "Modern Rice Mill",
        "email": "venkat@modernrice.com",
        "phone": "8765432109",
        "address": "Bypass Road, Near Railway Station",
        "city": "Nellore",
        "state": "Andhra Pradesh",
        "pincode": "524001",
        "gstin": "37CDEFG9012H3Z7"
    }
]


def seed_database():
    logger.info("Initializing database...")
    init_db()

    db = SessionLocal()

    try:
        existing_parts = db.query(Part).count()
        if existing_parts > 0:
            logger.info(f"Database already has {existing_parts} parts. Skipping seed.")
            return

        logger.info("Seeding rice mill parts...")
        for part_data in RICE_MILL_PARTS:
            part = Part(**part_data)
            db.add(part)

        logger.info("Seeding sample customers...")
        for customer_data in SAMPLE_CUSTOMERS:
            customer = Customer(**customer_data)
            db.add(customer)

        db.commit()
        logger.info(f"✅ Successfully seeded {len(RICE_MILL_PARTS)} parts and {len(SAMPLE_CUSTOMERS)} customers!")

    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
