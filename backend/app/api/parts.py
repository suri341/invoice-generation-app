from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.part import Part
from app.schemas.part import PartCreate, PartUpdate, PartResponse

router = APIRouter()


@router.get("/", response_model=List[PartResponse])
def get_parts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Part)

    if category:
        query = query.filter(Part.category == category)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Part.name.ilike(search_pattern)) |
            (Part.description.ilike(search_pattern))
        )

    parts = query.offset(skip).limit(limit).all()
    return parts


@router.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Part.category).distinct().all()
    return [cat[0] for cat in categories if cat[0]]


@router.post("/", response_model=PartResponse, status_code=status.HTTP_201_CREATED)
def create_part(part: PartCreate, db: Session = Depends(get_db)):
    db_part = Part(**part.model_dump())
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part


@router.get("/{part_id}", response_model=PartResponse)
def get_part(part_id: int, db: Session = Depends(get_db)):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Part not found"
        )
    return part


@router.put("/{part_id}", response_model=PartResponse)
def update_part(
    part_id: int,
    part_update: PartUpdate,
    db: Session = Depends(get_db)
):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Part not found"
        )

    update_data = part_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(part, field, value)

    db.commit()
    db.refresh(part)
    return part


@router.delete("/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part(part_id: int, db: Session = Depends(get_db)):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Part not found"
        )

    db.delete(part)
    db.commit()
    return None
