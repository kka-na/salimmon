"""Builds research_requests.md: a list of facts the research agent still needs to supply.

The development side never fills these gaps itself; it only asks for them.
"""

from __future__ import annotations

from datetime import date

from ..catalog import review_independence
from .loader import ResearchData
from .schema import Model, Review, Store


def _model_gaps(data: ResearchData, m: Model) -> list[str]:
    gaps = []
    if not m.prices:
        gaps.append("가격 기록 없음 (옵션·가격 종류·확인일·출처 URL 포함)")
    if not m.image or not m.image.image_url:
        gaps.append("대표 이미지 없음 (image_url + image_source_url + rights_status)")
    elif m.image.rights_status == "unknown":
        gaps.append("이미지 rights_status가 unknown이라 화면에 표시하지 않음")
    if not m.specs or all(v in (None, "", {}, []) for v in m.specs.values()):
        gaps.append("사양(specs) 없음")
    if not m.pros:
        gaps.append("장점(pros) 없음")
    if not m.cons:
        gaps.append("단점·주의(cons) 없음")
    if not m.warranty_summary:
        gaps.append("보증/A/S 요약 없음")
    reviews = [r for r in data.reviews.values() if r.entity.model_id == m.id or r.entity.id in m.review_ids]  # type: ignore[attr-defined]
    if not any(review_independence(r.entity)[0] for r in reviews):  # type: ignore[arg-type]
        gaps.append("독립 사용 후기 없음")
    displayed = any(
        m.id in s.entity.model_ids_on_display and s.entity.display_status == "verified_on_display"  # type: ignore[attr-defined]
        for s in data.stores.values()
    )
    if not displayed:
        gaps.append("실물 전시 확인 매장 없음")
    return gaps


def _store_gaps(s: Store) -> list[str]:
    gaps = []
    if not s.address:
        gaps.append("주소 없음")
    if s.lat is None:
        gaps.append("검증된 좌표 없음 (주소 지오코딩으로 대체)")
    if not s.phone:
        gaps.append("전화번호 없음")
    if s.display_status == "unknown":
        gaps.append("전시/매장 확인 상태 unknown")
    if not s.verified_at:
        gaps.append("verified_at 없음")
    return gaps


def _review_gaps(r: Review) -> list[str]:
    ok, reasons = review_independence(r)
    labels = {
        "sponsored": None,  # sponsored reviews are correctly excluded; nothing to request
        "no_source_url": "원문 URL 없음",
        "no_posted_at": "게시일 없음",
        "no_use_or_purchase_claim": "구매/사용 진술 수준 unknown",
        "incentivized": None,
        "source_not_read": "원문 미열람(snippet_only/inaccessible)",
        "purchase_only_grade": None,
        "community_opinion": None,
    }
    return [lbl for r_ in reasons if (lbl := labels[r_])]


def _display_path(path) -> str:
    from ..config import REPO_ROOT

    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def build_requests_md(data: ResearchData) -> str:
    lines = [
        "# 조사 요청 목록 (research_requests)",
        "",
        f"> 자동 생성: `server/scripts/import_research.py --write-requests` · {date.today().isoformat()}",
        f"> 대상 디렉터리: `{_display_path(data.root)}`",
        ">",
        "> 개발 에이전트는 아래 항목을 직접 조사해 채우지 않습니다. 조사 에이전트가 근거와 함께 MD를 갱신해 주세요.",
        "",
    ]
    errors = [i for i in data.issues if i.severity in ("error", "warning")]
    if errors:
        lines += ["## 0. 검증 오류·경고 (수정 필요)", ""]
        lines += [f"- [{i.severity}] `{i.path}` · `{i.field}` — {i.message}" for i in errors]
        lines.append("")

    if not data.categories:
        lines += ["## 1. 카테고리", "", "- 카테고리 파일이 없습니다. 최소 `categories/beds.md`(침대)가 필요합니다.", ""]
        return "\n".join(lines) + "\n"

    for cat_entry in sorted(data.categories.values(), key=lambda e: e.entity.sort_order):  # type: ignore[attr-defined]
        cat = cat_entry.entity
        lines += [f"## {cat.name} (`{cat.id}`)", ""]  # type: ignore[attr-defined]
        brands = [b for b in data.brands.values() if cat.id in b.entity.category_ids]  # type: ignore[attr-defined]
        models = [m for m in data.models.values() if m.entity.category_id == cat.id]  # type: ignore[attr-defined]
        stores = [s for s in data.stores.values() if cat.id in s.entity.category_ids]  # type: ignore[attr-defined]
        if not brands:
            lines.append("- 브랜드 파일 없음")
        if not models:
            lines.append("- 모델 파일 없음")
        if cat.id == "beds":
            kinds = {m.entity.product_kind for m in models}  # type: ignore[attr-defined]
            for kind, label in (("mattress", "매트리스"), ("bed_frame", "프레임")):
                if kind not in kinds:
                    lines.append(f"- {label}(product_kind: {kind}) 모델이 없습니다")
        if not stores:
            lines.append("- 매장 파일 없음")
        for entry in sorted(models, key=lambda e: e.entity.id):
            gaps = _model_gaps(data, entry.entity)  # type: ignore[arg-type]
            if gaps:
                lines.append(f"- 모델 **{entry.entity.name}** (`{entry.path}`)")  # type: ignore[attr-defined]
                lines += [f"  - {g}" for g in gaps]
        for entry in sorted(stores, key=lambda e: e.entity.id):
            gaps = _store_gaps(entry.entity)  # type: ignore[arg-type]
            if gaps:
                lines.append(f"- 매장 **{entry.entity.name}** (`{entry.path}`)")  # type: ignore[attr-defined]
                lines += [f"  - {g}" for g in gaps]
        for entry in sorted(data.reviews.values(), key=lambda e: e.entity.id):
            if entry.entity.category_id != cat.id:  # type: ignore[attr-defined]
                continue
            gaps = _review_gaps(entry.entity)  # type: ignore[arg-type]
            if gaps:
                lines.append(f"- 후기 `{entry.path}`: " + ", ".join(gaps))
        lines.append("")
    return "\n".join(lines) + "\n"
