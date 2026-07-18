# JS Drill

A Next.js app for deliberate JavaScript practice with spaced repetition, pattern tracking, and progress analytics.

## Tech Stack

- Next.js (App Router), React, TypeScript
- SQLite (`better-sqlite3`) with Drizzle ORM
- CodeMirror for in-browser coding
- FSRS scheduling (`ts-fsrs`)

## Project Layout

- `src/app`: Pages and API routes
- `src/components`: UI and feature components
- `src/lib`: Executor, session builder, FSRS logic, and DB access
- `seed-data`: Categories, patterns, and problem JSON
- `docs` and `training-docs`: Architecture and implementation references

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

Seed local database:

```bash
npm run db:seed
```

Reset and reseed:

```bash
npm run db:reset
```
