"""SQLite (SQLAlchemy) storage for user-owned data only.

Research facts are never written here: they live in research/*.md. Personal rows
reference research entities by their stable string id, so re-importing Markdown
never touches them. Every user-owned table carries user_id so accounts can be
added later without a schema rewrite (the MVP uses the single user "local").
Plain SQLAlchemy types keep the move to PostgreSQL a DATABASE_URL change.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.types import TypeDecorator

LOCAL_USER_ID = "local"

PROGRESS_STAGES = ["wishlist", "planned", "tried", "finalist", "purchased"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops tzinfo; store UTC and always hand back aware datetimes."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc) if value is not None else None

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ModelProgress(Base):
    """Current 도장 stage of one model for one user."""

    __tablename__ = "model_progress"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    model_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    stage: Mapped[str] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ProgressEvent(Base):
    """Append-only stamp log: when each stage was stamped (or cleared)."""

    __tablename__ = "progress_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[str] = mapped_column(String(10))  # model | store
    target_id: Mapped[str] = mapped_column(String(200))
    stage: Mapped[str] = mapped_column(String(20))  # a PROGRESS_STAGES value, "visited", or "cleared"
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class StoreVisit(Base):
    __tablename__ = "store_visits"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    store_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    visited_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class PersonalNote(Base):
    __tablename__ = "personal_notes"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    model_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    memo: Mapped[str] = mapped_column(Text, default="")
    feel_note: Mapped[str] = mapped_column(Text, default="")
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class PersonalQuote(Base):
    """A quote the user received. Kept apart from researched prices on purpose."""

    __tablename__ = "personal_quotes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    model_id: Mapped[str] = mapped_column(String(200), index=True)
    amount_krw: Mapped[int] = mapped_column(Integer)
    size_or_option: Mapped[str] = mapped_column(String(100), default="")
    quoted_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    place: Mapped[str] = mapped_column(String(200), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class LinkCheck(Base):
    """Result of `import_research.py --check-links`; merged into API output as link_status."""

    __tablename__ = "link_checks"
    url: Mapped[str] = mapped_column(String(2000), primary_key=True)
    status: Mapped[str] = mapped_column(String(10))  # ok | dead | error
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str] = mapped_column(Text, default="")
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ImagePreview(Base):
    """og:image found on a model's own official page (`import_research.py --fetch-previews`).

    Only the remote URL is stored — the image itself is never downloaded or re-hosted.
    """

    __tablename__ = "image_previews"
    page_url: Mapped[str] = mapped_column(String(2000), primary_key=True)
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(10))  # ok | none | error
    detail: Mapped[str] = mapped_column(Text, default="")
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite:///"):
        from pathlib import Path

        db_path = url.removeprefix("sqlite:///")
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        extra = {"poolclass": StaticPool} if db_path in ("", ":memory:") else {}
        engine = create_engine(url, connect_args={"check_same_thread": False}, **extra)

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # pragma: no cover - trivial
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    return create_engine(url, pool_pre_ping=True)


def init_db(engine: Engine) -> sessionmaker:
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as s:
        if s.get(User, LOCAL_USER_ID) is None:
            s.add(User(id=LOCAL_USER_ID, display_name="우리 집"))
            s.commit()
    return factory
