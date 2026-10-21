"""User-owned data: 도장(progress), store visits, notes, ratings and personal quotes.

Records are keyed by research ids. If a research entity disappears from the
Markdown, its personal rows are kept and reported with orphaned=true.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import (
    PROGRESS_STAGES,
    ModelProgress,
    PersonalNote,
    PersonalQuote,
    ProgressEvent,
    StoreVisit,
    utcnow,
)
from ..state import AppState
from .deps import current_user_id, get_session, get_state

router = APIRouter(prefix="/api")

Stage = Literal["wishlist", "planned", "tried", "finalist", "purchased"]


class ProgressUpdate(BaseModel):
    target_type: Literal["model", "store"]
    target_id: str = Field(min_length=1)
    stage: Stage | None = None  # model only; null clears the model's stamps
    visited: bool | None = None  # store only
    visited_on: date | None = None

    @model_validator(mode="after")
    def _shape(self) -> "ProgressUpdate":
        if self.target_type == "store" and self.visited is None:
            raise ValueError("store 진행 상태에는 visited(true/false)가 필요합니다")
        return self


class QuoteIn(BaseModel):
    amount_krw: int = Field(gt=0)
    size_or_option: str = ""
    quoted_on: date | None = None
    place: str = ""
    note: str = ""


class NoteUpdate(BaseModel):
    model_id: str = Field(min_length=1)
    memo: str = ""
    feel_note: str = ""
    rating: int | None = Field(None, ge=1, le=5)
    quotes: list[QuoteIn] = []


def _progress_payload(state: AppState, session: Session, user_id: str) -> dict:
    data = state.data
    models = session.scalars(select(ModelProgress).where(ModelProgress.user_id == user_id)).all()
    visits = session.scalars(select(StoreVisit).where(StoreVisit.user_id == user_id)).all()
    events = session.scalars(
        select(ProgressEvent).where(ProgressEvent.user_id == user_id).order_by(ProgressEvent.id.desc())
    ).all()

    # First time each (model, stage) was stamped — shown as the date on the stamp.
    stamped: dict[str, dict[str, datetime]] = {}
    for ev in reversed(events):
        if ev.target_type != "model":
            continue
        if ev.stage == "cleared":
            stamped.pop(ev.target_id, None)
        else:
            stamped.setdefault(ev.target_id, {}).setdefault(ev.stage, ev.created_at)

    model_rows = []
    for row in models:
        m = data.model(row.model_id)
        brand = data.brand(m.brand_id) if m else None
        current = PROGRESS_STAGES.index(row.stage)
        model_rows.append({
            "model_id": row.model_id,
            "stage": row.stage,
            "stage_index": current,
            "updated_at": row.updated_at,
            "stamps": [
                {"stage": st, "reached": i <= current, "stamped_at": stamped.get(row.model_id, {}).get(st)}
                for i, st in enumerate(PROGRESS_STAGES)
            ],
            "orphaned": m is None,
            "model_name": m.name if m else None,
            "brand_name": brand.name if brand else None,
            "category_id": m.category_id if m else None,
            "product_kind": m.product_kind if m else None,
        })
    store_rows = []
    for v in visits:
        s = data.store(v.store_id)
        store_rows.append({
            "store_id": v.store_id,
            "visited_on": v.visited_on,
            "created_at": v.created_at,
            "orphaned": s is None,
            "store_name": s.name if s else None,
            "category_ids": s.category_ids if s else [],
        })

    def label(ev: ProgressEvent) -> str | None:
        if ev.target_type == "model":
            m = data.model(ev.target_id)
            return m.name if m else None
        s = data.store(ev.target_id)
        return s.name if s else None

    return {
        "stages": PROGRESS_STAGES,
        "models": model_rows,
        "stores": store_rows,
        "events": [
            {"id": e.id, "target_type": e.target_type, "target_id": e.target_id, "stage": e.stage,
             "created_at": e.created_at, "target_name": label(e)}
            for e in events[:100]
        ],
    }


@router.get("/progress")
def get_progress(
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    return _progress_payload(state, session, user_id)


@router.put("/progress")
def put_progress(
    body: ProgressUpdate,
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    data = state.data
    now = utcnow()
    if body.target_type == "model":
        if not data.model(body.target_id):
            raise HTTPException(404, f"model '{body.target_id}' not found")
        row = session.get(ModelProgress, (user_id, body.target_id))
        if body.stage is None:
            if row:
                session.delete(row)
                session.add(ProgressEvent(user_id=user_id, target_type="model", target_id=body.target_id, stage="cleared", created_at=now))
        elif row is None or row.stage != body.stage:
            if row is None:
                session.add(ModelProgress(user_id=user_id, model_id=body.target_id, stage=body.stage, updated_at=now))
            else:
                row.stage, row.updated_at = body.stage, now
            session.add(ProgressEvent(user_id=user_id, target_type="model", target_id=body.target_id, stage=body.stage, created_at=now))
    else:
        if not data.store(body.target_id):
            raise HTTPException(404, f"store '{body.target_id}' not found")
        visit = session.get(StoreVisit, (user_id, body.target_id))
        if body.visited:
            if visit is None:
                session.add(StoreVisit(user_id=user_id, store_id=body.target_id, visited_on=body.visited_on or date.today(), created_at=now))
                session.add(ProgressEvent(user_id=user_id, target_type="store", target_id=body.target_id, stage="visited", created_at=now))
            elif body.visited_on:
                visit.visited_on = body.visited_on
        elif visit is not None:
            session.delete(visit)
            session.add(ProgressEvent(user_id=user_id, target_type="store", target_id=body.target_id, stage="cleared", created_at=now))
    session.commit()
    return _progress_payload(state, session, user_id)


def _note_payload(state: AppState, session: Session, user_id: str, model_id: str) -> dict:
    note = session.get(PersonalNote, (user_id, model_id))
    quotes = session.scalars(
        select(PersonalQuote)
        .where(PersonalQuote.user_id == user_id, PersonalQuote.model_id == model_id)
        .order_by(PersonalQuote.quoted_on.desc().nullslast(), PersonalQuote.id.desc())
    ).all()
    m = state.data.model(model_id)
    return {
        "model_id": model_id,
        "model_name": m.name if m else None,
        "category_id": m.category_id if m else None,
        "orphaned": m is None,
        "memo": note.memo if note else "",
        "feel_note": note.feel_note if note else "",
        "rating": note.rating if note else None,
        "updated_at": note.updated_at if note else None,
        "quotes": [
            {"id": q.id, "amount_krw": q.amount_krw, "size_or_option": q.size_or_option,
             "quoted_on": q.quoted_on, "place": q.place, "note": q.note}
            for q in quotes
        ],
    }


@router.get("/personal-notes")
def get_notes(
    model_id: str | None = None,
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    if model_id:
        return {"items": [_note_payload(state, session, user_id, model_id)]}
    ids = set(session.scalars(select(PersonalNote.model_id).where(PersonalNote.user_id == user_id)).all())
    ids |= set(session.scalars(select(PersonalQuote.model_id).where(PersonalQuote.user_id == user_id)).all())
    return {"items": [_note_payload(state, session, user_id, mid) for mid in sorted(ids)]}


@router.put("/personal-notes")
def put_note(
    body: NoteUpdate,
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    if not state.data.model(body.model_id):
        raise HTTPException(404, f"model '{body.model_id}' not found")
    note = session.get(PersonalNote, (user_id, body.model_id))
    if note is None:
        note = PersonalNote(user_id=user_id, model_id=body.model_id)
        session.add(note)
    note.memo, note.feel_note, note.rating, note.updated_at = body.memo, body.feel_note, body.rating, utcnow()
    # The quote list is replaced as a whole: the client always sends the full list.
    session.execute(delete(PersonalQuote).where(PersonalQuote.user_id == user_id, PersonalQuote.model_id == body.model_id))
    for q in body.quotes:
        session.add(PersonalQuote(user_id=user_id, model_id=body.model_id, **q.model_dump()))
    session.commit()
    return _note_payload(state, session, user_id, body.model_id)
