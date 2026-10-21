# 데이터 스키마 — 지원 범위와 개발 측 확장

기본 명세는 [`조사MD_작성규격.md`](조사MD_작성규격.md)(Research Contract v1 + v2 후기 확장 절)이며, 후기 판정은 [`후기_검색범위_판정규칙.md`](후기_검색범위_판정규칙.md)를 따릅니다. 서버 구현은 `server/app/research/schema.py`.

**원칙:** 규격의 기존 필드 이름·의미는 바꾸지 않습니다. 아래 확장은 모두 선택 필드이며 없어도 됩니다. 규격에 없는 필드는 보존되고(검증 리포트에 info로 표시) UI에서는 쓰지 않습니다.

## 공통 (모든 entity)

| 필드 | 검증 |
| --- | --- |
| `schema_version` | `1`만 허용 |
| `entity_type` | `category` `brand` `model` `store` `review` |
| `id` | `^[a-z0-9][a-z0-9-]*$`, 같은 타입 안에서 유일 (경로 순으로 나중 파일이 오류) |
| `updated_at` | 날짜 (`2026-10-21` 또는 `'2026-10-21'`) |
| `status` | `verified` `partially_verified` `researching` `archived` |
| `is_sample` | **확장.** `true`면 화면 상단에 "테스트용 샘플 데이터" 배너 |

파일명과 `id`가 다르면 info, 타입과 폴더가 다르면 warning(적재는 됨).

## 타입별 규칙

- **category**: `name` 필수. 확장 `description`, `spec_fields: [{key, label, unit}]` — 사양 표의 라벨/단위를 카테고리별로 지정(없으면 서버 기본 라벨 → 키 이름).
- **brand**: `category_ids`, `official_url`(http/https). 확장 `source_urls`.
- **model**
  - `category_id`가 존재하지 않으면 **오류**(도감에 넣을 탭이 없음). `brand_id`가 없으면 경고 후 "브랜드 미확인" 표시.
  - `product_kind`: `mattress` `bed_frame` `appliance` `furniture` `etc` + **확장 `motion_bed`**.
  - `prices[]`: `amount_krw`(쉼표 없는 양의 정수), `size_or_option`(필수, 자유 문자열), `price_kind`(`official_list` `official_sale` `user_reported_paid` `historical_official`), `observed_at`, `source_url` 모두 필수. 확장 `source_type`, `note`.
  - `pros`/`cons`: 문자열 또는 `{text, source_url, source_type, checked_at}`.
  - `source_urls`: 문자열 또는 `{url, source_type, title, checked_at}`.
  - `image`: `image_url`은 `https://…` 또는 `/assets/…`(= `research/assets/…`를 서버가 제공). 확장 `images[]`(갤러리).
  - `specs`: 자유 형식. `dimensions_mm: [1500, 2000]` → "1500 × 2000 mm", `unknown` → "미확인", `level7` → "레벨 7", 흔한 enum(`pocket_spring`, `medium` 등)은 한국어 라벨과 원문 병기.
  - 확장 `compatibility: [{model_id, sizes, source_url, verified_at, note}]` — `source_url`이 있어야 조합 추천에 노출.
  - 확장 `last_verified_at`.
- **store**: `lat`/`lng`는 둘 다 있거나 둘 다 null, 범위 검사. `display_status`: `verified_on_display` `store_only_verified` `unknown`. 확장 `hours`.
  - `model_ids_on_display`가 있는데 상태가 `verified_on_display`가 아니면 경고, UI에서는 전시 확인으로 보이지 않음.
- **review**: `purchase_evidence_level`, `sponsorship_status`, `review_sentiment` enum. 확장 `title`, `source_name`.
  - **v2 선택 필드**: `platform`, `content_access`(`full` `snippet_only` `inaccessible`), `review_scope`, `review_evidence_grade`(`A`–`E`, `X`), `in_period`, `incentive_check`(`no_disclosure_found` `disclosed` `unknown`), `duplicate_group`.

## 서버가 계산해 내려주는 값

| 필드 | 의미 |
| --- | --- |
| `representative_price` | 카드용 대표가 (`docs/ARCHITECTURE.md` 규칙) + `option_count` |
| `price.freshness` | `current` / `stale`(재확인 필요) / `historical`(과거 확인가) |
| `image.display_url` | 권리 확인된 경우만 값, 아니면 `null` + `placeholder_reason` |
| `image.preview_url`, `preview_page_url` | `OFFICIAL_IMAGE_PREVIEW=true`이고 `display_url`이 없을 때, 모델 전용 공식 페이지의 og:image(핫링크). 공유 페이지(여러 모델이 같은 `image_source_url`)·도메인 루트는 제외 |
| `review.is_independent`, `exclusion_reasons`, `bucket` | 독립 후기 판정과 분류 |
| `review_stats` | 독립 후기 수(중복 그룹 1건), 감성 분포, 구매 증빙 수 |
| `store.relation` | `display_verified` / `display_unconfirmed` / `store_only` |
| `link_status` | `--check-links` 결과: `ok` `dead` `error` `unchecked` |

## 자주 나는 검증 오류

| 리포트 메시지 | 원인 |
| --- | --- |
| `파일 맨 앞에 '---'로 감싼 YAML frontmatter가 없습니다` | 첫 줄이 `---`가 아님 (BOM은 허용) |
| `prices.0.amount_krw … 정수여야` | `"549,000원"` 같은 문자열 |
| `prices.N.source_url … 필수` | 가격에 출처 누락 |
| `카테고리 'x' 파일이 없어 이 모델은 도감에서 제외됨` | `categories/x.md` 없음 |
| `중복 id` | 같은 타입에 같은 id 두 파일 |
