# AI-Powered Skill Assessment & Personalised Learning Plan Agent

This project now includes Clerk auth, RBAC, job management, delayed assessments, and persistent application/assessment history.

## What Is Implemented

- **Clerk authentication** for sign-in/sign-out and user session handling.
- **RBAC (admin/user)** via allowlist emails.
- **Admin HR workflow**:
  - Create jobs with explicit `jobId`.
  - View per-job applicant counts.
  - View started/completed assessment counts.
  - View relative candidate ranking by score.
- **Candidate workflow**:
  - Browse open jobs.
  - Upload resume PDF and apply.
  - Start assessment later (not immediate after applying).
  - Continue chat assessment from history.
- **LLM assessment flow** using Hugging Face chat completions.
- **Assessment history persistence** in local JSON store and Convex schema/functions scaffold.

## Tech Stack

- Backend: Node.js + Express
- Frontend: React (Vite) + shadcn-style UI components
- Auth: Clerk
- Database model: Convex schema/functions scaffold + local JSON persistence for runnable prototype
- LLM: Hugging Face Router API

## Environment Variables

### Root `.env`

Create from `.env.example`:

```bash
copy .env.example .env
```

Set:

- `HUGGINGFACE_TOKEN`
- `HUGGINGFACE_MODEL` (default: `Qwen/Qwen2.5-7B-Instruct`)
- `ADMIN_EMAILS` (comma-separated admin emails)
- `CONVEX_URL` (for Convex deployment usage)
- `CLERK_SECRET_KEY` (if server-side Clerk verification is later enforced)

### Client `.env`

Create from `client/.env.example`:

```bash
cd client
copy .env.example .env
```

Set:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_ADMIN_EMAILS` (same allowlist as backend)
- `VITE_CONVEX_URL`

## Local Setup

1. Install backend dependencies:

```bash
npm install
```

2. Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

3. Run backend:

```bash
npm start
```

4. Run frontend:

```bash
cd client
npm run dev
```

5. Open:

```text
http://localhost:5173
```

## Persistence & Assessment Flow (Convex)

This project now uses **Convex** to persist:

- users, jobs, applications
- per-skill 6-question assessments (**3 MCQ + 3 descriptive**)
- per-skill scores and overall job score
- admin rankings per job

The Node/Express server is still used for:

- `POST /api/parse-resume-pdf` (PDF → resume text)

## Convex Schema/Functions

Convex model and function scaffold is under `convex/`:

- `convex/schema.ts`
- `convex/auth.ts`
- `convex/users.ts`
- `convex/jobs.ts`
- `convex/applications.ts`
- `convex/assessments.ts`
- `convex/analytics.ts`

Scripts:

```bash
npm run convex:dev
npm run convex:deploy
```

### Why you might see no tables in the Convex dashboard

You will see tables only for the **Convex deployment you are connected to**, and after the schema is running and you’ve written data.

Checklist:

- Run `npm run convex:dev` and open the dashboard for that dev deployment.
- Set backend `.env`:
  - `ADMIN_EMAILS=...`
  - `HUGGINGFACE_TOKEN=...` (used by Convex actions; add this in Convex env vars too)
- Set client `client/.env`:
  - `VITE_CONVEX_URL=...` (from the Convex dashboard)
  - `VITE_USE_CONVEX_WITH_CLERK=true`

Once you create a job / apply / start assessment, the tables will populate and appear in the dashboard.

## Note about local JSON store

Older prototype persistence lived in `data/app-store.json` via `src/store.js`. The current UI uses Convex for persistence.
