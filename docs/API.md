# REST API

기본 주소 `http://localhost:8000` (클라이언트에서는 같은 오리진 `/api/*`로 프록시). 실행 중 서버의 대화형 문서: `http://localhost:8000/docs`.

## 조사 데이터 (읽기 전용)

| 메서드·경로 | 설명 | 주요 쿼리 |
| --- | --- | --- |
| `GET /api/health` | 상태, 적재 시각, entity 수, 오류/경고 수, 샘플 데이터 여부 | |
| `GET /api/validation-report` | 전체 import 검증 리포트 (경로·필드·메시지) | |
| `POST /api/admin/reload` | 조사 MD 즉시 재적재 (`ENABLE_ADMIN=false`면 403) | |
| `GET /api/categories` | 카테고리 + 모델/브랜드/매장/후기 수, 존재하는 `product_kinds` | |
| `GET /api/brands` | 브랜드 목록 | `category_id`, `q` |
| `GET /api/brands/{id}` | 브랜드 상세 + 보고서 본문 + 모델 카드 | |
| `GET /api/models` | 모델 카드 목록 `{total, items}` | `category_id`, `brand_id`, `product_kind`, `q`, `price_min`, `price_max`(대표가 기준), `progress`(`any`·`none`·단계명), `sort`(`default`·`price_asc`·`price_desc`·`updated`) |
| `GET /api/models/{id}` | 상세: 갤러리, 사양, 옵션별 가격, 장단점(출처), 후기(분류), 브랜드 전반 후기, 매장(관계), 호환, 본문 MD, `my_stage` | |
| `GET /api/compare?ids=a,b,c` | 1–3개, 같은 카테고리만 (아니면 400). 사양 키·가격 옵션 합집합 포함 | |
| `GET /api/stores` | 매장 목록 + `visited` | `category_id`, `brand_id`, `model_id`, `q`, `display_verified_only` |
| `GET /api/stores/{id}` | 매장 상세 + 전시 확인 모델 / 연결만 된 모델 + 본문 | |
| `GET /api/reviews` | 후기 목록 + 통계 (기본: 독립 후기만) | `category_id`, `brand_id`, `model_id`, `include_excluded` |
| `GET /api/reviews/{id}` | 후기 상세 + 본문 | |
| `GET /api/research/{category_id}` | 카테고리 보고서 본문 + 브랜드 보고서들 + 관련 검증 이슈 | |
| `GET /api/spec-labels` | 서버 기본 사양 라벨 | |
| `GET /assets/...` | `research/assets/` 정적 파일 (권리 확인된 로컬 이미지용) | |

## 개인 기록

| 메서드·경로 | 본문 / 응답 |
| --- | --- |
| `GET /api/progress` | `{stages, models[], stores[], events[]}` — 모델별 5단계 도장(`stamps[].reached`, `stamped_at`), 방문 매장, 최근 이력 |
| `PUT /api/progress` | 모델: `{"target_type":"model","target_id":"…","stage":"tried"}` (`null`이면 도장 지움). 매장: `{"target_type":"store","target_id":"…","visited":true,"visited_on":"2026-10-21"}` |
| `GET /api/personal-notes` | `?model_id=`로 한 모델, 생략 시 기록이 있는 전체 |
| `PUT /api/personal-notes` | `{"model_id","memo","feel_note","rating":1-5\|null,"quotes":[{"amount_krw","size_or_option","quoted_on","place","note"}]}` — 견적 목록은 통째로 교체 |

단계: `wishlist`(찜) → `planned`(체험 예정) → `tried`(체험 완료) → `finalist`(최종 후보) → `purchased`(구매 완료).
존재하지 않는 모델/매장 id로 PUT하면 404, 잘못된 단계는 422.
