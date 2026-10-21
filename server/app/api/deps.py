from __future__ import annotations

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.orm import Session

from ..db import LOCAL_USER_ID
from ..state import AppState


def get_state(request: Request) -> AppState:
    return request.app.state.salimmon


def get_session(request: Request) -> Iterator[Session]:
    with get_state(request).sessions() as session:
        yield session


def current_user_id() -> str:
    # Single local user for the MVP. Swap this dependency for real auth later.
    return LOCAL_USER_ID
