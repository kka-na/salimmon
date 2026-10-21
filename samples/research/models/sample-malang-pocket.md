---
schema_version: 1
entity_type: model
id: sample-malang-pocket
category_id: beds
brand_id: sample-malang
name: "[테스트] 말랑 포켓스프링 매트리스"
product_kind: mattress
model_code: SAMPLE-MP-01
updated_at: 2026-10-21
last_verified_at: 2026-10-15
status: partially_verified
is_sample: true
image:
  image_url: null
  image_source_url: null
  alt: "[테스트] 말랑 포켓스프링 매트리스"
  rights_status: unknown
specs:
  firmness: "중간 (테스트 값)"
  mattress_type: pocket_spring
  thickness_mm: 280
  dimensions_mm:
    Q: "1500 x 2000"
    K: "1600 x 2000"
  other:
    탑퍼: "일체형 (테스트 값)"
prices:
  - amount_krw: 990000
    size_or_option: Q
    price_kind: official_list
    observed_at: 2026-10-15
    source_url: https://example.com/sample/malang/pocket
  - amount_krw: 890000
    size_or_option: Q
    price_kind: official_sale
    observed_at: 2026-10-15
    source_url: https://example.com/sample/malang/pocket
    note: "테스트 할인가"
  - amount_krw: 1090000
    size_or_option: K
    price_kind: official_list
    observed_at: 2026-10-15
    source_url: https://example.com/sample/malang/pocket
  - amount_krw: 850000
    size_or_option: Q
    price_kind: user_reported_paid
    observed_at: 2026-09-30
    source_url: https://example.com/sample/review/0001
    source_type: independent_user
  - amount_krw: 790000
    size_or_option: Q
    price_kind: historical_official
    observed_at: 2024-03-01
    source_url: https://example.com/sample/malang/pocket-2024
pros:
  - text: "테스트 장점: 허리 지지감이 단단하다는 진술"
    source_url: https://example.com/sample/review/0001
    source_type: independent_user
    checked_at: 2026-10-15
  - "테스트 장점: 출처 없는 문구 예시"
cons:
  - text: "테스트 주의: 무게가 무거워 이동이 어렵다는 진술"
    source_url: https://example.com/sample/review/0004
    source_type: independent_user
warranty_summary: "테스트 값: 스프링 10년 / 원단 1년 (가상 정책)"
warranty_source_url: https://example.com/sample/malang/warranty
store_ids: [sample-store-gangnam, sample-store-suwon]
review_ids: [review-sample-0001, review-sample-0002, review-sample-0003, review-sample-0004]
source_urls:
  - url: https://example.com/sample/malang/pocket
    source_type: official
    title: "[테스트] 공식 상품 페이지"
    checked_at: 2026-10-15
  - https://example.com/sample/dead-link
compatibility:
  - model_id: sample-pogeun-wood
    sizes: [Q]
    source_url: https://example.com/sample/pogeun/wood-spec
    verified_at: 2026-10-15
    note: "테스트 값: Q 매트리스 규격 일치"
---
# [테스트] 제품 조사 보고서

> **테스트용 샘플**입니다. 실제 제품이 아닙니다.

## 모델 개요
가상의 포켓스프링 매트리스입니다.

## 공식 사양과 규격
| 항목 | 값 |
| --- | --- |
| 두께 | 280mm (테스트 값) |

## 판매 채널·가격 근거
가격 기록은 모두 가상이며, 사이즈(Q/K)별로 따로 기록되어 있습니다.

## 검증 상태·미확인 항목
- 이미지: 없음 → 플레이스홀더 표시
