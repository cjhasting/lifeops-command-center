# LifeOps Command Center

Get things out of your head, see what matters today, and take the next step.

An iPhone-first, browser-local app built with React 19, TypeScript, Vite and Tailwind. No account, backend, AI service, or environment variables are required.

## Run and preview

Use Node.js 22.12+ (or a supported newer release) and npm.

```sh
npm ci
npm run dev
```

Open the printed address, usually http://127.0.0.1:5173. On Windows, use `npm.cmd` if PowerShell blocks `npm`.

```sh
npm test
npm run build
npm run preview
```

The production bundle is in `dist`; preview usually runs at http://127.0.0.1:4173. The manifest remains available. A service worker has not been added: reliable offline startup is not promised.

For a physical iPhone on the same trusted network, run `npm run dev -- --host 0.0.0.0` and open your computer's LAN address with port 5173. This exposes the development server to that network; the normal command binds only to localhost. Use a separate test origin and disposable data for testing.

## Three places to go

- **Today** opens by default. Choose one priority and up to two supporting tasks. Use Move up, Remove from plan, or Replace an action to shape the day. Tasks are shared records, so edits and completion follow them everywhere. Completed work stays in Completed today, with undo.
- **Inbox** collects thoughts without making them tasks. Search or filter Tasks, Later, Someday, Notes, Completed and Archived. Keep a note, associate it with a chosen project, or select and edit lines to create tasks. Original text and source links remain intact; submitting an already extracted line cannot duplicate it.
- **Projects** shows active outcomes and a next action. Link existing tasks or create one, read notes and history, and retrieve paused or archived projects. Completion updates project activity automatically.

The persistent **Add** control opens one text field. Optional details stay collapsed. Save keeps you on the current screen; a local draft survives dismissal and reload. Ordinary paste and the device keyboard's dictation work without a custom voice service.

**More** contains themes (light/dark/system), detailed daily/weekly/project/custom reviews, lessons, habits, categories, historical missions and check-ins, and backup tools. Existing review and lesson Markdown exports remain available.

## A manageable day

**Later** changes the planned work date, never the existing deadline. Choose Tomorrow, another date, or Someday. Tasks whose planned date has arrived appear in Ready when you are; they are not automatically added to the three-slot plan. Deadlines and due follow-ups remain in Needs attention.

**Make smaller** lets you change the next step or add a minimum version without discarding the task's notes or source.

**Low energy today** stores a separate reduced plan for the current local date: one to three selected tasks, minimum versions, or an essential action. Return to normal without losing either plan. Completing a minimum step does not complete its parent task. Whole-task completion is shared in both modes. Tomorrow starts in normal mode.

**Wrap up today** shows completed and unfinished work, provides tomorrow/postpone/someday/drop choices, asks one optional reflection, and lets you choose tomorrow's first task. Re-saving updates the existing daily review. Dropped tasks remain retrievable in Inbox → Archived and can be restored. If tomorrow already has three actions, the UI explains that choosing a new first task replaces the third slot; its task is retained.

## Data, migration and recovery

Schema version 6 adds captured notes and dated plans while retaining tasks, missions, projects, reviews, lessons, habits, categories, settings, stable IDs, relationships, and unrecognized legacy fields.

On first load, the app reads the old `lifeops:fallback` localStorage snapshot, or the `lifeops-command-center` IndexedDB database (`snapshots` / `app-data`) when no fallback exists. The old app wrote localStorage first, so that copy is preferred. It validates and migrates the data, saves the original to `lifeops:pre-migration`, then writes the new canonical `lifeops:data:v6` snapshot. The old stores are left intact. Failure to read, validate, back up, or save blocks replacement; seed content is never used to mask failure.

Historical mission text remains unchanged. A priority links to a task only when its title is an exact, unique match. Ambiguous and unmatched strings remain visible in history; migration never invents tasks. Reloading version 6 does not rerun string matching.

Version 6 uses one synchronous, atomic localStorage write before updating the displayed state. Save errors remain visible and unsuccessful capture text stays available. This makes success reporting dependable but is limited by browser storage quota. Keep periodic JSON backups, particularly before clearing browser data or changing devices. Storage is scoped to the browser profile and origin (including port); there is no cloud sync or multi-tab conflict resolution.

More → Export JSON includes all records, notes, plans and reduced-plan progress. Import validates first, asks before replacing the dataset, and saves the current data to `lifeops:before-import`. Malformed files do not replace existing records. Replacement is not a merge.

**Download recovery copies** exports a JSON object containing the available raw storage snapshots as strings. To restore one, extract the chosen string (for example `lifeops:pre-migration` or `lifeops:before-import`) into its own `.json` file, then import that file. Keep the recovery download untouched as an extra copy. If initial loading fails, the recovery download remains available on the error screen.

## Dates and repeating tasks

Today, planned dates, completion dates, exports and wrap-up use local calendar dates. The app checks for a new date every ten seconds and on focus/visibility changes. Date arithmetic uses local calendar days rather than assuming every day has 24 hours.

Completing a daily, weekly, or monthly task creates one successor. The schedule starts from its planned date, otherwise its deadline, otherwise the completion date, and advances to the first occurrence after completion. Missed repeats do not create a backlog. Monthly recurrence preserves the original day anchor: January 31 → February 28 → March 31 (February 29 in leap years). If the original has a deadline, the new occurrence gets its new scheduled date as its deadline.

Undo restores the original task and retains the generated successor so that edits to it cannot be erased. Completing the same original again cannot create another successor. Minimum-step completion does not trigger recurrence.

## Verification

```sh
npm test                 # focused migration, persistence and domain tests
npm run build            # TypeScript and production Vite build
npx playwright install chromium webkit
npm run test:e2e          # disposable browser contexts; local server starts automatically
```

The Playwright suite covers capture/drafts/extraction, shared completion, postponement, low-energy progress and date changes, wrap-up, failed saves, full plans, and light/dark responsive views. It uses a fixed America/Chicago clock and does not read your normal browser profile. Screenshots are written under `work/screenshots`.

Implementation verification: 21 focused tests and the production build passed. Interactive Chrome checks exercised the main workflows and all three main screens at 375, 390 and 430 CSS pixels in both themes. A 375 × 420 shortened viewport check covered capture scrolling, long input and 16px form text; keyboard opening, Escape and return to a button were checked. Desktop emulation is not physical iPhone testing. Local Playwright Chromium and WebKit processes failed to launch (SIGABRT) in the execution sandbox; the 26 configured browser cases were listed successfully but are not reported as passed. Real iOS keyboard, dictation, safe-area behavior and Safari still require device verification.

## Structure

- `src/components`: Today, collections, capture, shared task tools, secondary tools and accessible dialog shell.
- `src/domain/data.ts`: migration, validation and shared state transitions.
- `src/state/LifeOpsContext.tsx`: persistence-aware state and legacy tool APIs.
- `src/storage/localDb.ts`: canonical storage and legacy recovery.
- `src/Legacy.tsx`: retained detailed review and lesson tools.
- `tests`: focused state tests, browser workflows and representative disposable backups.

No production deployment or merge is part of this redesign.
