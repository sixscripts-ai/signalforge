# SignalForge

A data import and validation platform built with **Next.js 16**, **Prisma**, and **Tailwind CSS v4**. Upload CSV files, validate rows against configurable schemas, deduplicate records, and view analytics on import quality.

## Features

- **CSV Import** — Drag-and-drop file upload with real-time parsing via PapaParse
- **Validation Engine** — Row-level validation using Zod schemas with per-field error reporting
- **Deduplication** — Configurable dedupe strategies to catch duplicate records during import
- **Normalization** — Transform raw rows into normalized records with consistent types
- **Analytics Dashboard** — Visual breakdown of import quality, error rates, and record distribution
- **Schema Profiles** — Define reusable field mappings, required fields, and validation rules

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | SQLite (dev) via [Prisma](https://prisma.io) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| CSV Parsing | [PapaParse](https://www.papaparse.com) |
| Validation | [Zod](https://zod.dev) |
| Linting | ESLint |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local — for local dev, use SQLite:
# DATABASE_URL="file:./dev.db"

# Run database migrations
npm run db:migrate

# Seed sample data (optional)
npm run db:seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/            # API route handlers
│   │   ├── analytics/  # Import analytics endpoints
│   │   ├── health/     # Health check
│   │   ├── imports/    # Import job CRUD
│   │   ├── records/    # Normalized records
│   │   └── schema-profile/  # Schema profile CRUD
│   ├── imports/        # Import UI pages
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   ├── AppShell.tsx    # Main app layout
│   ├── ImportTable.tsx # Import job table
│   ├── UploadDropzone.tsx  # File upload component
│   ├── ValidationSummary.tsx  # Validation results
│   └── ...             # More components
├── lib/                # Core logic
│   ├── parser.ts       # CSV parsing
│   ├── normalizer.ts   # Row normalization
│   ├── validators.ts   # Zod validation schemas
│   ├── dedupe.ts       # Deduplication logic
│   └── db.ts           # Prisma client
└── prisma/
    ├── schema.prisma   # Database schema
    └── seed.ts         # Seed data
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
