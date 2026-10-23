# Organizer War Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Pause League 19:30 for three weekends and let organizers manage future pauses.

**Architecture:** Persistent inclusive-date pause rules filter the existing weekend event list without deleting events. An organizer page uses an authenticated API. Discord bundles use 1–4 active rounds.

**Tech Stack:** React 19, TypeScript, Cloudflare Workers, D1, Node SQLite tests.

**Spec:** `docs/superpowers/specs/2026-10-23-war-schedule-design.md`

## Global Constraints

- Bangkok dates; initial pause 2026-10-24 through 2026-11-08, slots `6:1` and `0:1`.
- Preserve existing event IDs, teams, registrations, notes and regular settings.
- Active organizers and same-origin writes only for schedule mutations.
- No new dependencies; English comments; Thai/English UI.

## Review Focus

- Hidden recurring League slots survive saving visible Rank rounds; disabling all regular registration remains intentional.
- Cancelling the seeded pause remains cancelled after running migrations again.
- A browser opened before a schedule change cannot register or announce a paused slot.
- Three-round default selection stays on the active Saturday or Sunday.
- Old four-round Discord buttons continue to parse and live-sync.

### Task 1: Persistent schedule and registration integration

**Files:** Create `guild-war-v2/013_war_schedule.sql`, `war-schedule.mjs`, `war-schedule-api.mjs`, `war-schedule.test.mjs`; modify `weekend.mjs`, `member-registration.mjs`, `registration-api.mjs`, `worker/index.ts`, affected database test fixtures and deployment workflow.

**Interfaces:**
- Produces `ensureWeekend(db, now, {includePaused=false})` with default filtered events and optional all-events `paused` flags.
- Produces `isEventPaused(db, game, event)` exported from `weekend.mjs`, true only for paused Where Winds Meet slots.
- Produces `warScheduleApi(request, env, now=new Date())` with the API contract in the spec.

- [ ] Write SQLite tests for six visible rounds on each of the three paused weekends, eight on 2026-11-14/15, stable IDs, data retention, overlap and weekday-specific pauses, access control and invalid input.
- [ ] Run `node --test guild-war-v2/war-schedule.test.mjs`; expect failures for missing schedule behavior.
- [ ] Implement the table, helpers, API, worker routing and registration preservation; reject stale paused selections and paused direct registration writes.
- [ ] Update relevant test fixtures with the migration and add regression tests for hidden member and organizer regular slots.
- [ ] Add the idempotent migration before Worker deployment.
- [ ] Run `npm test`; expect all tests pass, then commit schedule implementation.

### Task 2: Organizer schedule page

**Files:** Create `src/GuildWarSchedule.tsx`, `src/GuildWarSchedule.css`; modify `src/App.tsx`. Parent integration adds Team Builder navigation.

**Interfaces:** Consumes Task 1's `GET/POST /war/schedule` and `DELETE /war/schedule/:id`; produces `<GuildWarSchedule language={language}/>` and `/games/where-winds-meet/guild-war/schedule` route.

- [ ] Implement the page with organizer login state, accessible date inputs and grouped slot checkboxes, live pause list and restore action.
- [ ] Link from the organizer-only Guild War hub and keep styles scoped and responsive.
- [ ] Run TypeScript verification and build; verify validation/error/loading states and narrow mobile layout.
- [ ] Commit page implementation.

### Task 3: Variable round Discord bundles and final integration

**Files:** Modify `guild-war-v2/discord-announcement.mjs`, `discord-announcement-sync.mjs`, `team-publication-api.mjs`, their tests, and `src/GuildWarTeamBuilder.tsx`.

**Interfaces:** Consumes Task 1's `isEventPaused`; retains existing announcement function names and custom ID format, allowing 1–4 rounds. UI derives the active date and selected count.

- [ ] Add tests for valid 1/3/4-round bundles, invalid counts/duplicates/indexes, existing four-round button compatibility, paused-round rejection and three-round live-sync tracking.
- [ ] Run targeted announcement tests; expect failures before implementation.
- [ ] Implement variable bundle validation and keep sync/message ownership behavior intact. Update Team Builder copy, selection validation and current-day defaults.
- [ ] Integrate organizer navigation and all new database fixtures.
- [ ] Run `npm run check` and `git diff --check`; expect all tests, typecheck and build pass.
- [ ] Request a fresh branch review for data retention, server authorization, migration ordering and variable announcements; fix material findings with regression tests.
- [ ] Commit and push only feature changes against verified upstream main; create a reviewable PR.
