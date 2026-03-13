from uuid import UUID
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_business_id
from app.services.pdf_service import (
    generate_invoice_pdf,
    generate_cashup_pdf,
    generate_purchase_order_pdf
)

router = APIRouter(prefix="/pdf", tags=["PDF"])

@router.get("/invoice/{invoice_id}")
async def get_invoice_pdf(
    invoice_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    pdf_bytes, filename = await generate_invoice_pdf(invoice_id, business_id, db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get("/purchase-order/{po_id}")
async def get_purchase_order_pdf(
    po_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    pdf_bytes, filename = await generate_purchase_order_pdf(po_id, business_id, db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get("/cashup/{shift_id}")
async def get_cashup_pdf(
    shift_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    pdf_bytes, filename = await generate_cashup_pdf(shift_id, business_id, db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
