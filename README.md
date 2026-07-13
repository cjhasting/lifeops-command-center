# LifeOps Command Center

LifeOps Command Center is a mobile-first, local-first personal operations dashboard. It is built as a tight MVP for planning today, tracking open loops, moving active projects, running a Financial Command Center, writing short AAR reviews, collecting lessons learned, and salvaging low-energy days.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- IndexedDB persistence with localStorage fallback
- No backend, no login, no database required

## Run Locally

```bash
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## Build

```bash
npm.cmd run build
```

The static production bundle is written to `dist/`.

## Deploy To Vercel

This app is a standard static Vite app and can deploy cleanly to Vercel.

1. Push the project to a Git repository.
2. Import the repository in Vercel.
3. Use these settings:
   - Framework preset: Vite
   - Build command: `npm.cmd run build` on Windows or `npm run build` on Vercel
   - Output directory: `dist`
4. Deploy.

No environment variables are required for Version 1.

## Version 1 Features

- Dashboard with Today's Mission
- One-click Start Today flow
- Open Loops with priority, status, stale warnings, due dates, waiting follow-ups, and next-action prompts
- Projects with stale warnings, project AAR starter, archive, and next-action conversion
- AAR Reviews for Daily, Weekly, Project, and Custom reviews
- Lessons Learned library
- Financial Command Center with net worth, allocation tracking, next-dollar recommendation, FI countdown, assumptions, and quarterly review checklist
- Minimum Viable Day mode
- What Am I Avoiding check-in
- Minimal habit check-in without streak language
- Quick Add from anywhere
- Editable categories
- Theme selection: light, dark, or system
- JSON export/import
- Markdown export for AARs and lessons
- Print-friendly review pages for browser Save as PDF
- PWA-friendly manifest

## Data And Backups

All Version 1 data is stored locally in the browser. The primary storage layer is IndexedDB, with a localStorage fallback. Use Settings to export a JSON backup before clearing browser data or moving devices.

## Future Expansion

- Login/authentication: add an auth provider at the app shell, then associate synced records with a user ID.
- Cloud sync: replace `src/storage/localDb.ts` with a sync adapter that reads/writes the same `AppData` model.
- Supabase/Firebase/Postgres: keep the TypeScript interfaces, then map each collection to a table or document collection.
- Calendar integration: add optional due-date and mission events after the local-first task model is stable.
- Apple Health or fitness integration: import high-level summaries only, keeping habits lightweight.
- AI-generated AAR summaries: add an optional AI service wrapper that accepts user-provided review text and returns summaries.
- AI pattern detection: run opt-in analysis over exported/local records and save suggested lessons for approval.
- More AAR templates: add templates beside the existing four AAR types without changing saved review fields.
- Better recurring tasks: expand `repeat` into a recurrence object only after simple repeats feel limiting.
- Push notifications: add opt-in reminders for follow-ups or end-of-day AARs.
- PWA install support: add service worker caching and install prompts if offline use becomes important.
- Mobile app wrapper: package the static app with Capacitor or a similar wrapper after the web MVP settles.
