import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


def normalize_phone(value: str) -> str:
    digits = re.sub(r"[\s\-()]", "", value or "")
    if digits.startswith("+63"):
        digits = "0" + digits[3:]
    elif digits.startswith("63") and len(digits) == 12:
        digits = "0" + digits[2:]
    if not re.fullmatch(r"09\d{9}", digits):
        raise ValueError("Enter a valid PH mobile number (09XXXXXXXXX)")
    return digits


# Loose box around the Philippines: catches a pin dropped on the wrong continent or a swapped lat/lng.
PH_LAT, PH_LNG = (4.5, 21.5), (116.0, 127.0)


def check_pin(lat: float | None, lng: float | None):
    if (lat is None) != (lng is None):
        raise ValueError("Send both latitude and longitude, or neither")
    if lat is not None and not (PH_LAT[0] <= lat <= PH_LAT[1] and PH_LNG[0] <= lng <= PH_LNG[1]):
        raise ValueError("That pin is outside the Philippines")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str
    address: str = ""

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AccountOut(ORM):
    id: int
    email: str
    name: str
    role: str
    phone: str
    address: str
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    user: AccountOut


class AccountUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    is_active: bool | None = None
    role: str | None = None


class TeamMemberIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "staff"


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str
    price: Decimal = Field(ge=0)
    uom: str = "pc"
    stock: int = Field(ge=0, default=0)
    description: str = ""
    image_url: str = ""
    badge: str = ""
    min_order_qty: int = Field(ge=1, default=1)
    low_stock_at: int = Field(ge=0, default=20)
    is_active: bool = True


class ProductOut(ProductIn, ORM):
    id: int


class StockIn(BaseModel):
    stock: int = Field(ge=0)


class IceBlockRateIn(BaseModel):
    location: str
    per_piece_rate: Decimal | None = None
    flat_fee: Decimal | None = None


class IceBlockRateOut(IceBlockRateIn, ORM):
    id: int


class FixedRateIn(BaseModel):
    location: str
    category: str
    fee: Decimal = Field(ge=0)


class FixedRateOut(FixedRateIn, ORM):
    id: int


class AddressIn(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    location: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=1, max_length=300)
    lat: float | None = None
    lng: float | None = None
    is_default: bool = False

    @model_validator(mode="after")
    def _pin(self):
        check_pin(self.lat, self.lng)
        return self


class AddressOut(AddressIn, ORM):
    id: int


class CartLine(BaseModel):
    product_id: int
    qty: int = Field(ge=1, le=10000)


class QuoteIn(BaseModel):
    items: list[CartLine] = Field(min_length=1)
    mode: str = "delivery"
    location: str = ""


class QuoteOut(BaseModel):
    subtotal: Decimal
    delivery_fee: Decimal
    total: Decimal
    free_delivery_threshold: Decimal
    notes: list[str] = []


class OrderIn(QuoteIn):
    receiver_name: str = Field(min_length=2, max_length=120)
    phone: str
    address: str = ""
    schedule_at: datetime | None = None
    payment_method: str = "COD"
    payment_ref: str = ""
    notes: str = ""
    dest_lat: float | None = None
    dest_lng: float | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @model_validator(mode="after")
    def _pin(self):
        check_pin(self.dest_lat, self.dest_lng)
        return self


class OrderItemOut(ORM):
    product_id: int | None
    name: str
    category: str
    price: Decimal
    qty: int


class RiderOut(ORM):
    id: int
    name: str
    phone: str


class RiderAssignIn(BaseModel):
    rider_id: int | None = None


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


class RiderItemOut(ORM):
    name: str
    qty: int


class RiderOrderOut(BaseModel):
    """What a rider sees: where to go, what to bring, what to collect. No prices or customer account data."""
    id: int
    status: str
    receiver_name: str
    phone: str
    address: str
    location: str
    notes: str
    schedule_at: datetime | None
    payment_method: str
    payment_status: str
    cash_to_collect: Decimal
    dest_lat: float | None = None
    dest_lng: float | None = None
    accepted_at: datetime | None
    created_at: datetime
    items: list[RiderItemOut]


class OrderEventOut(ORM):
    status: str
    at: datetime


class PaymentIn(BaseModel):
    payment_status: str


class OrderOut(ORM):
    id: int
    customer_id: int
    customer_name: str = ""
    receiver_name: str
    phone: str
    address: str
    location: str
    mode: str
    schedule_at: datetime | None
    payment_method: str
    payment_ref: str
    payment_status: str = "unpaid"
    has_proof: bool = False
    has_delivery_proof: bool = False
    dest_lat: float | None = None
    dest_lng: float | None = None
    rider_id: int | None = None
    rider_name: str = ""
    rider_accepted_at: datetime | None = None
    notes: str
    subtotal: Decimal
    delivery_fee: Decimal
    total: Decimal
    status: str
    cancel_reason: str
    created_at: datetime
    items: list[OrderItemOut]
    events: list[OrderEventOut] = []


class RiderPosOut(BaseModel):
    name: str
    lat: float
    lng: float
    accuracy: float | None
    updated_at: datetime
    stale: bool


class RouteOut(BaseModel):
    coords: list[list[float]]
    distance_m: float
    source: str  # "road" from the routing service, "straight" when it is unavailable


class TrackOut(BaseModel):
    status: str
    dest: dict | None = None
    rider: RiderPosOut | None = None
    route: RouteOut | None = None
    eta_minutes: int | None = None


class StatusIn(BaseModel):
    status: str
    reason: str = ""


class ScheduleIn(BaseModel):
    schedule_at: datetime


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AnnouncementOut(AnnouncementIn, ORM):
    id: int
    starts_at: datetime
    created_at: datetime
    live: bool = False


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(ORM):
    id: int
    sender: str
    body: str
    is_read: bool
    created_at: datetime


class ThreadOut(BaseModel):
    id: int
    customer_name: str
    last_message: str
    updated_at: datetime
    unread: int


class LogOut(ORM):
    id: int
    action: str
    entity: str
    description: str
    user_name: str
    user_email: str
    meta: dict
    created_at: datetime
