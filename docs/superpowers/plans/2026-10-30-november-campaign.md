# November campaign implementation

Approved routine and implementation authorization are in the user's coordinating chat, “Build a focused 30-day job plan”, on 30 October 2026. The bridge contract is `docs/CAMPAIGN-BRIDGE.md`; this task implements it rather than creating schedules.

## Constraints

- Exactly six undivided work blocks in Asia/Kolkata, November 1–30 inclusive. Exactly 15 company applications and one creative idea + post recur daily.
- Preserve manual tasks, completion, explicit edits/deletions, tracker, notes and all provider calendar data. Only Panda writes its app state.
- Continuing unfinished work advances to its matching block; completed work identities do not become unfinished copies. No missed-day recurrence backlog.
- Compact gray Today note first on Menu; first ordinary entry each campaign day goes home once, without interrupting an active view. Honest upcoming/fallback/accepted guidance status.
- Existing coaching schedules only. No new dependencies, servers/accounts, recording/transcription service, broad file scan or unrelated-data export.

## Work and file ownership

- [x] Pure engine and tests: `src/campaign.mjs`, `tests/campaign.test.mjs` (campaign_engine).
- [x] Native bounded file transport and tests/package support: `native/CampaignBridge.swift`, `native/main.swift`, native tests, `scripts/test-campaign-bridge.sh`, `scripts/package.sh` (campaign_native).
- [x] Local-only scheduled task projection/edit/unlink and tests: planner, EventDetails time helpers, task schedule helper and unlink helper (campaign_local_planner).
- [x] Parent integration: model validation/actions/history filtering, App ready/tick/export/home entry, compact Today note, brief and optional evidence UI, callable brief validator/contract, integration tests.
- [x] Whole change review, complete Node/TypeScript/native transport checks, isolated dated UI checks, real state preservation check.
- [x] Native package to staging, safely install host/UI, reopen real Panda and verify honest pre-campaign note without changing the Mac clock. Save screenshot outside Git.
- [x] Only authorized source/docs/tests selected for commit/push; private app content excluded.

## Interfaces

The pure engine exposes date/brief validation, additive reconciliation, visibility, progress, evidence and home-entry helpers. It imports no model/history modules. Tasks use `campaign` metadata and separate local `plannedTime`, never fabricated EventKit links. Model actions include campaignBrief, campaignHomeSeen, campaignEvidence and taskPlannedTime. The native transport emits campaignBrief/campaignBridgeStatus and consumes host campaignProgress. The exact public JSON envelope is documented in the contract.

## Verification focus

Idempotent revisions, malformed/future/stale data, preserved manual edits/deletes/completion, continuing vs recurring identities, observed-day histories without invented offline completions, IST boundaries independent of host timezone, local schedule actions without provider writes, minimal progress privacy and freshness, home entry without repeated hijacks, bounded safe file IO and existing full regressions.

## Verified results

- 329 Node tests, TypeScript check, offline frontend build, 16 native bridge tests and normal signed package verification pass.
- Isolated mounted November UI: exact six slots, completed/continuing labels, review save, daily first opening without an active-view interruption, Tracker date arrows and independent counts.
- Native application reopened with all existing tasks, notes, pins, ideas, calendar settings and Tracker data preserved. Prepared revision 3 remains staged with zero early campaign tasks; the minimal export is fresh.
- Native sorted-key saves round-trip through strict campaign validation. Whole-month evidence exports fit the bounded 5 MB cap; rejected exports preserve the previous snapshot.
- Independent review findings (size cap and IST Tracker boundary) are fixed and re-reviewed. Private ambition and machine-specific coordination paths remain in local configuration/guidance, outside Git.

## Same-day user simplification

- Home now shows one short encouraging Today note, without the long routine, assigned focus or goal. Optional review remains in existing task details.
- Daily defaults use generic editable names and dated identities. Completed blocks get fresh generic blocks the next day; unfinished customized continuing work retains its identity and matching slot. Existing application/post recurrence stays unchanged.
- New trackers choose their own 1–30 box daily target. Existing Job applications remains at 15, with all saved checks preserved.
- 334 full tests, TypeScript and build pass. Mounted checks cover a three-box habit, persistence, task rename/reopen and saving a review in its relocated task details. Native UI assets match the build and the reopened app preserves existing data.
