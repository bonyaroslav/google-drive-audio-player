This repo is a **Google Apps Script Web App + Google Drive** audio playlist/player.

**Root files:**
- `Code.gs` — backend (Drive listing + injects `itemsJson`)
- `Index.html` — frontend (UI + HTML5 audio player)
- `README.md` — user-facing overview + deploy steps
- `PROJECT_NOTES.md` — technical notes + decisions + trade-offs

## Read first
- `README.md` (setup/deploy expectations)
- `PROJECT_NOTES.md` (architecture, data contract, testing, decisions)

## Mission
Make **small, safe, reversible** changes that improve:
- playback reliability on Android browsers
- maintainability (CONFIG-driven, clean code)
- operational simplicity (no extra infra/cost)

## Hard constraints
- Google-only: Apps Script Web App + Drive (no Firebase/GCS/DB/frameworks)
- Keep `Code.gs` and `Index.html` in repo root
- No third-party scripts/trackers by default
- Do not use `innerHTML` with user-controlled strings (filenames/titles). Use DOM + `textContent`.

## Compatibility contract (must not break)
- Template: `HtmlService.createTemplateFromFile('Index')`
- Injected variable: `itemsJson` consumed by `Index.html`
- Data fields required by UI (see `PROJECT_NOTES.md` → Data Contract)

## Change process
1) Check `PROJECT_NOTES.md` decisions/trade-offs before altering behavior.
2) Implement smallest viable diff (prefer CONFIG toggles for risky changes).
3) Update docs:
   - If user steps change → update `README.md`
   - If tech behavior or decisions change → update `PROJECT_NOTES.md`

## Minimum sanity test
(Full checklist in `PROJECT_NOTES.md`)
- page loads, list renders
- select item plays (or shows “press Play”)
- seek works (native + +/- buttons)
- next/prev works; auto-next best-effort
- download + “Open in Drive” fallback works

## Definition of done
- Preserves compatibility contract
- Passes minimum sanity test
- Updates `README.md` / `PROJECT_NOTES.md` if needed
