# Organizer War Schedule

## Intent and scope

Organizers can pause existing Saturday/Sunday Guild War slots for an inclusive date range, then restore them early. Slots resume automatically when the range expires. The user selected organizer controls over a code-only temporary filter.

Initial pause: League 19:30 on both Saturday and Sunday, 2026-10-24 through 2026-11-08 (Bangkok dates). Rank 20:00, 20:30 and 21:00 continue. League next appears on 2026-11-14/15.

## Approaches

- A date-specific code filter is smaller, but every adjustment needs another deployment.
- Selected: persistent pause rules with organizer controls. This adds one table, one authenticated API and one page, while keeping the existing slot identities.
- Arbitrary time/round creation is outside this change because the registration/regular slot model uses the four established time slots.

## Data and behavior

- `war_schedule_pauses`: scoped by game, inclusive `starts_on`/`ends_on`, `slots_json` containing existing `0:1` through `0:4`/`6:1` through `6:4` slot IDs, optional note, creator/time and soft-disable metadata.
- Seed a stable initial pause with `INSERT OR IGNORE`; redeploying must not restore a pause an organizer cancelled.
- `ensureWeekend(db, now, {includePaused=false})` keeps generating/reusing every event ID; its normal event list excludes paused slots. Internal registration editing can request all events with `paused` flags.
- Hiding a slot preserves saved teams, explicit attendance, loadouts, notes and recurring preferences. Saving another round during a pause must retain recurring slots that are hidden; explicitly disabling all recurring registration must still disable them.
- Registration GET/lookup return a `scheduleVersion` derived from visible event IDs; saves must supply the matching version. A stale tab is rejected before writes whether slots were hidden or restored. The client refreshes its schedule and merges saved choices for newly visible rounds while retaining pending edits to previously visible rounds.
- The public registration and Team Builder round lists use the same filtered schedule. Stale registration and publication requests for paused slots receive a clear conflict response.
- Discord announcements support 1–4 selected active rounds. Existing four-round messages and buttons stay compatible, including live edits. The default selection is the active round's local date, so three Saturday rounds never accidentally include Sunday.

## Organizer interface

`/games/where-winds-meet/guild-war/schedule`, linked from the Guild War hub and Team Builder. Organizer authentication is enforced server-side. Show current weekend rounds and existing pauses; create a pause with start/end date, per-day slots and optional note; restore by cancelling a pause. Show loading, success, validation and connection errors without moving the rest of the page.

## API contract

- `GET /api/v2/games/where-winds-meet/war/schedule`: `{today, weekStart, slots, events, pauses}`. Slots: `{slot, weekday, roundNumber, time, warType}`. Pauses: `{id, startsOn, endsOn, slots, note, createdAt}`.
- `POST` same route: `{startsOn, endsOn, slots, note}`; return 201 and `{id}`. Strict real ISO dates, start <= end, nonempty unique valid slots (maximum 8), note <= 240 characters, same-origin request, active organizer.
- `DELETE /war/schedule/:id`: same-origin active organizer; soft-disable only that rule. Audit all mutations and preserve unrelated rules.

## Constraints and verification

Use the existing React/TypeScript, Cloudflare Worker and D1 stack; no additional dependencies. English code comments; Thai and English UI. Run real SQLite integration tests for date boundaries, restoration, data retention, organizer access and stale writes; test variable Discord bundles and existing four-round behavior. Typecheck, production build and full existing suite must pass. Run the new idempotent migration before deploying the new Worker.
