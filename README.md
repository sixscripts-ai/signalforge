# SignalForge

A data import and validation platform built with **Next.js 16**, **Drizzle ORM**, and **Tailwind CSS v4**. Upload CSV files, validate rows against configurable schemas, deduplicate records, and view analytics on import quality.

## Features

- **CSV Import** — Drag-and-drop file upload with real-time parsing via PapaParse
- **Validation Engine** — Row-level validation using Zod schemas with per-field error reporting
- **Deduplication** — Configurable dedupe strategies to catch duplicate records during import
- **Normalization** — Transform raw rows into normalized records with consistent types, mapping column aliases like `e-mail` to `email`.
- **Intelligent Preprocessing**: Coerces messy data (e.g. `$1,200` to `1200`, `user@EXAMPLE.COM` to `user@example.com`) without discarding rows prematurely.
- **Import Preview & Row Review**: Visualizes valid, auto-fixed, rejected, and duplicate rows before final commit.
- **Durable Audit Trail**: Preserves the original and cleaned state of every row, linked to user actions and import jobs.
- **Schema Profiles**: Define expected structure, transformations, and duplicate keys.
- **Team Management (RBAC)**: Support for workspaces, team invitations, and role-based permissions (Owner, Admin, Member).
- **Activity Log**: Chronological audit trail of workspace actions including imports, schema changes, exports, and team management — visible to owners/admins on the `/activity` page.
- **Vercel-ready**: Built for easy deployment on Vercel with serverless databases like Neon.
- **Analytics Dashboard** — Visual breakdown of import quality, error rates, and record distribution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) |
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
# Edit .env.local — provide your PostgreSQL connection string:
# DATABASE_URL="postgresql://user:password@host:port/database"

# Push schema to database
npm run db:push

# Seed sample data (optional)
npm run db:seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── activity/       # Activity / audit log page
│   ├── api/            # API route handlers
│   │   ├── analytics/          # Import analytics endpoints
│   │   ├── audit-log/          # Audit log query endpoint
│   │   ├── exports/            # Record/row export endpoint
│   │   ├── health/             # Health check
│   │   ├── imports/            # Import job CRUD, preview, confirm
│   │   ├── invitations/        # Invitation acceptance
│   │   ├── records/            # Normalized records
│   │   ├── schema-profile/     # Schema profile CRUD
│   │   ├── v1/                 # Public API (API key auth)
│   │   ├── webhooks/           # Webhook CRUD
│   │   └── workspace/          # Members & invitations
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
│   ├── audit.ts        # Audit log create/query helpers
│   ├── audit-labels.ts # Pure action-label mappings (safe for client components)
│   ├── parser.ts       # CSV parsing
│   ├── normalizer.ts   # Row normalization and field aliasing
│   ├── cleaner.ts      # Safe preprocessing and row cleanup tracking
│   ├── validators.ts   # Zod validation schemas
│   ├── dedupe.ts       # Deduplication logic
│   └── db/             # Database logic
│       ├── index.ts    # Drizzle client
│       ├── schema.ts   # Database schema (10 tables)
│       └── seed.ts     # Seed data
```

## Schema Management

SignalForge uses **`drizzle-kit push`** to apply schema changes directly to the database — no generated migration files are committed. The schema source of truth is [`lib/db/schema.ts`](lib/db/schema.ts).

To apply schema changes after a checkout:

```bash
npm run db:push
```

> **Note:** Running `npm run db:generate` will create migration SQL files in `./drizzle/` if you need version-controlled migrations, but the default workflow uses push-only.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suites |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:push` | Push schema changes to database |
| `npm run db:generate` | Generate migration files |
| `npm run db:seed` | Seed the database |

## Quality Gate & Testing

Before committing or pushing changes, verify that the application passes all quality checks:

```bash
npm run lint
npm run test
npm run build
npm run db:seed
```

## Activity / Audit Log

The **Activity page** (`/activity`) provides workspace owners and admins with a chronological audit trail of important actions. Members cannot access the audit log.

### Logged Actions

| Action | Triggered By | Entity |
|--------|-------------|--------|
| `workspace.created` | Workspace auto-provisioning | workspace |
| `workspace.updated` | Workspace settings change | workspace |
| `import.previewed` | File upload and preview | import |
| `import.confirmed` | Import completion | import |
| `import.failed` | Import failure | import |
| `import.rejected_rows_exported` | Rejected rows CSV download | import |
| `schema_profile.updated` | Schema profile save | schema_profile |
| `records.exported` | Record/row export download | export |
| `member.invited` | Team invitation sent | invitation |
| `member.joined` | Invitation accepted | member |
| `member.removed` | Member removed from workspace | member |
| `member.role_changed` | Member role updated | member |
| `invitation.revoked` | Pending invitation revoked | invitation |

### Privacy & Sensitive Data Policy

- **Raw CSV row payloads, uploaded file contents, and secrets (API keys, webhook URLs, signing secrets) are NEVER logged** in audit metadata.
- Audit metadata is compact and useful: row counts, filenames, changed sections, and role changes.
- Actor email addresses are stored for readable history even if user lookup data changes.
- Audit write failures are caught and logged to console only — they never throw or corrupt the calling transaction.

### API

`GET /api/audit-log` — paginated, filterable (by `action`, `entityType`, `dateFrom`, `dateTo`). Requires owner or admin role. Returns `{ logs, nextCursor }`.

### Manual QA Verification Path

1. **Seed Database**: Ensure `npm run db:seed` runs cleanly to populate default schema profiles and baseline metrics.
2. **Upload Messy CSV**: In the UI, navigate to "New Import", upload a heavily mocked CSV with messy headers, uncoerced amounts, missing fields, and duplicate rows.
3. **Preview**: Verify that rows correctly reflect `auto_fixed`, `needs_review`, `rejected`, and `duplicate` status based on the active schema profile constraints.
4. **Confirm**: Confirm the import. Check the server console or UI to guarantee only clean/fixed rows were persisted.
5. **Inspect & Export**: Open the Import Detail page. Validate the Row Review Table. Click "Export Rejected Rows" and confirm that errors are concatenated in the downloaded file and escaped appropriately.
6. **Dynamic Schema**: Go to "Settings", edit the Schema Profile (e.g. disable `coerceAmounts`), upload the exact same messy CSV, and ensure the pipeline correctly changes its preprocessing behavior to reject rows that were previously fixed.
