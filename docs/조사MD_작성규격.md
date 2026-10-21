# 혼수도감 조사 Markdown 작성 규격 (Research Contract v1)

## 원칙

조사 에이전트는 제품 개발 코드를 작성하지 않고, 공식 상품·가격·A/S·매장 정보와 독립 사용 후기의 출처가 명시된 Markdown만 생산합니다. `schema_version: 1`을 사용합니다. 확증 불가능한 정보는 빈 값(`null`)이나 `unknown`으로 기록합니다. 출처가 없는 가격·스펙·A/S·좌표를 채우지 않습니다.

각 도감 entity는 독립 `.md` 파일입니다. **YAML frontmatter는 검색·필터·카드 표시를 위한 구조화 정보**, 본문은 사람이 읽는 긴 조사 보고서입니다.

```text
research/
  categories/
    beds.md
    refrigerator.md
  brands/
    muji.md
  models/
    muji-pocket-high-density.md
  stores/
    muji-ak-giheung.md
  reviews/
    review-0001.md
```

## 모든 파일의 필수 frontmatter

```yaml
---
schema_version: 1
entity_type: model          # category | brand | model | store | review
id: muji-pocket-high-density
updated_at: 2026-10-21
status: researching         # verified | partially_verified | researching | archived
---
```

## 카테고리 `research/categories/beds.md`

```yaml
---
schema_version: 1
entity_type: category
id: beds
name: 침대
emoji: "🛏️"
updated_at: 2026-10-21
status: partially_verified
sort_order: 10
---
# 침대 조사 개요

## 선정 기준
## 브랜드별 비교
## 구매 전 체크리스트
## 보고서 한계
```

## 브랜드 `research/brands/muji.md`

```yaml
---
schema_version: 1
entity_type: brand
id: muji
category_ids: [beds]
name: 무인양품
name_en: MUJI
official_url: https://mujikorea.co.kr/
updated_at: 2026-10-21
status: partially_verified
---
# 무인양품 조사 보고서

## 공식 제품군
## 브랜드 장점
## 브랜드 단점·주의사항
## 가격 포지셔닝
## A/S 일반 정책
## 실구매 후기 요약
## 근거·한계
```

## 모델 `research/models/{id}.md`

아래는 **필드 형태 예시**입니다. 가격과 치수는 실제 검증 후 입력하고, 검증하지 못했으면 `null`로 둡니다.

```yaml
---
schema_version: 1
entity_type: model
id: muji-pocket-high-density
category_id: beds
brand_id: muji
name: 고밀도 포켓코일 매트리스
product_kind: mattress        # mattress | bed_frame | appliance | furniture | etc
model_code: null
updated_at: 2026-10-21
status: researching
image:
  image_url: null             # /assets/products/... 또는 이용 가능한 https 이미지
  image_source_url: null
  alt: 무인양품 고밀도 포켓코일 매트리스
  rights_status: unknown     # permitted | official_embed | unknown
specs:
  firmness: null
  mattress_type: pocket_spring
  dimensions_mm: null
  thickness_mm: null
  other: {}
prices: []                   # 실제 근거를 확인한 후 아래 형태로 추가
# - amount_krw: 549000
#   size_or_option: Q
#   price_kind: historical_official
#   observed_at: 2024-01-01
#   source_url: https://...   # 실제 URL
pros: []
cons: []
warranty_summary: null
warranty_source_url: null
store_ids: []
review_ids: []
source_urls: []
---
# 제품 조사 보고서

## 모델 개요
## 공식 사양과 규격
## 판매 채널·가격 근거
## 확인된 장점
## 확인된 단점·주의사항
## 실제 사용 후기 요약
## 보증 및 A/S
## 체험·전시 위치
## 검증 상태·미확인 항목
```

`prices`의 `amount_krw`는 숫자이며 옵션/사이즈 구분은 필수입니다. **정가·공식할인·구매자가 보고한 실결제가·과거가**의 종류는 각각 `official_list`, `official_sale`, `user_reported_paid`, `historical_official`로 표기합니다. 모든 가격에는 `observed_at`과 `source_url`을 함께 넣습니다.

## 매장 `research/stores/{id}.md`

```yaml
---
schema_version: 1
entity_type: store
id: muji-ak-giheung
name: 무인양품 AK& 기흥점
brand_ids: [muji]
category_ids: [beds]
address: null
lat: null
lng: null
phone: null
official_store_url: null
map_url: null
model_ids_on_display: []
display_status: unknown     # verified_on_display | store_only_verified | unknown
verified_at: null
updated_at: 2026-10-21
status: researching
sources: []
---
# 매장 조사 기록

## 실물 전시 확인
## 방문 전 전화할 사항
## 위치 및 교통
## 정보 출처
```

매장이 존재한다는 사실은 특정 모델이 전시되어 있다는 뜻이 아닙니다. `model_ids_on_display`는 확인된 제품만 입력하세요. 좌표는 검증 전까지 null입니다.

## 후기 `research/reviews/{id}.md`

```yaml
---
schema_version: 1
entity_type: review
id: review-0001
category_id: beds
brand_id: muji
model_id: null
source_url: null
posted_at: null
usage_duration: null
purchase_evidence_level: unknown  # actual_use_claim | purchase_only | purchase_proof_shown | unknown
sponsorship_status: unknown       # confirmed_uncompensated | sponsored_or_provided | unknown
review_sentiment: mixed           # positive | negative | mixed
updated_at: 2026-10-21
status: researching
---
# 독립 사용 후기 정리

## 작성자 진술 및 사용 기간
## 직접 경험에 근거한 장점
## 직접 경험에 근거한 단점
## 구매 인증·협찬 여부 판단 근거
## 일반화할 수 없는 사항
```

독립 후기 목록에 포함하려면 최소한 외부 게시물 URL, 게시일, 구매/사용 진술이 있어야 합니다. 협찬·제공 글은 `sponsored_or_provided`로 분류하여 기본 후기 집계에서 제외합니다. 구매 증빙을 실제로 확인하지 않은 경우 `purchase_proof_shown`으로 기록하지 않습니다. 오래된 장기 사용자의 최근 게시물은 *최근에 작성된 오래 사용한 후기*로 정확히 표기합니다.

## 조사 시 필수 체크

- 공식 제품명·규격·현행 판매 상태·구매 채널을 확인했는가?
- 매트리스/프레임/모션베드를 별개 상품으로 분리했는가?
- 모든 가격에 옵션(예: Q), 종류, 기준일, 출처가 있는가?
- 실제 방문 가능한 매장인지, 특정 모델 전시를 확인했는지 구분했는가?
- A/S 기간뿐 아니라 보증 부위·소비자 부담·예외 조항도 확인했는가?
- 독립 후기와 판매자 광고를 분리했는가? 구매만 한 글을 장기 사용 후기로 취급하지 않았는가?
- 불확실한 정보는 명시적으로 `unknown`/`null`로 남겼는가?


## v2 추가: 독립 후기 검색 매체·검증 계약 (2026-10-21)

**필수 준수:** 같은 패키지의 [`후기_검색범위_판정규칙.md`](후기_검색범위_판정규칙.md)를 읽고 디시·더쿠·블라인드·Threads·인스타그램·네이버 카페/블로그 등으로 검색 범위를 확장합니다. 구입 결심, 구매 인증, 실제 사용, 장기 사용, 협찬 여부, 접근 제한 상태를 별도로 기록하며 후기에 `platform`, `content_access`, `review_evidence_grade`, `in_period`, `incentive_check` 필드를 선택적으로 추가합니다. `schema_version: 1`은 변경하지 않습니다.

해당 사이트 원문 열람 불가 시 `검색커버리지_기록.md`에 남기고 검증 후기 카운트에는 포함하지 않습니다. SNS의 작성자·아이디는 개인정보 식별에 불필요하므로 데이터에 저장하지 않습니다.
