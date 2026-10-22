from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import delete

from ..database import get_db
from ..models.item import Item
from ..config import settings

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
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    results = db.execute(
        delete(Item).where(Item.is_deleted == True, Item.deleted_at < cutoff)
    )
    db.commit()

    return {"purged_count": results.rowcount}
