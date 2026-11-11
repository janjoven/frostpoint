import os
import uuid

from fastapi import HTTPException, UploadFile

from ..config import settings

MAX_UPLOAD = 5 * 1024 * 1024
IMAGE_MAGIC = {b"\xff\xd8\xff": ".jpg", b"\x89PNG": ".png", b"RIFF": ".webp"}
PROOF_MAGIC = {**IMAGE_MAGIC, b"%PDF": ".pdf"}


async def store_upload(file: UploadFile, prefix: str, allow_pdf: bool = True) -> str:
    """Validate by file signature (not the client's filename), save under proofs_dir, return the stored name."""
    content = await file.read(MAX_UPLOAD + 1)
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (max 5 MB)")
    magic = PROOF_MAGIC if allow_pdf else IMAGE_MAGIC
    ext = next((e for m, e in magic.items() if content.startswith(m)), None)
    if not ext:
        raise HTTPException(415, "Only JPG, PNG, WebP or PDF files are allowed" if allow_pdf
                            else "Only JPG, PNG or WebP photos are allowed")
    os.makedirs(settings.proofs_dir, exist_ok=True)
    name = f"{prefix}-{uuid.uuid4().hex}{ext}"
    with open(os.path.join(settings.proofs_dir, name), "wb") as fh:
        fh.write(content)
    return name
