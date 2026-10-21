"""Process-wide state: loaded research data, DB session factory, optional file watcher."""

from __future__ import annotations

import asyncio
import logging
import threading
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from .catalog import Ctx
from .config import Settings
from .db import LinkCheck, init_db, make_engine
from .research.loader import ResearchData, load_research

log = logging.getLogger("salimmon")


class AppState:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.engine = make_engine(settings.database_url)
        self.sessions: sessionmaker = init_db(self.engine)
        self._lock = threading.Lock()
        self.data: ResearchData = load_research(settings.research_dir)
        self.links: dict[str, dict] = {}
        self.reload_links()
        self._log_report()

    def reload(self) -> ResearchData:
        """Re-read every Markdown file. Personal data in SQLite is untouched."""
        fresh = load_research(self.settings.research_dir)
        with self._lock:
            self.data = fresh
        self.reload_links()
        self._log_report()
        return fresh

    def reload_links(self) -> None:
        with self.sessions() as s:
            rows = s.scalars(select(LinkCheck)).all()
        self.links = {r.url: {"status": r.status, "checked_at": r.checked_at} for r in rows}

    def ctx(self) -> Ctx:
        return Ctx(today=date.today(), stale_days=self.settings.stale_price_days, links=self.links)

    def _log_report(self) -> None:
        rep = self.data.report()
        log.info(
            "research loaded from %s: %s (errors=%d warnings=%d)",
            rep["research_dir"], rep["counts"], rep["summary"]["error"], rep["summary"]["warning"],
        )
        for issue in self.data.issues:
            if issue.severity == "error":
                log.warning("invalid research MD %s [%s]: %s", issue.path, issue.field, issue.message)

    async def watch(self) -> None:
        """Reload when files under research/ change (dev convenience, RESEARCH_WATCH=true)."""
        from watchfiles import awatch

        root = self.settings.research_dir
        if not root.is_dir():
            log.warning("research watch disabled: %s does not exist", root)
            return
        log.info("watching %s for Markdown changes", root)
        # Reload on any change: deleting or moving a directory reports only the
        # directory path, and a full reload is cheap enough at this data size.
        async for _changes in awatch(root, debounce=800):
            await asyncio.to_thread(self.reload)
