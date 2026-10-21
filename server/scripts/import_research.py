#!/usr/bin/env python3
"""Validate research Markdown and (optionally) sync it into the running server.

Examples (run from server/):
  python scripts/import_research.py                      # validate research/, print report
  python scripts/import_research.py --research-dir samples/research --json
  python scripts/import_research.py --reload-url http://localhost:8000   # validate, then hot-reload the API
  python scripts/import_research.py --check-links        # HTTP-check every source URL, store results in SQLite
  python scripts/import_research.py --write-requests     # write research_requests.md (missing facts)
  python scripts/import_research.py --fetch-previews     # find og:image on model-specific official pages
  python scripts/import_research.py --fetch-previews --render   # + headless Chromium for JS-rendered shops

Exit code is 1 when any file has an error (or a warning with --fail-on-warning).
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import REPO_ROOT, _resolve, load_settings  # noqa: E402
from app.catalog import preview_page  # noqa: E402
from app.db import ImagePreview, LinkCheck, init_db, make_engine  # noqa: E402
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


META_RE = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
ATTR_RE = re.compile(r'(property|name|content)\s*=\s*("([^"]*)"|\'([^\']*)\')', re.IGNORECASE)


def find_og_image(page_html: str, base_url: str) -> str | None:
    found: dict[str, str] = {}
    for tag in META_RE.findall(page_html):
        attrs = {m.group(1).lower(): (m.group(3) if m.group(3) is not None else m.group(4)) for m in ATTR_RE.finditer(tag)}
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in ("og:image", "og:image:secure_url", "twitter:image") and attrs.get("content"):
            found.setdefault(key, html.unescape(attrs["content"].strip()))
    url = found.get("og:image:secure_url") or found.get("og:image") or found.get("twitter:image")
    if not url:
        return None
    url = urljoin(base_url, url)
    return url if url.startswith(("https://", "http://")) else None


GENERIC_IMAGE_RE = re.compile(r"(thumbnail|^og[_-]|default|share)")


def find_product_og_image(page_html: str, base_url: str) -> str | None:
    """Like find_og_image, but skips logo/generic og:image tags when a page has several."""
    urls = []
    for tag in META_RE.findall(page_html):
        attrs = {m.group(1).lower(): (m.group(3) if m.group(3) is not None else m.group(4)) for m in ATTR_RE.finditer(tag)}
        if (attrs.get("property") or attrs.get("name") or "").lower() == "og:image" and attrs.get("content"):
            urls.append(urljoin(base_url, html.unescape(attrs["content"].strip())))
    for url in urls:
        name = url.rsplit("/", 1)[-1].lower()
        if url.startswith(("https://", "http://")) and "logo" not in url.lower() and not GENERIC_IMAGE_RE.search(name):
            return url
    return find_og_image(page_html, base_url)


IMG_SRC_RE = re.compile(r"<img\b[^>]*?\s(?:data-src|src)\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)
PRODUCT_PATH_RE = re.compile(r"/(products?|goods|items?)/", re.IGNORECASE)


IMAGE_MAGIC = (b"\xff\xd8\xff", b"\x89PNG", b"GIF8")


def _width(url: str) -> int:
    w = httpx.URL(url).params.get("w") or httpx.URL(url).params.get("width")
    return int(w) if w and w.isdigit() else 10**6  # no resize parameter = original size


def page_product_images(page_html: str, base_url: str) -> list[str]:
    """<img> URLs on the page whose path looks like a product image, in page order.

    Resized variants of one file (?w=68, ?w=960) collapse into the largest one.
    """
    best: dict[str, str] = {}
    for src in IMG_SRC_RE.findall(page_html):
        url = urljoin(base_url, html.unescape(src.strip()))
        if not url.startswith(("https://", "http://")) or "logo" in url.lower():
            continue
        if not PRODUCT_PATH_RE.search(httpx.URL(url).path):
            continue
        key = url.split("?", 1)[0]
        if key not in best or _width(url) > _width(best[key]):
            best[key] = url
    return list(best.values())


def pick_page_image(candidates: list[str], elsewhere: set[str], og_name: str | None) -> list[str]:
    """Product images unique to this page (not site chrome shared with other pages); the one
    carrying the og:image file name first."""
    unique = [u for u in candidates if u not in elsewhere]
    if og_name:
        unique.sort(key=lambda u: httpx.URL(u).path.rsplit("/", 1)[-1].lower() != og_name)
    return unique


def render_og_images(pages: list[str]) -> dict[str, list[str]]:
    """og:image tags after client-side rendering (headless Chromium via client/node_modules)."""
    node = shutil.which("node") or str(Path.home() / ".local/opt/node/bin/node")
    script = Path(__file__).with_name("render_og.mjs")
    try:
        out = subprocess.run([node, str(script), *pages], capture_output=True, text=True, timeout=60 + 40 * len(pages))
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"  브라우저 렌더링 실패: {exc}", file=sys.stderr)
        return {}
    if out.returncode != 0:
        print(f"  브라우저 렌더링 실패: {out.stderr.strip()[-300:]}", file=sys.stderr)
    rendered = {}
    for line in out.stdout.splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        rendered[row["url"]] = [urljoin(row["url"], u) for u in row.get("og", []) if u]
    return rendered


def fetch_previews(data: ResearchData, database_url: str, render: bool = False) -> None:
    pages = sorted({p for e in data.models.values() if (p := preview_page(data, e.entity))})  # type: ignore[arg-type]
    print(f"모델 전용 공식 페이지 {len(pages)}개에서 대표 이미지(og:image) 확인 중... (공유 페이지·홈페이지는 제외)")
    headers = {"User-Agent": "Mozilla/5.0 (salimmon preview check)", "Accept-Language": "ko-KR,ko;q=0.9"}

    page_imgs: dict[str, list[str]] = {}

    def one(client: httpx.Client, page: str) -> tuple[str, str | None, str, str]:
        try:
            resp = client.get(page)
            if resp.status_code >= 400:
                return page, None, "error", f"HTTP {resp.status_code}"
            text = resp.text[:1_000_000]
            page_imgs[page] = page_product_images(text, str(resp.url))
            img = find_product_og_image(text, str(resp.url))
            return page, img, ("ok" if img else "none"), ""
        except httpx.HTTPError as exc:
            return page, None, "error", type(exc).__name__

    def site_default(client: httpx.Client, page: str) -> str | None:
        root = "{0.scheme}://{0.netloc}/".format(httpx.URL(page))
        try:
            resp = client.get(root)
            return find_og_image(resp.text[:500_000], str(resp.url)) if resp.status_code < 400 else None
        except httpx.HTTPError:
            return None

    def image_target(client: httpx.Client, url: str) -> str | None:
        """Follows redirects by hand and returns the URL that actually serves an image (or None).

        Browsers load the stored URL with no Referer, so a URL that only redirects to a CDN
        under some conditions is replaced by the CDN URL itself.
        """
        for _ in range(4):
            try:
                with client.stream("GET", url, follow_redirects=False) as resp:
                    if resp.is_redirect and "location" in resp.headers:
                        url = urljoin(url, resp.headers["location"])
                        continue
                    if resp.status_code >= 400:
                        return None
                    if resp.headers.get("content-type", "").startswith("image/"):
                        return url
                    # Some CDNs send application/octet-stream; browsers still sniff and render images.
                    head = next(resp.iter_bytes(16), b"")
                    return url if head.startswith(IMAGE_MAGIC) or head[8:12] == b"WEBP" else None
            except httpx.HTTPError:
                return None
        return None

    def resolve_image(client: httpx.Client, img: str) -> str | None:
        if img.startswith("http://"):
            secure = image_target(client, "https://" + img.removeprefix("http://").replace(":80/", "/", 1))
            if secure and secure.startswith("https://"):
                return secure
        return image_target(client, img)

    with httpx.Client(follow_redirects=True, timeout=12, headers=headers) as client, ThreadPoolExecutor(6) as pool:
        results = list(pool.map(lambda p: one(client, p), pages))
        hosts = sorted({str(httpx.URL(p).host) for p in pages})
        defaults = dict(zip(hosts, pool.map(lambda h: site_default(client, next(p for p in pages if str(httpx.URL(p).host) == h)), hosts)))
        # Reject generic images: logos, the site-wide default og:image, or one image used by several pages.
        counts: dict[str, int] = {}
        for _, img, _, _ in results:
            if img:
                counts[img] = counts.get(img, 0) + 1
        # An <img> that appears on several pages of a host is site chrome (banner, icon), not this product.
        host_imgs: dict[tuple[str, str], int] = {}
        for page, urls in page_imgs.items():
            for u in urls:
                key = (str(httpx.URL(page).host), u)
                host_imgs[key] = host_imgs.get(key, 0) + 1
        cleaned = []
        for page, img, status, detail in results:
            og = img
            name = img.rsplit("/", 1)[-1].lower() if img else ""
            if img and "logo" in img.lower():
                img, status, detail = None, "none", "로고 이미지"
            elif img and GENERIC_IMAGE_RE.search(name):
                img, status, detail = None, "none", "범용 공유 이미지로 보임"
            elif img and img == defaults.get(str(httpx.URL(page).host)):
                img, status, detail = None, "none", "사이트 공통 대표 이미지"
            elif img and counts[img] > 1:
                img, status, detail = None, "none", "여러 페이지 공통 이미지"
            if img:
                resolved = resolve_image(client, img)
                if resolved:
                    img = resolved
                else:
                    img, status, detail = None, "none", f"og:image가 이미지를 반환하지 않음 ({img})"
            if not img and status == "none":
                host = str(httpx.URL(page).host)
                elsewhere = {u for (h, u), n in host_imgs.items() if h == host and n > 1}
                og_name = og.rsplit("/", 1)[-1].split("?")[0].lower() if og else None
                for cand in pick_page_image(page_imgs.get(page, []), elsewhere, og_name)[:3]:
                    if (resolved := resolve_image(client, cand)):
                        img, status, detail = resolved, "ok", "페이지 내 상품 이미지"
                        break
            cleaned.append((page, img, status, detail))
        results = cleaned

        if render and (todo := [r[0] for r in results if r[2] == "none"]):
            print(f"브라우저 렌더링으로 {len(todo)}개 페이지 재확인 중...")
            rendered = render_og_images(todo)
            used = {r[1] for r in results if r[1]}
            seen: dict[str, int] = {}
            for urls in rendered.values():
                for u in set(urls):
                    seen[u] = seen.get(u, 0) + 1
            for i, (page, img, status, detail) in enumerate(results):
                for cand in rendered.get(page, []):
                    name = cand.rsplit("/", 1)[-1].lower()
                    if ("logo" in cand.lower() or GENERIC_IMAGE_RE.search(name) or seen[cand] > 1
                            or cand in used or cand == defaults.get(str(httpx.URL(page).host))):
                        continue
                    if (resolved := resolve_image(client, cand)):
                        results[i] = (page, resolved, "ok", "렌더링 후 og:image")
                        used.add(resolved)
                        break
    factory = init_db(make_engine(database_url))
    now = datetime.now(timezone.utc)
    with factory() as s:
        for page, img, status, detail in results:
            s.merge(ImagePreview(page_url=page, image_url=img, status=status, detail=detail, checked_at=now))
        s.commit()
    ok = [r for r in results if r[2] == "ok"]
    print(f"이미지 찾음 {len(ok)} · 없음 {sum(r[2] == 'none' for r in results)} · 실패 {sum(r[2] == 'error' for r in results)}")
    for page, img, status, detail in results:
        print(f"  {status:<5} {page}  {img or detail}")
    print("서버에 OFFICIAL_IMAGE_PREVIEW=true 를 설정하고 재적재(--reload-url)하면 화면에 표시됩니다.")


def main() -> int:
    settings = load_settings()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--research-dir", type=_resolve, default=settings.research_dir)
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    ap.add_argument("-v", "--verbose", action="store_true", help="include info-level issues")
    ap.add_argument("--fail-on-warning", action="store_true")
    ap.add_argument("--reload-url", help="base URL of a running server to hot-reload after validation")
    ap.add_argument("--check-links", action="store_true")
    ap.add_argument("--fetch-previews", action="store_true", help="find og:image on model-specific official pages (URL only, nothing downloaded)")
    ap.add_argument("--render", action="store_true", help="with --fetch-previews: re-check pages without an image in headless Chromium (JS-rendered shops)")
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

    if args.fetch_previews:
        fetch_previews(data, settings.database_url, render=args.render)

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
