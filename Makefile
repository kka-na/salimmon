# Common tasks. `env -u PYTHONPATH` keeps a globally exported PYTHONPATH (e.g. ROS) out of the venv.
PY := env -u PYTHONPATH server/.venv/bin/python
NPM := cd client && npm

.PHONY: setup server server-demo client test test-server test-client test-e2e validate requests

setup:
	python3 -m venv server/.venv
	$(PY) -m pip install -r server/requirements-dev.txt
	$(NPM) ci

server:            ## API on :8000 with research/ (auto-reload on MD changes)
	cd server && env -u PYTHONPATH RESEARCH_WATCH=true .venv/bin/uvicorn app.main:app --reload --reload-dir app --port 8000

server-demo:       ## API on :8000 with the test-only sample dataset and a separate DB
	cd server && env -u PYTHONPATH RESEARCH_DIR=samples/research DATABASE_URL=sqlite:///server/data/demo.db RESEARCH_WATCH=true .venv/bin/uvicorn app.main:app --reload --reload-dir app --port 8000

client:            ## Next.js dev server on :3000 (proxies /api to :8000)
	$(NPM) run dev

test: test-server test-client

test-server:
	cd server && env -u PYTHONPATH .venv/bin/python -m pytest

test-client:
	$(NPM) run typecheck && $(NPM) run lint && $(NPM) test

test-e2e:          ## Starts its own API (:8100) + web (:3100) on sample data; stop `make client` first
	$(NPM) run test:e2e

validate:          ## Validate research/ and print the import report
	$(PY) server/scripts/import_research.py -v

requests:          ## Regenerate research_requests.md from data gaps
	$(PY) server/scripts/import_research.py --write-requests
