# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

salimmon ("우리 집 혼수 도장깨기") — a mobile-first 혼수 catalog + showroom map + compare + stamp-book app. Specs: `docs/개발에이전트_프롬프트.md` (dev brief), `docs/조사MD_작성규격.md` (Research Contract v1 + v2 review section) and `docs/후기_검색범위_판정규칙.md` (review grading rules). Other research-package docs (`docs/침대_종합_보고서.md`, `docs/추가조사_대기열.md`, `docs/검색커버리지_기록.md`, root `DATA_QUALITY.json`) belong to the research agent. Human docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SCHEMA.md`, `docs/API.md`.

## Role boundary (most important rule)

A separate research agent writes all product/price/review/store facts as Markdown in `research/`. This repo's code only reads it. Never invent or edit product facts, prices, coordinates, display status, reviews or images — in `research/`, in code, or in UI copy. Gaps go into `research_requests.md` (generated: `make requests`). Test/demo data lives only in `samples/research/`, is fictional, and every entity has `is_sample: true` and a `[테스트]` name. The user drops new research packages straight into the repo (this has overwritten the root `README.md` and replaced `research/` wholesale); keep dev files out of `research/` and re-check `README.md` after a package drop (the package README is archived in `docs/research-package/`).

## Commands

Node lives at `~/.local/opt/node/bin` on this machine (`export PATH=~/.local/opt/node/bin:$PATH`). The shell exports a ROS `PYTHONPATH`; always run Python with `env -u PYTHONPATH` (the Makefile does).

```bash
make setup                 # venv + pip, npm ci
make server                # FastAPI :8000 on research/, auto-reload on MD changes
make server-demo           # same on samples/research with server/data/demo.db
make client                # Next dev :3000 (proxies /api,/assets → :8000)
make test-server           # pytest (server/tests)
make test-client           # tsc + eslint + vitest
make test-e2e              # Playwright; starts its own API :8100 + web :3100 on samples — stop any running `next dev` first
make validate              # import report for research/ (exit 1 on errors)
cd server && env -u PYTHONPATH .venv/bin/python -m pytest tests/test_api.py -k compare   # single test
cd client && npx playwright test -g "stamps"                                             # single e2e
```

`next build` errors about `@vercel/turbopack-next/internal/font/google/font` mean a stale dev `.next`; `rm -rf client/.next`.

## Architecture

- `research/*.md` → `server/app/research/loader.py` parses frontmatter, validates with `schema.py` (Pydantic, `extra="allow"`), cross-checks references, and collects `Issue`s (path/field/message). Invalid files are excluded but always reported (`/api/validation-report`). Research data is held in memory (`AppState.data`) and reloaded wholesale (watcher, `POST /api/admin/reload`, CLI `--reload-url`); it is never copied into the DB.
- `server/app/catalog.py` makes every derived judgement: representative price + freshness, per-option price tables, rights-gated image display, review independence/buckets (v1 rules + v2 grades), store display relation. The client renders what it gets; keep such rules on the server.
- SQLite (`server/app/db.py`) stores only user-owned rows keyed by research string ids, all with `user_id` (`"local"` via `api/deps.py::current_user_id`). Rows for entities that vanish from MD are kept and reported `orphaned`. Personal quotes are separate from researched prices — never merge them.
- Client: Next 16 with `cacheComponents` — each `app/**/page.tsx` is a server component that only wraps a client view from `src/views/` in `<Suspense>` (URL hooks outside Suspense break prerender). Data via SWR from same-origin `/api` (rewrites in `next.config.ts`, resolved at build time from `API_INTERNAL_URL`). Enum → Korean labels live in `src/lib/labels.ts`; API types in `src/lib/types.ts` mirror `catalog.py` payloads. Compare tray is the only localStorage state.
- Map: `components/KakaoMap.tsx` loads the SDK only when `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` is set; any failure falls back to the store list. Stores without verified coords are geocoded client-side and drawn as dashed "approximate" pins.
- `client/AGENTS.md` (auto-written by `next dev`): this Next version differs from training data — check `client/node_modules/next/dist/docs/` before using unfamiliar Next APIs.

## Invariants to keep

- Never show a price without its `size_or_option`; never merge options; `historical_official` → "과거 확인가", older than `STALE_PRICE_DAYS` → "재확인 필요"; no price → "가격 미확인".
- "전시 확인" only when the store lists the model in `model_ids_on_display` AND `display_status: verified_on_display`. `model.store_ids` alone means "취급 매장".
- Sponsored / grade X / incentive-disclosed / snippet-only / undated / no-URL reviews never count as independent; `sponsorship_status: unknown` must not be shown as 무보상.
- Images with `rights_status: unknown` are not displayed (neutral placeholder + link to the official page).
- Adding a category MD must create a catalog tab with no code change.
