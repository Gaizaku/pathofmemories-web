# Guild War v2 — registration foundation

Status: isolated prototype, NOT connected to production or live Sheets.

## Decisions

- Cloudflare D1 is the target; this migration has not been applied remotely.
- Keep existing player/event IDs during import. Scope IDs by game.
- Explicit round choice overrides weekly absence; weekly absence overrides regular defaults.
- Regular defaults produce `expected`, not `confirmed`. Resolving attendance never inserts rows.
- Round cancellation and inactive profiles override attendance.
- Resolve Bangkok dates/weekdays on the server. Store actual timestamps in UTC.
- `regular_slots` stores paired weekday/war-type rules. Adapt each applicable slot before calling the resolver; do not flatten arbitrary slots into a cross-product.

## Verification

Run `node --test guild-war-v2/attendance.test.mjs` from the repository root.
The SQL is an initial registration-only schema; not a complete Team Builder migration.

## Next implementation gates

1. Provision a separate test D1 database and validate the migration there.
2. Import a fresh authorized Sheet snapshot into test only. Reconcile IDs, counts, duplicate events and orphan references; infer no historical attendance confirmations.
3. Build week-scoped reads, player-scoped loadouts and transactional writes with revision checks and idempotency keys.
4. No public write API until guest edit authorization is implemented. Remembering a selected player ID is convenience, NOT authentication. Organizer-approved linking or private per-player edit links are candidate low-friction mechanisms.
5. Organizer authorization must precede Team Builder writes. Discord login alone does not grant organizer access.
6. Add audit records in the same write transaction. Show saved only after server confirmation; on failure preserve the draft.
7. Port Team Builder, published immutable team revisions and Summary. Keep published snapshots unchanged by later regular-rule edits.
8. Discord publishing uses an outbox and stored message ID for explicit publish/update, with mentions off by default. Image export is optional after text + Summary links work.
9. Rehearse cutover: freeze old writes, final import/reconciliation, switch primary, retain old system read-only. Never allow independent writes to both databases.

## Not completed

Remote database, API, identity/guest edit credentials, loadout defaults for regulars, UI, data import, performance benchmark, Discord integration and cutover.
Earlier browser timings were rough observations, not proof of cold-start or Sheet read durations. Measure navigation, API and database timing separately.
