#!/usr/bin/env python3
"""Validate research Markdown and (optionally) sync it into the running server.

Examples (run from server/):
  python scripts/import_research.py                      # validate research/, print report
  python scripts/import_research.py --research-dir samples/research --json
  python scripts/import_research.py --reload-url http://localhost:8000   # validate, then hot-reload the API
  python scripts/import_research.py --check-links        # HTTP-check every source URL, store results in SQLite
  python scripts/import_research.py --write-requests     # write research_requests.md (missing facts)

Exit code is 1 when any file has an error (or a warning with --fail-on-warning).
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import REPO_ROOT, _resolve, load_settings  # noqa: E402
from app.db import LinkCheck, init_db, make_engine  # noqa: E402
from app.research.loader import ResearchData, load_research  # noqa: E402
from app.research.requests import build_requests_md  # noqa: E402

COLORS = {"error": "\033[31m", "warning": "\033[33m", "info": "\033[36m"}
RESET = "\033[0m"


def print_report(data: ResearchData, verbose: bool) -> None:
    rep = data.report()
    tty = sys.stdout.isatty()
    print(f"조사 디렉터리: {rep['research_dir']}")
    print(f"검사한 파일: {rep['files_scanned']}  적재: " + ", ".join(f"{k}={v}" for k, v in rep["counts"].items()))
    s = rep["summary"]
    print(f"오류 {s['error']} · 경고 {s['warning']} · 정보 {s['info']}")
    for issue in data.issues:
        if issue.severity == "info" and not verbose:
            continue
        tag = issue.severity.upper()
        if tty:
            tag = f"{COLORS[issue.severity]}{tag}{RESET}"
        print(f"  {tag:<8} {issue.path} [{issue.field}] {issue.message}")
    if s["info"] and not verbose:
        print("  (정보 항목은 -v 로 표시)")


def collect_urls(data: ResearchData) -> set[str]:
    urls: set[str] = set()
    for table in (data.brands, data.models, data.stores, data.reviews):
        for entry in table.values():
            e = entry.entity
            for attr in ("official_url", "warranty_source_url", "official_store_url", "map_url", "source_url"):
                if (v := getattr(e, attr, None)):
                    urls.add(v)
            for src in getattr(e, "source_urls", []) + getattr(e, "sources", []):
                urls.add(src.url)
            for p in getattr(e, "prices", []):
                urls.add(p.source_url)
            for c in getattr(e, "pros", []) + getattr(e, "cons", []):
                if c.source_url:
                    urls.add(c.source_url)
            img = getattr(e, "image", None)
            if img and img.image_source_url:
                urls.add(img.image_source_url)
    return urls


def check_one(client: httpx.Client, url: str) -> tuple[str, str, int | None, str]:
    try:
        resp = client.head(url)
        if resp.status_code in (403, 405) or resp.status_code >= 500:
            resp = client.get(url)
        status = "ok" if resp.status_code < 400 else "dead"
        return url, status, resp.status_code, ""
    except httpx.HTTPError as exc:
        return url, "error", None, type(exc).__name__


def check_links(data: ResearchData, database_url: str) -> None:
    urls = sorted(collect_urls(data))
    print(f"링크 {len(urls)}개 확인 중...")
    factory = init_db(make_engine(database_url))
    headers = {"User-Agent": "salimmon-link-check/1.0"}
    with httpx.Client(follow_redirects=True, timeout=10, headers=headers) as client, ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda u: check_one(client, u), urls))
    now = datetime.now(timezone.utc)
    with factory() as s:
        for url, status, code, detail in results:
            s.merge(LinkCheck(url=url, status=status, http_status=code, detail=detail, checked_at=now))
        s.commit()
    bad = [r for r in results if r[1] != "ok"]
    print(f"정상 {len(results) - len(bad)} · 문제 {len(bad)} (기록은 유지되고 API에 link_status로 표시됩니다)")
    for url, status, code, detail in bad:
        print(f"  {status:<5} {code or '-'} {url} {detail}")


def main() -> int:
    settings = load_settings()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--research-dir", type=_resolve, default=settings.research_dir)
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    ap.add_argument("-v", "--verbose", action="store_true", help="include info-level issues")
    ap.add_argument("--fail-on-warning", action="store_true")
    ap.add_argument("--reload-url", help="base URL of a running server to hot-reload after validation")
    ap.add_argument("--check-links", action="store_true")
    ap.add_argument(
        "--write-requests", nargs="?", const=str(REPO_ROOT / "research_requests.md"), metavar="PATH",
        help="write the missing-facts request list (default: <repo>/research_requests.md)",
    )
    args = ap.parse_args()

    data = load_research(args.research_dir)
    if args.json:
        print(json.dumps(data.report(), ensure_ascii=False, indent=2))
    else:
        print_report(data, args.verbose)

    if args.write_requests:
        Path(args.write_requests).write_text(build_requests_md(data), encoding="utf-8")
        print(f"조사 요청 목록 작성: {args.write_requests}")

    if args.check_links:
        check_links(data, settings.database_url)

    if args.reload_url:
        try:
            resp = httpx.post(args.reload_url.rstrip("/") + "/api/admin/reload", timeout=30)
            resp.raise_for_status()
            print(f"서버 재적재 완료: {resp.json()['counts']}")
        except httpx.HTTPError as exc:
            print(f"서버 재적재 실패: {exc}", file=sys.stderr)
            return 2

    summary = data.report()["summary"]
    if summary["error"] or (args.fail_on_warning and summary["warning"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
