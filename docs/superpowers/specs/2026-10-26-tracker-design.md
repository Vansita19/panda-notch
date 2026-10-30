# Tracker

Approved in chat on 26 October 2026 after the simplified checkbox sketch.

- Add Tracker immediately after To-Do, including a Menu entry.
- Begin with Job applications and 15 empty checkbox-sized slots per day.
- Each checked slot records one application; unchecking corrects it. Show the checked count as `0/15` at the far right of the habit.
- Put previous/next arrows around Today. Older dates show their own saved slots; Today returns to the current local day. Next stops at today.
- Keep one compact row per habit, without summary cards, plus/minus counters, charts, or a month grid. At native width, names/counts and the fifteen nearby boxes can occupy two closely spaced lines so boxes keep their current size.
- Add tracker creates a named habit with a chosen daily target of 1–30 boxes. The new-habit form starts at 3, suitable for a three-bottle water habit; existing Job applications keeps its 15. Renaming and removing a habit are quiet contextual actions; removal offers Undo.
- History is a quiet link to recorded dates. Selecting a date returns to that day's rows.
- Use Panda's existing neutral gray surfaces and solid green checks with white marks. Keep keyboard support and reduced-motion behavior.
- Save locally with Panda's existing persistence and JSON backups. An old save receives Job applications once, preserving all other data. An explicitly empty tracker list stays empty.

Implementation choices: day keys use the existing local-calendar helpers, not UTC dates. A selected past date stays selected across midnight; Today follows midnight. Limit new habits to 100 and names to 100 characters, following existing bounded collections. No job details or application services are connected.

30 October update: daily targets are selected on creation, saved independently per habit, and checked against that habit's own box count. Daily masks use up to 30 bits without changing old saved keys or checks. During the November campaign, Today follows its IST date boundary.
