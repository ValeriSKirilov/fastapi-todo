from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.item import Item

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
)


def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal key",
        )


@router.post("/purge-deleted")
def purge_deleted_items(
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_key),
):
    cutoff = datetime.now(UTC) - timedelta(days=30)

    results = db.execute(
        delete(Item).where(Item.is_deleted == True, Item.deleted_at < cutoff)
    )
    db.commit()

    return {"purged_count": results.rowcount}
