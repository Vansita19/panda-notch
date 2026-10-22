# Panda Notch

![Interface preview](docs/images/preview.jpg)

A small macOS companion that keeps tasks, focus time, and calendar reminders close at hand, with a panda named Bubu living beside the camera notch.

Designed and built by [Vansita Addanki](https://vansita.design).

## The idea

Useful reminders disappear when they live in another tab. Panda brings the next event, today's tasks, and gentle breaks into a compact panel that can expand when needed.

## What works

- Tasks with completion progress beside the panda and a panel that grows with the list.
- A focus timer, short and long breaks, and optional sound.
- Calendar access through macOS EventKit, requested explicitly by the app.
- Ideas, saved links and files, and configurable reminders.
- A native macOS shell with a React interface and animated interactions.

## Try the interface

With Node.js 22 and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc
pnpm build
python3 -m http.server 47824 --directory dist
```

Open http://localhost:47824. The browser preview uses sample events; native calendar and notch placement require the macOS app.

## Build the macOS app

On an Apple Silicon Mac running macOS 14 or later, with Xcode Command Line Tools installed, build the frontend above and then run:

```sh
zsh scripts/package.sh
```

The script creates `Panda.app` next to the repository folder. This is a development build with an ad-hoc signature, not a notarized public release. Source is provided so the app can be inspected and built locally.

## Structure

- `src/`: React interface, interaction components, and state model.
- `native/`: Swift AppKit/WebKit shell and EventKit calendar bridge.
- `tests/`: state, task-progress, and motion checks.
- `assets/audio/`: interface sounds.
- `assets/menu/`: the local Figma artwork used by the Menu cards.
- `scripts/`: frontend and native build tooling.

No personal tasks, calendar exports, or saved application data are included. See `THIRD-PARTY-NOTICES.md` and `licenses/` for dependency and component credits.

## Everyday tools

### Menu
Panda starts at **Menu** on first use, with cards for **To-Do**, **Focus**, **All links**, **Ideas**, and **Reminders**. It remembers the last feature you used and returns there when reopened, including after relaunching the app. Settings preserves that destination. Scroll the Menu sideways to reach every card, or use Tab and the arrow keys. Cards are 200 pixels square at Retina resolution, with proportionally scaled artwork, icons, and labels. Overflow edges fade softly. While hovered, each card has its own slow, continuous motion: drifting task glows, a breathing Focus glow, moving link bars at their original brightness, an Ideas glow, and reminder waves expanding and fading outward. Leaving eases back to the original artwork over one second, then stops. Keyboard input, reduced-motion preferences, or dismissal stop decorative motion. Tabs appear after entering a feature and remain available when returning to Menu.

A divider separates the Menu cards from a compact charcoal calendar widget: a blue inset-glow date tile shows the weekday and that day's full event count, beside up to two remaining events, with the first highlighted and the second muted gray. An event already underway is labeled Now. When today has no remaining events, the widget uses the next event's day. Clicking its date or an event opens Mac Calendar; no widget is shown when there are no remaining events.

To-Do, All links, Ideas, and Reminders fit their content when opened, up to the available screen height. Longer content scrolls. Manually resizing the current view keeps that height until the next view entry; the saved width remains available.

### Expand the task calendar
In **To-Do → Today**, add your to-dos, then choose **Expand** or click a task to reveal today’s calendar beside the same list. Click a task’s dot, move to the calendar, and drag from the start time to the end time. Hover previews are dotted; selecting fills the span blue. You can drag in either direction; intervals use 15-minute steps. Press Escape to cancel a selection before saving. Connected tasks are saved in the selected writable Mac calendar. Saved tasks remain connected to their calendar blocks by gray threads; hovering or interacting highlights the connection in blue. Drag a block’s body to move it while keeping its duration, or its bottom edge to resize it. Choose **Compact** to return to the checklist with scheduled times beside task names.

The expanded planner gives equal space to tasks and calendar. Task names stay left; scheduled times and priority signals sit at the right edge, then slide left to reveal edit and delete controls on hover or keyboard focus. Long names and metadata wrap when needed.

The right calendar scrolls independently of the left checklist, with the hour-range controls kept in place. Long checklists can scroll separately too. Threads follow visible blocks and disappear when either endpoint is outside its column; scrolling does not rerender the task list. Calendar hour labels and range controls use a 12-hour AM/PM clock. Click a task's priority signal to cycle Low (green), Medium (yellow), and High (red) without opening its calendar.

**This Month** replaces the checklist with a Monday–Sunday calendar and has no Expand control. Each recorded day shows its completed/total count inside a progress ring. Daily counts follow the same list as Today and freeze when Panda observes a new local day; missing offline days are left unknown. Before this feature was installed, saved tasks only provide evidence of additions and completions, so those older cells show that evidence without inventing a total. History is kept locally for up to 3,660 observed dates and travels with JSON backups.

In Compact, the pencil renames the task inline: Enter or leaving the field saves; Escape cancels. In the expanded calendar, clicking a block opens its details below that item. Valid name and time edits autosave; each time field has 15-minute steppers. Low, Medium, and High priorities use one, two, or three lit signal bars. Linked blocks also have color and unlink controls. Deleting a linked task removes its owned calendar event first; Undo restores the task and recreates that event. If Calendar cannot confirm removal, Panda keeps the task and reports the error. Confirmation bubbles appear separately below the notch without covering the list.

### Focus
The **Focus** tab uses a recessed circular dial with **Work**, **Short break**, and **Long break** modes. Idle duration fields show Hours:Minutes with H/M labels: click to type, scroll the continuous number reel, or use the arrow keys. A boxed five-minute stepper rolls through the intermediate values, with the Start button below. Durations remain between one minute and two hours. Running and paused sessions show Minutes:Seconds; the colored gradient fills the elapsed sector along with the edge progress. Pause/Resume and Reset preserve existing sessions, and idle entry defaults to Work. Reduced motion keeps the picker transitions still.

### All links
The All links tab stores reusable web links and local file copies. Compact rows show a glowing icon tile and the name; the underlying address stays available through Copy and Open. Add a link and use Copy; add a file with the Mac file picker and drag its row into a compatible app or upload field. The file Copy button also supports pasting into Finder and other file-aware apps. Files remain on this Mac in `Application Support/Panda/Pins`; originals are never modified. Pin the file again after updating your résumé. Files are limited to 50 MB each and there are at most 200 pins. Removing a pin hides it and offers Undo; its local copy remains available for recovery. JSON exports include pin metadata, not attachment contents, so keep the Pins folder with a full backup. File selection and native file dragging are available in the Mac app; the browser preview supports links.

### Ideas
Ideas opens the current note as a clean writing canvas with an editable title. Drafts and existing-note edits save locally as you type. **All notes** shows a four-column grid of note cards with only the title and saved date; **Back** returns to the current note. Opening the grid saves a nonempty draft into the collection, and **New note** starts another canvas. Existing untitled notes use their first line as the card title without rewriting their content. Deleting a note offers Undo in the detached confirmation bubble.

### Copy text from screen
Click the cursor beside the notch menu, or the menu-bar paw → **Copy text from screen…**. Drag a rectangle around the text; Escape cancels. Panda invokes macOS interactive screenshot selection directly, without the redundant full-screen permission preflight that could reject an enabled permission. macOS still controls capture access. Apple Vision recognizes the selected text locally and copies it for Command-V. No account or upload is involved; the temporary image is deleted after processing. Cancel leaves the clipboard unchanged. No window-sharing picker, continuous recording, or capture history is used.
