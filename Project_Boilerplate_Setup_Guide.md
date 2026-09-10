# Project Bootstrap Guide
**Auto Warranty Call Center CRM — Frontend-only Boilerplate**
> NOTE: This repository is configured as frontend-only. Backend code and the `packages/api-client` package were removed/moved: the vendored API types now live under `apps/web/src/schema.d.ts` for local frontend development.
*Follow this top to bottom on day 1. Owners are called out per step (BE-A / BE-B / FE) matching the Week 1 task breakdown — this document is what "Week 1, Days 1–2" actually means in commands.*

---

## 0. Stack decisions locked before anyone writes code

Updated for a Python-strong backend team (both devs fluent in FastAPI) — don't relitigate these mid-build:

| Layer | Choice | Why |
|---|---|---|
| Backend framework | FastAPI (Python 3.12, async) | Both backend devs are already fast in it — raw execution speed in weeks 2–3 (the highest-risk weeks) matters more than any framework-convenience trade-off |
| Python dependency mgmt | `uv` | Fast, modern, single-tool dependency + venv management |
| API contract (FE ↔ BE) | FastAPI auto-generated OpenAPI schema → `openapi-typescript` codegen → typed TS client consumed by Next.js | Replaces tRPC (TS-only, can't survive a Python backend). This is still automated — the frontend never hand-maintains API types, it's a build step instead of a shared-language trick |
| External webhooks (VICIdial, GHL, later Moxy/Inline) | Plain FastAPI routes, same app | Third-party contracts aren't ours to shape — REST/webhook is what they support regardless of backend language |
| Frontend | Next.js (App Router) + React + Tailwind | Unaffected by the backend swap — role-specific route groups still map cleanly to Fronter/Closer/Admin/Dashboard |
| Database | PostgreSQL (local: Docker; cloud: RDS Multi-AZ) | Matches the audit/versioning/effective-dating requirements throughout the PRD |
| ORM / migrations | SQLAlchemy 2.0 (async) + Alembic | More control than a lighter ORM for the audit/versioning/temporal patterns this domain needs; idiomatic for an async FastAPI team |
| Validation / schemas | Pydantic v2 | Native to FastAPI, doubles as the source for the generated OpenAPI schema |
| Cache / pub-sub | Redis (local: Docker; cloud: ElastiCache) | Sessions, locks, WebSocket fan-out |
| Real-time transport | FastAPI/Starlette native WebSocket + Redis pub/sub | Same 2-second screen-pop target as before — Python's WebSocket support doesn't change this requirement or the approach |
| Event queue (VICIdial ingestion) | `arq` (async Redis queue) locally; SQS + DLQ on AWS (added week 2–3) | At-least-once delivery with dedup, matches the async FastAPI stack better than a sync-oriented queue |
| Testing | `pytest` + `pytest-asyncio` + `httpx` (backend); Vitest/Playwright (frontend, added week 3+) | Standard, fast, async-native on the Python side |
| Lint/format (backend) | `ruff` + `black` + `pre-commit` | Python-native equivalent of ESLint/Prettier/Husky |
| Lint/format (frontend) | ESLint + Prettier + Husky | Frontend stays TypeScript regardless of backend language |
| CI/CD | GitHub Actions → deploy to dev on push to `main` | Matches Week 1 exit criteria |
| Hosting | ECS Fargate (not Lambda) for the API | WebSocket connections are long-lived — Fargate suits this better than Lambda's request/response model |
| IaC | Terraform | RDS, ElastiCache, ECS, Secrets Manager, IAM |

If anyone wants to deviate from this table, that's a 5-minute team conversation before writing code, not a silent choice made inside a PR.

---

## 1. Prerequisites (everyone, before step 2)

```bash
# Backend
python --version     # 3.12.x
uv --version          # pip install uv, or curl -LsSf https://astral.sh/uv/install.sh | sh

# Frontend (still needed — Next.js is TypeScript)
node --version       # v20.x LTS
pnpm --version        # v9.x

docker --version
git --version

# AWS access (BE-B provisions cloud infra — see §10)
aws --version
aws sts get-caller-identity   # confirm credentials work
```

---

## 2. Repo skeleton

**Owner: BE-B, Day 1 morning.**

Since backend (Python) and frontend (TypeScript) are now different languages, this isn't a single-language pnpm/Turborepo monorepo — it's one repo with independently-tooled apps, plus a generated client bridging them.

```
auto-warranty-crm/
├── apps/
│   ├── api/                # FastAPI backend (BE-A + BE-B)
│   └── web/                 # Next.js frontend (FE)
├── packages/
│   └── api-client/          # generated TS client from FastAPI's OpenAPI schema — consumed by apps/web
├── infra/                  # Terraform (BE-B, cloud provisioning)
├── .github/workflows/       # CI/CD
├── docker-compose.yml        # local Postgres + Redis
└── .env.example
```

```bash
mkdir auto-warranty-crm && cd auto-warranty-crm
git init
mkdir -p apps/api apps/web packages/api-client infra .github/workflows
```

`.gitignore` essentials: `__pycache__`, `.venv`, `node_modules`, `.env`, `.next`, `dist`, `*.pyc`.

---

## 3. Local dev environment (Postgres + Redis)

**Owner: BE-B, Day 1.** Unchanged from the original plan — the datastore choices didn't move with the backend language.

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm_local_dev
      POSTGRES_DB: crm_dev
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7
    restart: unless-stopped
    ports: ["6379:6379"]

volumes:
  pgdata:
```

```bash
docker compose up -d
docker compose ps   # confirm both are healthy before continuing
```

`.env.example` (copy to `.env` per app, fill real values later — never commit `.env`):
```bash
# Database
DATABASE_URL="postgresql+asyncpg://crm:crm_local_dev@localhost:5432/crm_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="replace-with-generated-secret"
JWT_EXPIRES_IN_MIN=15

# VICIdial (BE-A fills in once access is confirmed — see beta review §1)
VICIDIAL_WEBHOOK_SECRET=""
VICIDIAL_API_BASE_URL=""

# GoHighLevel (BE-B fills in once sub-account/OAuth app is created — week 1, per task breakdown)
GHL_API_KEY=""
GHL_WEBHOOK_SECRET=""
GHL_LOCATION_ID=""

# App
ENVIRONMENT="development"
PORT=4000
WEB_URL="http://localhost:3000"
```

---

## 4. Backend scaffold (`apps/api`)

**Owner: BE-A + BE-B, Day 1–2, working in parallel on separate routers from the start.**

```bash
cd apps/api
uv init --python 3.12
uv add fastapi "uvicorn[standard]" sqlalchemy asyncpg alembic pydantic-settings \
  python-jose[cryptography] passlib[bcrypt] arq redis websockets
uv add --dev pytest pytest-asyncio httpx ruff black pre-commit
```

Structure (src layout, `apps/api/src/`):

```
apps/api/src/
├── main.py                    # FastAPI app entrypoint, router registration
├── core/
│   ├── config.py               # Pydantic settings from env vars
│   ├── db.py                   # async engine/session
│   └── security.py             # JWT, password hashing
├── models/                     # SQLAlchemy models — see §5
├── schemas/                    # Pydantic request/response schemas (drives the OpenAPI contract)
├── routers/
│   ├── auth.py                 # BE-B, week 2
│   ├── leads.py                # BE-B, week 2
│   ├── events_ingestion.py      # BE-A, week 2 — VICIdial receiver lives here
│   ├── interactions.py           # BE-A, week 2–3 — interaction_id / call_leg logic
│   ├── qualification.py          # BE-B, week 3
│   ├── transfers.py              # BE-A + BE-B, week 3
│   ├── dispositions.py           # BE-B, week 4
│   ├── realtime_gateway.py        # BE-A, week 3 — WebSocket + Redis pub/sub
│   ├── reconciliation.py          # BE-A, week 4
│   ├── reporting.py               # BE-B, week 5
│   └── integrations/
│       └── ghl.py                # BE-B, week 5–6 — one-way satellite per beta review
├── services/                     # business logic, called from routers
├── audit/                       # audit write-path, used by every module
└── workers/
    └── event_worker.py            # arq worker — VICIdial event retry/dedup queue
```

```bash
uv run python -c "print('env ok')"   # sanity check
```

**This module list is the actual, buildable version of the Week 1–6 task table** — when the task breakdown says "BE-A: build the live event receiver," that work goes in `routers/events_ingestion.py` + `workers/event_worker.py`.

This week, only scaffold the router files with a stub health-check response each, so the structure exists and both backend devs aren't stepping on each other's files later — don't implement real logic yet beyond what Week 1 calls for.

`main.py` starter:
```python
from fastapi import FastAPI
from src.routers import auth, leads, events_ingestion  # add others as scaffolded

app = FastAPI(title="Auto Warranty CRM API")

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(leads.router, prefix="/leads", tags=["leads"])
app.include_router(events_ingestion.router, prefix="/events", tags=["events"])
```

```bash
uv run uvicorn src.main:app --reload --port 4000
```

---

## 5. Database models & migrations

**Owner: BE-B, Day 3–5 — this is the base schema task from Week 1.**

SQLAlchemy 2.0 async models in `apps/api/src/models/`, with the audit/versioning patterns built in from day one (per the full PRD review — don't retrofit this later):

```python
# src/models/base.py
import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

```python
# src/models/core.py
import uuid
from sqlalchemy import String, ForeignKey, JSON, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True)   # fronter | closer | administrator

class Lead(Base, TimestampMixin):
    __tablename__ = "leads"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    phone_normalized: Mapped[str] = mapped_column(String, index=True)
    source: Mapped[str] = mapped_column(String)   # "vicidial" | "ghl" — set up for week 5 GHL intake now

class Interaction(Base, TimestampMixin):
    __tablename__ = "interactions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id"))

class CallLeg(Base):
    __tablename__ = "call_legs"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    interaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interactions.id"))
    vicidial_call_id: Mapped[str] = mapped_column(String, index=True)

class Qualification(Base, TimestampMixin):
    __tablename__ = "qualifications"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    interaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interactions.id"))
    version: Mapped[int] = mapped_column(Integer)
    snapshot_json: Mapped[dict] = mapped_column(JSON)     # immutable once transfer occurs
    consent_dnc: Mapped[dict] = mapped_column(JSON)        # captured even in beta scope — per beta review §3

class Transfer(Base, TimestampMixin):
    __tablename__ = "transfers"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    interaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interactions.id"))
    status: Mapped[str] = mapped_column(String)   # initiated | offered | accepted | rejected | timeout
    fronter_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    closer_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

class Disposition(Base):
    __tablename__ = "dispositions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    stage: Mapped[str] = mapped_column(String)   # fronter | closer
    label: Mapped[str] = mapped_column(String)
    effective_from: Mapped[str] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

class AuditEvent(Base, TimestampMixin):
    __tablename__ = "audit_events"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String)
    entity: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str] = mapped_column(String)
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

```bash
uv run alembic init migrations
# point migrations/env.py at Base.metadata and DATABASE_URL from core.config
uv run alembic revision --autogenerate -m "init"
uv run alembic upgrade head
```

**Get this reviewed by BE-A before Friday of week 1** — per the task breakdown, this schema is what the event-ingestion and interaction logic get built against starting week 2.

---

## 6. Frontend scaffold (`apps/web`)

**Owner: FE, Day 1.** Unaffected by the backend language swap.

```bash
cd apps/web
pnpm dlx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Route structure by role, matching the interfaces in the full PRD (build only Fronter/Closer/Admin/Dashboard for the beta):

```
apps/web/app/
├── (auth)/
│   └── login/
├── fronter/            # Fronter Workspace
├── closer/              # Closer screen-pop workspace
├── admin/               # Admin console (3-role beta scope)
├── dashboard/            # Live dashboard + historical funnel
└── layout.tsx
```

**Day 1 deliverable:** these routes exist and render against **mocked data**, matching the API shape BE-B stubs out in FastAPI (even before real logic exists) — this is what lets FE keep moving every week without blocking on backend status, per the task breakdown's speed rules.

---

## 7. API contract — the thing that gets frozen Friday of Week 1

**Owner: BE-B drafts the FastAPI route/schema shapes, BE-A reviews, FE consumes via the generated client.**

FastAPI generates an OpenAPI schema automatically from the Pydantic schemas and route signatures in `apps/api/src/schemas/` and `routers/`. Once the router stubs and Pydantic response models exist for the core endpoints (auth, leads, qualification, transfers, dashboard live-status), generate a typed TS client into `packages/api-client`:

```bash
# run this from repo root, backend must be running locally
cd packages/api-client
pnpm init
pnpm add -D openapi-typescript
pnpm dlx openapi-typescript http://localhost:4000/openapi.json -o ./src/schema.d.ts
```

`apps/web` imports generated types from `packages/api-client` and calls the API with a thin typed `fetch` wrapper (or `openapi-fetch`, which pairs directly with `openapi-typescript`'s output):

```bash
cd apps/web
pnpm add openapi-fetch
```

```typescript
// apps/web/lib/api.ts
import createClient from "openapi-fetch";
import type { paths } from "./src/schema";

export const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL });
```

**Regenerate the client any time backend schemas change** — add this as a `pnpm` script (`gen:api-client`) so it's a one-command refresh, not a manual chore someone forgets. This is the Python-backend equivalent of "freezing the contract Friday": freeze the Pydantic schemas and route shapes for the core endpoints, generate once, and FE builds real UI against real types with mocked responses — no churn, no waiting on real backend logic.

---

## 8. Lint, format, pre-commit — set up before the first real feature commit

**Owner: whoever finishes their Day 1 task first.**

Backend (Python):
```bash
cd apps/api
uv add --dev pre-commit
```

`apps/api/.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
  - repo: https://github.com/psf/black
    rev: 24.10.0
    hooks:
      - id: black
```

```bash
uv run pre-commit install
```

Frontend (TypeScript) — unchanged:
```bash
cd apps/web
pnpm add -D eslint prettier eslint-config-prettier husky lint-staged
pnpm dlx husky init
```

Non-negotiable per the beta review's speed rules — cheap on day 1, expensive to retrofit across 3 devs' divergent formatting choices in week 4.

---

## 9. CI/CD (Week 1 exit criterion: "CI/CD deploying on push")

**Owner: BE-B, Day 3–5.**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: crm
          POSTGRES_PASSWORD: crm_ci
          POSTGRES_DB: crm_ci
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --frozen
      - run: uv run ruff check .
      - run: uv run black --check .
      - run: uv run pytest

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
```

`.github/workflows/deploy-dev.yml` — triggered on push to `main` after CI passes, builds Docker images for `apps/api` (uvicorn/gunicorn) and `apps/web`, pushes to ECR, updates the ECS Fargate services provisioned in §10. Keep this minimal in week 1; don't build a sophisticated pipeline before there's anything worth deploying.

`apps/api/Dockerfile` (starter):
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev
COPY src ./src
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4000"]
```

---

## 10. Cloud infra (Terraform) — provisioned in parallel with everything above

**Owner: BE-B, Day 1–2, while BE-A is chasing VICIdial access.**

```
infra/
├── main.tf
├── rds.tf          # Postgres, Multi-AZ, PITR on — per full PRD review §2.6
├── elasticache.tf  # Redis
├── secrets.tf       # Secrets Manager: JWT secret, VICIdial webhook secret, GHL API key
├── networking.tf    # VPC, subnets, security groups
├── ecs.tf            # Fargate — API needs long-lived WebSocket connections, not a fit for Lambda
└── variables.tf
```

```bash
cd infra
terraform init
terraform plan -out=dev.tfplan
terraform apply dev.tfplan
```

**Do this for `dev` only in week 1.** Staging and prod can be a `terraform workspace` clone of the same config once `dev` is proven — don't hand-build three environments in parallel on day 1.

---

## 11. Definition of "boilerplate done" — check before moving to Week 2 work

- [ ] `docker compose up` gives a working local Postgres + Redis
- [ ] `uv run uvicorn src.main:app --reload` starts the API locally, `/health` responds
- [ ] `pnpm dev` starts the Next.js app, renders against mocked API responses
- [ ] SQLAlchemy models + Alembic migration run cleanly against local Postgres, reviewed by both backend devs
- [ ] OpenAPI schema generated at `/openapi.json`, TS client generated into `packages/api-client` and imported successfully by `apps/web`
- [ ] `ruff`/`black`/`pre-commit` block a badly-formatted backend commit; ESLint/Prettier/Husky do the same on the frontend
- [ ] CI runs backend (`ruff`, `black`, `pytest`) and frontend (`lint`, `build`) jobs on every push and PR
- [ ] `dev` environment live on AWS via Terraform, `/health` endpoint reachable through the load balancer
- [ ] VICIdial access status known (confirmed or escalated — not silently pending)
- [ ] GHL sub-account + API credentials obtained (no build work yet, per task breakdown)

Once every box is checked, the team moves into Week 2 exactly as scoped in the task breakdown — event ingestion, auth, and roles.
