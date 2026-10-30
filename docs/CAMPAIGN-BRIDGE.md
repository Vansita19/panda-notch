# Panda November campaign bridge, version 1

Panda alone writes its app state. The coach writes `brief.json` atomically in the authorized shared `panda-bridge` directory. Panda reads that file and atomically exports `progress.json` there. No import/replacement of Panda state, server, account, new schedule, recording service, or calendar-provider write is involved.

Default bridge directory: `~/Library/Application Support/Panda/Campaign`. A bounded regular local file at `~/Library/Application Support/Panda/campaign-bridge-location.txt` can point to the explicitly authorized shared campaign folder. Machine-specific paths and personal guidance stay outside source control. Native tests may override with `PANDA_CAMPAIGN_DIR`.

## brief.json

```json
{
  "schema_version": 1,
  "campaign_id": "november-2026",
  "timezone": "Asia/Kolkata",
  "date": "2026-11-01",
  "revision": 1,
  "issued_at": "2026-10-30T16:00:00Z",
  "opening": "One block at a time.",
  "main_focus": "Choose what to work on in each block.",
  "project_id": "current-work",
  "blocks": [
    {"slot":"applications","work_id":"applications:2026-11-01","title":"15 company applications","deliverable":"Submit 15 suitable company applications and record them in the existing dashboard.","done_when":"15 company applications submitted; follow-ups are separate.","first_action":"Open the prepared company-role queue."},
    {"slot":"visibility","work_id":"visibility:2026-11-01","title":"Creative idea + post","deliverable":"Develop one new creative idea and publish one clear post.","done_when":"One new idea and its post are saved/published.","first_action":"Choose one idea grounded in your work."},
    {"slot":"portfolio","work_id":"portfolio:2026-11-01","title":"Portfolio","deliverable":"Work on the portfolio item you choose.","done_when":"Your chosen portfolio step is complete.","first_action":"Choose what to work on in your portfolio."},
    {"slot":"project","work_id":"project:2026-11-01","title":"Main project","deliverable":"Work on your current project.","done_when":"Your chosen project step is complete.","first_action":"Choose the next step for your project."},
    {"slot":"learning","work_id":"learning:2026-11-01","title":"Applied learning","subject":"Your choice","deliverable":"Apply learning of your choice to your current work.","done_when":"Your chosen learning step is complete.","first_action":"Choose what you want to learn and apply."},
    {"slot":"interview","work_id":"interview:2026-11-01","title":"Interview practice","deliverable":"Practice for interviews in the way you choose.","done_when":"Your chosen practice is complete.","first_action":"Choose what you want to practice."}
  ]
}
```

All six slots are required, exactly once. Work IDs are stable for a continuing deliverable; change the ID only for a genuinely new work item. Applications and visibility are recurring dated occurrences; their IDs are normalized to their slot/date. Learning must name one subject; the envelope's project_id binds project and applied learning to the same project. Optional `goal` remains plain text up to 2,000 characters for backward compatibility; Home does not show the goal, assigned focus, or six-block brief. Home has a Today note with one short sentence and a link to the existing To-Dos. Each text field is plain text; no HTML or executable instructions are interpreted. The goal is an aspiration, never an income promise.

Times are fixed in Asia/Kolkata, not supplied by the coach: applications 07:00–10:00; visibility 11:00–12:00; portfolio 12:00–14:00; project 15:00–17:00; learning 17:30–20:00; interview 20:00–22:00. All intervening breaks remain free.

Panda applies only the matching current November date. A prepared future brief can remain at the path but is not applied early; it is reconsidered when its date arrives. Invalid, wrong-campaign, stale-date, future-issued (>5 minute clock allowance), and non-increasing revisions do not overwrite accepted guidance or explicit edits. A missing/late brief uses generic editable blocks and existing carryover. Built-in work IDs use slot/date for all six blocks, with `current-work` as the project and `Your choice` as the learning subject. A completed block gets a fresh generic block the next day. Unfinished portfolio, project, learning and interview work keeps its task ID and work ID in the matching next-day block; applications and visibility remain fresh daily occurrences. Completed work IDs are not recreated as unfinished copies; unfinished continuing work wins its matching block over a different newly suggested work item. Current-day user edits, completion, deletions and manual tasks are preserved. Pending legacy built-in work is generalized only when its last-applied content identifies the old defaults; individual edited fields, ownership IDs and completed tasks are preserved.

## progress.json

Panda exports this envelope after authoritative state saves and periodically while running. Brief files are bounded to 128 KiB; progress is bounded to 5,000,000 bytes, matching the existing app-state save limit and accommodating a month of explicitly supplied reviews. A failed state save disables progress export until a later successful save.

```json
{
  "schema_version":1,"campaign_id":"november-2026","timezone":"Asia/Kolkata",
  "checked_at":"2026-11-01T16:30:00.000Z","date":"2026-11-01",
  "app_state":"running",
  "brief":{"source":"coach","date":"2026-11-01","revision":1,"issued_at":"2026-10-30T16:00:00Z"},
  "days":[{"date":"2026-11-01","tasks":[{"task_id":"campaign-owned-id","slot":"project","work_id":"project:2026-11-01","title":"Main project","status":"pending","carried_from":null,"start":"2026-11-01T09:30:00.000Z","end":"2026-11-01T11:30:00.000Z","evidence":[]}]}],
  "applications":{"date":"2026-11-01","tracker_id":"job-applications","count":0,"slots":15,"source":"tracker"}
}
```

Task statuses: `pending`, `done`, `deleted`. Each day's task snapshot is frozen before a continuing item advances to a new matching block; its work_id stays stable. References and self-review are optional in an owned task’s existing event details, rather than Home. Evidence is explicitly user supplied: `[{"ref":"/absolute/local/path-or-https-url","self_review":"Short user-written review"}]`. Panda exports references/text only, never opens/scans/uploads those files. No unrelated tasks, notes, pins, contacts, or calendar data are exported. If the application tracker is absent, count is `null` and source is `unavailable`; no replacement tracker or invented count is created. During the campaign, Tracker's Today/navigation and new checks use IST dates, preserving all existing saved day keys; campaign completion visibility uses the same IST boundary even if the Mac's timezone changes.

The coach must compare checked_at to its run time and the requested date. A closed/offline app cannot export live progress: an old checked_at is stale, not proof of no work. On reopening, Panda prepares the current campaign day from the last saved owned work and the available brief, without accumulating missed daily recurrences. The existing coaching runs remain the only 06:30/22:00 schedules.

Implementation paths: `src/campaign.mjs` (validation, additive reconciliation, snapshots), `native/CampaignBridge.swift` (bounded local file transport), `src/components/CampaignToday.tsx` (small Today note and optional review), `src/components/TaskPlanner.tsx` (review access from task details), and existing App/model integration. The local routine is usable even when guidance is late. General audio/video listening or transcription is not supplied.
