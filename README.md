# 살림몬 · 우리 집 혼수 도장깨기

혼수 가전·가구를 **조사 근거와 함께** 탐색하고, 찜 → 체험 → 구매까지 도장을 모으는 모바일 웹 도감입니다.
침대(매트리스·프레임)부터 시작하며, 조사 Markdown만 추가하면 다른 카테고리 탭이 코드 수정 없이 생깁니다.

- `client/` — Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · SWR · motion · lucide
- `server/` — FastAPI · Pydantic v2 · SQLAlchemy 2 (SQLite, PostgreSQL 이전 가능)
- `research/` — 조사 에이전트가 작성하는 Markdown 원본 (제품·가격·후기·매장 사실의 유일한 출처)
- `samples/research/` — **테스트용 가상 데이터** (모든 항목 `[테스트]`, `is_sample: true`)
- `docs/` — [아키텍처·설계 결정](docs/ARCHITECTURE.md) · [데이터 스키마](docs/DATA_SCHEMA.md) · [API](docs/API.md) · [조사 템플릿](docs/research-templates/) · 원 명세

> 이 저장소 루트의 `README.md`는 조사 패키지(v2) 압축 해제 때 패키지 안내문으로 덮어써졌던 상태였습니다. 그 원문은 [`docs/research-package/README.md`](docs/research-package/README.md)에 그대로 보관했습니다. 조사 패키지 문서(`조사MD_작성규격.md` v2, `후기_검색범위_판정규칙.md`, `침대_종합_보고서.md`, `추가조사_대기열.md`, `검색커버리지_기록.md`)는 `docs/`에 있고, `DATA_QUALITY.json`은 루트에 있습니다. 이 파일들은 수정하지 않았습니다.

## 빠른 실행 (로컬, 두 개의 별도 프로세스)

필요: Python 3.10+, Node.js 20+ (이 PC에는 Node 22가 `~/.local/opt/node`에 설치되어 있습니다 → `export PATH=~/.local/opt/node/bin:$PATH`).

```bash
make setup            # server/.venv 생성 + pip install, client npm ci

# 터미널 1 — API (http://localhost:8000, 문서 /docs)
make server           # research/ 사용, MD 저장 시 자동 재적재
# 또는 테스트 샘플로: make server-demo   (DB도 별도 파일 server/data/demo.db)

# 터미널 2 — 웹 (http://localhost:3000)
make client
```

`make` 없이:

```bash
# server
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env               # 필요 시 수정
.venv/bin/uvicorn app.main:app --reload --reload-dir app --port 8000

# client
cd client && npm ci
cp .env.example .env.local         # Kakao 키를 넣으려면
npm run dev
```

> ROS 등으로 `PYTHONPATH`가 전역 설정된 셸이라면 `env -u PYTHONPATH`를 앞에 붙이세요 (Makefile은 자동 처리).

### Docker Compose

```bash
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=발급키 docker compose up --build    # http://localhost:3000
```

`research/`는 읽기 전용으로 마운트되고 개인 기록은 `salimmon-db` 볼륨에 남습니다. (이 개발 PC에는 Docker가 없어 Compose 구성은 실행 검증하지 못했습니다.)

## 환경 변수

| 위치 | 변수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| server | `RESEARCH_DIR` | `research` | 조사 MD 디렉터리 (상대경로는 저장소 루트 기준) |
| server | `DATABASE_URL` | `sqlite:///server/data/salimmon.db` | 개인 기록 DB |
| server | `RESEARCH_WATCH` | `false` (`make server`는 true) | MD 변경 자동 재적재 |
| server | `STALE_PRICE_DAYS` | `180` | 이보다 오래된 가격 → "재확인 필요" |
| server | `CORS_ORIGINS` | `http://localhost:3000,…` | 브라우저가 API를 직접 부를 때만 필요 |
| server | `ENABLE_ADMIN` | `true` | `POST /api/admin/reload` 허용 |
| client | `API_INTERNAL_URL` | `http://127.0.0.1:8000` | Next가 `/api`·`/assets`를 프록시할 대상 (**`next build` 시점에 고정**) |
| client | `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | (없음) | Kakao 지도 JavaScript 키. 브라우저용 공개 키이므로 Kakao 콘솔에서 **사이트 도메인 제한**을 거세요. 없으면 목록 폴백 |

서버 전용 비밀값은 없고, 브라우저는 Next 오리진만 호출합니다.

## 조사 Markdown 추가·갱신 방법

1. 조사 에이전트가 `research/{categories,brands,models,stores,reviews}/{id}.md`를 작성합니다. 양식: [`docs/research-templates/`](docs/research-templates/), 규칙: [`docs/DATA_SCHEMA.md`](docs/DATA_SCHEMA.md).
2. 검증:
   ```bash
   make validate                      # = server/.venv/bin/python server/scripts/import_research.py -v
   ```
   오류가 있는 파일은 **경로 · 필드 · 이유**가 출력되고 그 파일만 도감에서 제외됩니다 (종료 코드 1). `--json`, `--fail-on-warning` 지원.
3. 반영: `make server`(감시 모드)면 저장 즉시 반영. 아니면
   ```bash
   server/.venv/bin/python server/scripts/import_research.py --reload-url http://localhost:8000
   ```
   또는 앱의 **내 도장 → 데이터 검증 리포트 → 조사 MD 다시 읽기**.
4. 새 카테고리: `research/categories/sofa.md` 하나만 추가해도 도감 상단 탭이 생깁니다(모델이 없으면 "조사 중" 빈 상태).
5. 누락 사실 요청 목록: `make requests` → 루트 `research_requests.md` 생성 (가격·이미지·후기·전시·좌표 등 빈 칸을 모델/매장별로 정리). 개발 측은 이 목록만 만들고 값을 채우지 않습니다.
6. 출처 링크 점검(선택): `import_research.py --check-links` → 결과를 SQLite에 저장, 화면에 "링크 끊김" 배지 (기록은 유지).

이미지: 사용 권리가 확인된 경우에만 `image.rights_status: permitted`(또는 `official_embed`)로 표시됩니다. 로컬 파일은 `research/assets/products/x.jpg` + `image_url: /assets/products/x.jpg`.

공식 사이트 미리보기(선택): 권리 확인 이미지가 없을 때, `image_source_url`이 **그 모델 전용** 공식 상품 페이지면 그 페이지의 대표 이미지(og:image)를 "공식 사이트 이미지 · 원본 보기" 표시와 함께 **핫링크**로 보여줍니다. 파일은 내려받거나 저장하지 않고 URL만 DB(`image_previews`)에 기록합니다. 브랜드 홈·여러 모델 공유 페이지·로고·사이트 공통 이미지는 제외. og:image가 없거나 범용이면 페이지 안의 상품 이미지(그 페이지에만 있는 `/product`·`/goods` 경로 이미지)를, JS로 그리는 쇼핑몰은 `--render`로 헤드리스 Chromium(`client/node_modules`의 Playwright) 렌더링 후 og:image를 씁니다. 저장 전 실제로 이미지를 반환하는지 확인합니다.
```bash
make previews        # = import_research.py --fetch-previews --render --reload-url http://localhost:8000
```
서버 환경변수 `OFFICIAL_IMAGE_PREVIEW=true`일 때만 표시(`make server`는 켜져 있음, 기본값 false).

## 테스트

```bash
make test-server     # pytest 29건: 검증 오류 리포트, 가격/후기/전시 판정, 새 카테고리 자동 반영, 재시작 후 개인 기록 유지, CLI
make test-client     # tsc + eslint + vitest(포맷/링크 변환)
make test-e2e        # Playwright(360px 모바일): 샘플 데이터로 API(:8100)+웹(:3100)을 직접 띄워 7개 사용자 흐름 검증
                     #   (실행 중인 `next dev`가 있으면 먼저 종료 — 한 디렉터리에 dev 서버 하나)
cd client && npm run build   # 프로덕션 빌드 확인
```

단일 테스트: `cd server && .venv/bin/python -m pytest tests/test_api.py -k compare` · `cd client && npx playwright test -g "stamps"`.

> `next build`에서 `@vercel/turbopack-next/internal/font/google/font` 모듈 오류가 나면 dev 캐시가 남은 것이니 `rm -rf client/.next` 후 다시 빌드하세요.

## 화면

하단 탭 **도감 / 지도 / 비교 / 내 도장**.

- **도감**: 카테고리 탭(MD에서 자동 생성), 검색, 종류(매트리스/프레임) 칩, 브랜드·가격대·내 도장 상태·정렬 필터, 브랜드별 카드(이미지 또는 플레이스홀더, 대표가 + 옵션 + 확인일, 장점/주의 한 줄, 독립 후기 수, 전시 확인 매장 수, 찜·비교 버튼). 카테고리·브랜드 **조사 보고서** 화면(긴 MD 원문, MD 상호 링크는 앱 경로로 변환).
- **모델 상세**: 사진/갤러리, 대표가, 5단계 도장, 옵션별 가격 이력(종류·확인일·출처·신선도), 사양 표, 탭 `핵심 요약 / 장점 / 단점·주의 / 내돈내산 후기 / A/S / 출처`, 체험 매장(전시 확인 vs 취급 매장 구분), 출처 있는 호환 조합, 내 기록(평점·체험 느낌·메모·견적).
- **지도**: Kakao 지도(키 있을 때) — 전시 확인/매장만 확인 색 구분, 검증 좌표 없는 매장은 주소 지오코딩 점선 핀. 키 없음·로드 실패 시 주소/전화/카카오맵·네이버지도 링크 목록. 카테고리·브랜드·"전시 확인만" 필터, 모델별 매장 보기, 방문 도장.
- **비교**: 같은 카테고리 최대 3개, 옵션별 가격 행 정렬, 사양·장단점·보증·독립 후기·전시 매장·내 도장.
- **내 도장**: 스탬프북 표지, 카테고리별 진행률, 모델별 도장 트랙(찍은 날짜), 방문 도장, 견적·평점 모음, 최근 기록, 데이터 검증 리포트 링크.

## 실제로 동작하는 것 / 아직 아닌 것

동작(테스트로 확인): 위 화면 전부, MD 검증·리포트·자동 재적재, 새 카테고리 자동 탭, 가격 옵션 분리·신선도 라벨, 후기 독립성 판정(v1 + v2 등급), 전시/매장 구분, 이미지 권리 기반 플레이스홀더, 지도 목록 폴백, 도장·방문·메모·견적의 서버 재시작 후 유지, 사라진 entity의 개인 기록 보존, 360px 레이아웃(가로 스크롤 없음).

제한·미구현:
- **Kakao 지도는 실제 키로 검증하지 못했습니다** (키 없이 개발). 폴백 경로만 자동 테스트됨. 키를 넣은 뒤 도메인 등록이 필요합니다.
- 현재 실데이터는 이미지 사용 권리 확인 0건, 검증 좌표 0건, 모델 전시 확인 0건이라 화면에는 플레이스홀더·주소 지오코딩·"취급 매장"이 주로 보입니다 (조사 데이터 상태 그대로).
- 로그인/다중 사용자 없음 (테이블은 `user_id`로 분리해 둠). 비교함은 기기별 `localStorage`.
- PWA 오프라인/홈 화면 아이콘 매니페스트는 넣지 않았습니다 (메타데이터만).
- Docker Compose는 작성만 하고 실행 검증 못 함. PostgreSQL은 드라이버 미포함.
- 링크 점검은 수동 CLI이며 봇 차단 사이트는 오판 가능.

## 핵심 가정

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#가정-readme에도-요약) 참고 — 1인 로컬 MVP, 대표가 기반 가격 필터, 진행률 정의, 이미지 권리 미확인 시 비표시, `motion_bed` 등 확장 필드는 선택 사항.
