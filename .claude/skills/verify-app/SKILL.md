---
name: verify-app
description: Launch, drive and verify the static About page in `about/` (Astro) in a real browser at 360/768/1440px. Use after changing anything under `about/`.
---

# verify-app — About page (`about/`)

## Launch
From a clean install:
```sh
cd about && npm ci && npm run build
npm run preview > /tmp/about-preview.log 2>&1 & echo $! > /tmp/about-preview.pid
```
Ready = `curl -s http://127.0.0.1:4321/` returns 200 and contains `<h1`. Fixed port 4321, bound to 127.0.0.1 only.

## Doctor (read-only)
- `node -v` (>=18), `npm -v`
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4321/` is 200
- `ls $PW_DIR/node_modules/playwright` exists. If not: `mkdir -p /tmp/pw && cd /tmp/pw && npm init -y && npm i playwright && npx playwright install chromium` (add `npx playwright install-deps chromium` if shared libraries are missing). Keep this outside the repo.
- `! grep -rE 'https?://' about/dist/index.html | grep -vE 'vansita.design|linkedin.com/in/vansita|contra.com/p/AQcLYsEg'` shows no unexpected URLs (ignore `www.w3.org`-style namespaces if any).

## Drive
```sh
PW_DIR=/tmp/pw node .claude/skills/verify-app/drive.mjs /tmp/about-evidence
```
It loads the page at 360, 768 and 1440px and checks: HTTP 200, one `h1`, no horizontal overflow (`scrollWidth <= innerWidth`), body font >= 16px, tap targets >= 44px, clean console, no failed or third-party requests; clicks `nav a[href="#work|#approach|#contact"]`; checks every external link's href/target/rel; tabs 14 times and checks the focus outline; emulates `prefers-reduced-motion: reduce`. Exit code 0 = all passed.

## Evidence
Screenshots in the output dir: `about-{360,768,1440}-{viewport,full}.png`, `about-1440-focus.png`. Quote the script's PASS/FAIL lines.

## Cleanup
Kill only what Launch started: `kill $(cat /tmp/about-preview.pid) && rm /tmp/about-preview.pid`. Do not kill other node processes.

## Feature map
- `header.site-header` — name/role, nav (Work, Approach, Contact, View portfolio)
- `#main > section.hero` — the single `h1`, lede, Explore my work / Get in touch, metadata
- `section#work` — `ol.rows` of three numbered rows; Pitch Protocol (`.row-lead`) is emphasised
- `section#approach` — three-line editorial statement and supporting line
- `section#contact` — heading, Portfolio and LinkedIn links
- `footer.site-footer` — year, name, "Built with Fredrin"
