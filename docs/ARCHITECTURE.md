# 아키텍처와 설계 결정

## 구성

```text
research/*.md ──(읽기 전용)──▶ FastAPI (server/)  ──REST /api──▶ Next.js (client/) ──▶ 브라우저
                               │   ├ 검증·정규화·파생 판단(catalog.py)
                               │   └ SQLite: 개인 기록만 (도장·방문·메모·견적·링크점검)
                               └── import CLI (검증 리포트, 링크 점검, research_requests.md)
```

| 디렉터리 | 역할 |
| --- | --- |
| `research/` | 조사 에이전트 소유. 제품·가격·후기·매장 사실의 **유일한 원본**. 앱은 쓰지 않음 |
| `samples/research/` | 개발용 **테스트 샘플**(가상 데이터, `is_sample: true`). 테스트·데모 전용 |
| `server/` | FastAPI + Pydantic + SQLAlchemy. MD 적재/검증, REST API, 개인 기록 저장 |
| `client/` | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + SWR + motion |
| `docs/` | 명세·스키마·API·실행 문서, 조사 템플릿, 조사 패키지 원본 README 보관 |

## 데이터 흐름

1. 서버 시작 시 `RESEARCH_DIR` 아래 모든 `.md`를 재귀로 읽음 (`_`·`.`로 시작하는 경로, `README.md`, `research_requests.md` 제외).
2. 각 파일의 YAML frontmatter를 entity별 Pydantic 모델로 검증 → 실패 시 **파일 경로·필드·이유**를 리포트에 기록하고 그 파일만 제외. 조용히 누락하지 않음.
3. 교차 참조 검사(존재하지 않는 브랜드·매장·후기·모델 링크, 전시 상태 모순 등)는 경고로 기록.
4. 메모리 인덱스(`ResearchData`)를 만들어 API가 사용. 재적재는 원자적으로 교체.
5. 재적재 트리거: `RESEARCH_WATCH=true` 파일 감시, `POST /api/admin/reload`, `import_research.py --reload-url`, 데이터 리포트 화면의 버튼.

연구 데이터는 DB에 복사하지 않습니다. MD가 원본이므로 매 적재마다 다시 읽는 편이 동기화 오류가 없고, 수백 개 파일 규모에서는 충분히 빠릅니다(105개 파일 ≈ 수십 ms).

## 개인 기록 보호

- SQLite에는 사용자 소유 데이터만 저장: `model_progress`, `progress_events`(도장 이력), `store_visits`, `personal_notes`, `personal_quotes`, `link_checks`.
- 모든 행은 조사 entity의 **안정적인 문자열 id**로 연결. MD를 다시 읽거나 교체해도 개인 행은 건드리지 않음.
- MD에서 entity가 사라져도 기록은 삭제하지 않고 `orphaned: true`로 표시(내 도장 화면에 "조사 자료에서 빠짐 · 기록 보존").
- 모든 사용자 테이블에 `user_id` 컬럼. MVP는 `local` 단일 사용자(`api/deps.py::current_user_id`)이며, 인증을 붙일 때 이 의존성만 교체하면 됨.
- 개인 견적(`personal_quotes`)은 조사 가격(`prices`)과 별도 테이블·별도 API. 화면에서도 섞지 않음.
- SQLAlchemy 표준 타입만 사용 → `DATABASE_URL`만 바꾸면 PostgreSQL로 이전 가능(드라이버 설치 필요).

## 프런트엔드

- 브라우저는 **Next.js 오리진만** 호출. `next.config.ts`의 rewrites가 `/api/*`, `/assets/*`를 FastAPI로 프록시 → CORS 불필요, 서버 주소가 클라이언트 코드에 노출되지 않음.
- 상품 데이터는 전부 API에서 받아 렌더링. 클라이언트에 있는 것은 enum의 한국어 라벨(`lib/labels.ts`) 같은 UI 문구뿐.
- Next 16 `cacheComponents` 기본값에 맞춰 각 `page.tsx`는 서버 컴포넌트로 `<Suspense>`만 두고, 실제 화면은 `src/views/*`의 클라이언트 컴포넌트(SWR)로 구성.
- 도장·방문은 서버 DB, **비교함만** `localStorage`(기기별 편의 상태).
- 지도: Kakao Maps JS SDK를 키가 있을 때만 동적 로드. 키 없음/로드 실패/타임아웃 → 주소·전화·외부 지도 링크 목록으로 자동 전환. 검증 좌표가 없는 매장은 브라우저에서 주소 지오코딩하여 **점선 핀(추정 위치)**으로 구분.

## 주요 판단 규칙 (서버 `catalog.py`)

| 항목 | 규칙 |
| --- | --- |
| 대표 가격 | 현행(≤ `STALE_PRICE_DAYS`) 공식가 → 구매자 보고가 → 재확인 필요 → 과거가 순. 같은 순위면 최신 확인일, 할인가 우선. **옵션 문자열을 그대로** 함께 표시 |
| 가격 신선도 | `historical_official` → "과거 확인가", 확인일이 기준일보다 오래됨 → "재확인 필요" |
| 옵션 | `size_or_option`별로 그룹화, 서로 다른 옵션을 하나의 가격으로 합치지 않음 |
| 이미지 | `rights_status`가 `permitted`/`official_embed`일 때만 표시. 그 외에는 중립 플레이스홀더 + 공식 원본 페이지 링크 |
| 독립 후기 | 원문 URL·게시일·구매/사용 진술이 있고, 협찬·보상 고지·X등급·원문 미열람·D/E등급이 아닌 글. `duplicate_group`은 1건으로 집계 |
| 후기 분류 | `experience`(독립) / `purchase_reference`(D) / `community`(E) / `excluded` |
| 매장 전시 | 매장의 `model_ids_on_display`에 있고 `display_status: verified_on_display`일 때만 "전시 확인". 모델의 `store_ids`만으로는 "취급 매장 · 이 모델 전시 미확인" |
| 조합 추천 | 모델의 `compatibility`에 `source_url`이 있는 항목만 표시 |

## 가정 (README에도 요약)

- 로그인 없는 1인 로컬 MVP. 여러 기기 간 동기화는 같은 서버를 바라볼 때만.
- 대표가 기반 가격대 필터는 옵션이 달라도 대표가로 거른다는 한계를 화면에 고지.
- 링크 점검(`--check-links`)은 HEAD/GET 응답 코드만 봄. 일부 사이트는 봇 차단으로 `dead`/`error`가 나올 수 있으며, 기록은 유지되고 배지로만 표시.
- 카테고리 진행률 = 해당 카테고리에서 가장 멀리 간 도장 단계(찜 20% … 구매 100%).
