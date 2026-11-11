"""Idempotent seed: base catalog, rates and an admin; optional demo customers/orders."""
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select

from . import models
from .config import settings
from .db import SessionLocal
from .security import hash_password

PRODUCTS = [
    ("Crushed Ice", "Crushed Ice", "10", "kg", 500, "Fine crushed ice for drinks, coolers and fish.", "Best Seller", 5),
    ("Ice Block", "Ice Block", "350", "pc", 60, "Full-size ice block for events and fish preservation.", "", 1),
    ("Ice Tube", "Ice Tube", "10", "kg", 800, "Clear, hard-frozen ice tubes. Perfect for restaurants and stores.", "Popular", 5),
    ("Purified H2O", "Purified Water", "35", "gal", 120, "Purified refilling water, 5-gallon.", "", 1),
]
LOCATIONS = ["MASBATE CITY", "MOBO", "USON", "BALUD", "MILAGROS", "CATAINGAN", "PIO V. CORPUZ",
             "DIMASALANG", "CAWAYAN", "ESPERANZA", "PLACER"]
FLAT = {"MOBO": 150, "USON": 200, "BALUD": 220, "MILAGROS": 250, "CATAINGAN": 350, "PIO V. CORPUZ": 400,
        "DIMASALANG": 450, "CAWAYAN": 500, "ESPERANZA": 550, "PLACER": 600}


def run():
    with SessionLocal() as db:
        if not db.scalar(select(func.count()).select_from(models.Product)):
            for n, c, p, u, s, d, b, m in PRODUCTS:
                db.add(models.Product(name=n, category=c, price=Decimal(p), uom=u, stock=s, description=d, badge=b,
                                      min_order_qty=m))
            for loc in LOCATIONS:
                if loc == "MASBATE CITY":
                    db.add(models.IceBlockRate(location=loc, per_piece_rate=Decimal("50")))
                    for cat in ("Ice Tube", "Crushed Ice", "Purified Water"):
                        db.add(models.FixedDeliveryRate(location=loc, category=cat, fee=Decimal("12")))
                else:
                    db.add(models.IceBlockRate(location=loc, flat_fee=Decimal(FLAT[loc])))
        if not db.scalar(select(models.Account).where(models.Account.email == settings.seed_admin_email)):
            db.add(models.Account(email=settings.seed_admin_email, name="Frostpoint Admin", role="admin",
                                  password_hash=hash_password(settings.seed_admin_password)))
        db.commit()

        if settings.seed_demo and not db.scalar(select(func.count()).select_from(models.Order)):
            rnd = random.Random(7)
            cust = []
            for i, n in enumerate(["Juan Dela Cruz", "Maria Santos", "Pedro Reyes", "Ana Lopez"]):
                a = models.Account(email=f"customer{i + 1}@example.com", name=n, phone=f"0917000000{i}",
                                   address="Zone 3, Masbate City", password_hash=hash_password("Customer123!"))
                db.add(a)
                cust.append(a)
            staff = models.Account(email="staff@frostpoint.ph", name="Rico Staff", role="staff",
                                   password_hash=hash_password("Staff12345!"))
            db.add(staff)
            db.add(models.Account(email="rider@frostpoint.ph", name="Ramil Rider", role="rider", phone="09170000099",
                                  password_hash=hash_password("Rider12345!")))
            db.commit()
            prods = db.scalars(select(models.Product)).all()
            statuses = ["Delivered Successfully"] * 6 + ["Order Placed", "Order Confirmed", "Preparing",
                                                         "Out for Delivery", "Cancelled"]
            path = ["Order Placed", "Order Confirmed", "Preparing", "Out for Delivery", "Delivered Successfully"]
            for i in range(60):
                c = rnd.choice(cust)
                when = datetime.now(timezone.utc) - timedelta(days=rnd.randint(0, 40), hours=rnd.randint(0, 20))
                chosen = rnd.sample(prods, rnd.randint(1, 3))
                o = models.Order(customer_id=c.id, receiver_name=c.name, phone=c.phone, address=c.address,
                                 location="MASBATE CITY", mode=rnd.choice(["delivery", "delivery", "pickup"]),
                                 payment_method=rnd.choice(["COD", "GCash", "Maya"]), created_at=when,
                                 subtotal=0, delivery_fee=0, total=0, status=rnd.choice(statuses))
                sub = Decimal(0)
                for p in chosen:
                    q = rnd.randint(p.min_order_qty, p.min_order_qty + 10 if p.price < 100 else 3)
                    o.items.append(models.OrderItem(product_id=p.id, name=p.name, category=p.category,
                                                    price=p.price, qty=q))
                    sub += p.price * q
                fee = Decimal(0) if o.mode == "pickup" else Decimal(12 * len(chosen))
                o.subtotal, o.delivery_fee, o.total = sub, fee, sub + fee
                if o.status == "Cancelled":
                    o.cancel_reason = "Customer request"
                    o.events.append(models.OrderEvent(status="Order Placed", at=when))
                    o.events.append(models.OrderEvent(status="Cancelled", at=when + timedelta(minutes=30)))
                else:
                    for n, st in enumerate(path[:path.index(o.status) + 1]):
                        o.events.append(models.OrderEvent(status=st, at=when + timedelta(minutes=25 * n)))
                o.payment_status = ("paid" if o.status == "Delivered Successfully"
                                    else "cod_due" if o.payment_method == "COD" else "unpaid")
                db.add(o)
            db.add(models.Announcement(title="Summer Ice Promo", message="Free delivery on orders over ₱500 this week!",
                                       ends_at=datetime.now(timezone.utc) + timedelta(days=7)))
            db.commit()


if __name__ == "__main__":
    run()
