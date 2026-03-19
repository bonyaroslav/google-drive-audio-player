Technical notes + decisions log (single file by design). Keep it concise.

---

## 1) Architecture (high level)
- **Storage:** Google Drive folder (`FOLDER_ID` Script Property) contains audio files.
- **Backend:** Google Apps Script Web App (`doGet`) lists Drive files and injects `itemsJson` into `Index.html` via HtmlService templates.
- **Frontend:** `Index.html` renders playlist UI and controls playback via HTML5 `<audio>`.

Official docs:
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- HtmlService templates: https://developers.google.com/apps-script/guides/html/templates
- Apps Script Drive service (DriveApp): https://developers.google.com/apps-script/reference/drive
- HTML `<audio>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio

---

## 2) Data Contract (itemsJson)
UI expects an array of items with at least:
- `id` (Drive file id)
- `name` (filename)
- `createdMs` (number)
- `createdStr` (string for display)
- `book` (string)
- `title` (string)
- `number` (int; optional but currently displayed)
- `url` (direct play/download URL, usually `uc?export=download&id=...`)
- `viewUrl` (Drive file view URL fallback)

Notes:
- Newest-first display is by `createdMs` desc.
- Episode numbering: oldest = `#1`, newest = `#N`.
- `createdStr` is rendered as date only (`yyyy-MM-dd`).

---

## 3) Frontend behavior (Index.html)
- Central `CONFIG` controls:
  - playback mode toggle: `driveOnly` by default, `experimentalHtmlAudio` optional
  - pagination (`itemsPerPage`, default `10`) with a single bottom pager control
  - autoplay-on-select (best-effort), auto-next on ended when experimental audio is enabled
  - seek step buttons (e.g., -10s/+30s) in experimental audio mode
  - UI language options (`uk`/`ru`/`en`) with Ukrainian default on fresh clients; selected language persisted in versioned cookies and `localStorage`
  - optional resume position via `localStorage`
  - numbering mode: `episodeNumberMode` (`backendGlobal` by default; also `perBook`/`none`)
  - recent-feed layout with featured latest item, large card actions, refresh affordance, and iPhone-first sizing
  - list actions: primary button opens Google Drive in a new tab/window; explicit "Select record" buttons are removed
  - items are grouped by parsed `book` name (filename prefix before the first `.`)
- Defensive rendering:
  - avoid `innerHTML` for user-controlled strings; use DOM + `textContent`.
- Reliability UX:
  - default UX avoids custom Drive streaming and instead directs users to Drive's own viewer for playback
  - user-facing errors should be plain guidance; technical details stay in debug logging / console
- Diagnostics:
  - `?debug=1` in URL enables in-page debug panel and console logs at runtime.
  - Refresh button adds a cache-busting query parameter and bypasses `CacheService` for that request.
  - Page title is set server-side via `HtmlOutput.setTitle()`. Description/theme-color/icon hints are applied client-side because `HtmlService` does not support arbitrary head tags directly.
  - Early bootstrap logger (`window.__bootLog`) is initialized before main app script and captures `window.error` / `unhandledrejection`.
  - UI shows `build` timestamp to verify the active Web App deployment version.

---

## 4) Backend behavior (Code.gs)
- Reads files from Drive folder; filters `.mp3/.ogg/.m4a`.
- Backend configuration is centralized in `BACKEND_CONFIG` (`maxFiles`, `allowedExtensions`, `cacheSeconds`, timezone, defaults).
- Folder source: Script Property `FOLDER_ID` (required). `Code.gs` throws a clear error if missing.
- Parses book/title from filename pattern:
  - split by the first `.` in the base filename. Text before the first dot is `book`; text after it is `title`. If the dot is absent, item falls back to default book and full base filename as title.
- Injects JSON into template using `safeJson_()` (escape for `<script>` context, including `<`, `>`, `&`, `U+2028`, `U+2029`).
- Frontend data path: parse `<script type="application/json" id="itemsData">`.
- Optional caching:
  - `CacheService` with small TTL (e.g., 120s) to reduce Drive calls.
- Backend payload is limited to a recent window (`100` by default) before returning `itemsJson`; frontend paging shows `10` items per page.

---

## 5) Operational notes / known trade-offs
- **Autoplay restrictions:** mobile browsers may block autoplay until a user presses Play once.
- **Playback/seek reliability:** custom HTML5 `<audio>` playback from Drive download-style URLs is not a documented/supported streaming contract; reliability depends on how Drive serves media + browser behavior. Drive's own viewer is the safer browser playback path. MP3 is typically most compatible.
- **Privacy model:** relies on Drive sharing + Web App access. “Anyone with link” is unlisted public.
- **Scale:** huge folders can slow listing; keep “active” folder limited (e.g., last 100–300 files) and archive elsewhere.

---

## 6) Testing checklist (manual)
Minimum:
1) page loads + list renders
2) selecting item plays or indicates “press Play”
3) seek works (native slider + +/- buttons)
4) next/prev works
5) auto-next works (best-effort)
6) download link works
7) “Open in Drive” works (always)

Android focus:
- test on target tablet + Chrome
- confirm seeking works for the chosen format (prefer MP3 for V1)

---

## 7) Decisions log (ADR-lite)
### 2026-02-18 — Google-only (Apps Script Web App + Drive)
**Decision:** Use Apps Script Web App for UI and Drive folder for storage.  
**Why:** Zero extra hosting cost; simplest daily workflow (upload → refresh); one stable URL.  
**Trade-offs:** Playback/seek depends on Drive delivery; privacy depends on sharing settings.  
**Alternatives considered:** Google Sites, Firebase, GCS static hosting.

### 2026-02-18 — Avoid innerHTML for filenames/titles
**Decision:** Render user-controlled text using DOM + `textContent`.  
**Why:** Prevent injection issues via filenames.  
**Trade-off:** Slightly more verbose UI code.

### 2026-02-18 — Escape JSON for template injection
**Decision:** Use `safeJson_()` to escape JSON (`<`, `>`, `&`) before embedding in HTML template.  
**Why:** Prevent breaking `<script>` context / injection.

### 2026-02-18 — Parse `itemsJson` from JSON script tag
**Decision:** Render `itemsJson` into `<script type="application/json" id="itemsData">` and parse from DOM text (`JSON.parse(textContent)`).  
**Why:** Prevent frontend script parse failures from data edge cases while preserving the same `itemsJson` compatibility contract.  
**Trade-off:** Slightly more DOM code in initialization.

### 2026-02-18 — Optional caching of Drive listing
**Decision:** Use CacheService with short TTL (e.g., 60–300s).  
**Why:** Faster loads; fewer Drive calls; acceptable delay for new uploads.  
**Trade-off:** New files may appear after TTL.

### 2026-02-19 — Centralized UI localization + language selector
**Decision:** Move user-facing strings into one localization dictionary and add a top-right language selector in `Index.html`. Ukrainian is now the default UI language, with Russian and English also available.  
**Why:** Easier maintenance and safer text updates; no behavior change in backend contract.  
**Trade-off:** Slightly more frontend state handling (language persistence/re-rendering).

### 2026-02-19 — Playlist pagination (10 items/page)
**Decision:** Paginate rendered playlist to 10 items per page by default (`CONFIG.itemsPerPage`) and render a single pager below the list.  
**Why:** Better usability for long playlists without duplicating controls at the bottom of the page.  
**Trade-off:** Returning to page navigation requires scrolling to the list footer.

### 2026-03-19 — Forced refresh bypasses browser and Apps Script cache
**Decision:** The refresh button now navigates to the current page with a `refresh` query token, and `doGet(e)` bypasses `CacheService` for that request.  
**Why:** `window.location.reload()` alone could still show stale data because of browser/app cache and the backend cache TTL.  
**Trade-off:** Forced refresh generates an extra uncached Drive listing for that request.

### 2026-03-19 — Centralized page metadata config
**Decision:** Keep page title, description, theme color, and optional favicon URL in `BACKEND_CONFIG`. Set the title server-side and apply the remaining head metadata client-side.  
**Why:** Apps Script officially supports server-side title and favicon APIs, but arbitrary `<meta>` / `<link>` tags are not reliably preserved in `HtmlService` output.  
**Trade-off:** Description/icon hints added client-side are best-effort and may not be used by every crawler or bookmark surface.

### 2026-03-19 — Avoid SVG in `setFaviconUrl()`
**Decision:** Keep `BACKEND_CONFIG.faviconUrl` empty until a supported PNG/ICO favicon asset is available.  
**Why:** An SVG favicon URL caused runtime failure: `Exception: The favicon icon image type is not supported.`  
**Trade-off:** Server-side favicon remains unset for now; client-side fallback icon hints may still help some bookmark/tab surfaces but are not equivalent to `setFaviconUrl()`.

### 2026-03-18 — Drive-first mobile playback + recent-feed layout
**Decision:** Default the UI to `playbackMode: 'driveOnly'`, show a recent-feed layout, and keep embedded HTML audio behind an experimental config flag.  
**Why:** Google Drive viewer is the more reliable playback path on iPhone 12 Safari/Chrome and on Android browsers.  
**Trade-off:** Default UI no longer exposes in-page seek/player controls unless experimental mode is enabled.

---

## 8) Near-term plan / safe improvements

### Planned removal: custom "Play in browser" feature
**Status:** planned  
**Reason:** Current implementation uses Drive download/open URLs as `<audio>` sources. Investigation found evidence that Drive officially supports browser playback in Drive's own viewer, but not a stable custom HTML5 audio streaming contract from `uc?...` links. The current UI can therefore imply support that is not reliably available.

Small, reversible steps:
1) Remove the list-level "Play in browser" action and stop advertising browser playback as a capability.
2) Make "Open in Google Drive" the primary file action.
3) Move all technical playback errors to `console` / debug logging only; show users plain guidance instead of error codes.
4) Keep the embedded `<audio>` area hidden behind a config flag for experiments only; default mode is Drive-first.
5) Update README wording so user expectations match the actual supported path.

### Improvement candidates (Google-only / low-risk)
1) **Load only the newest N files in backend**
   - Add `MAX_FILES` config in `Code.gs` and return only the newest items after sorting.
   - Default should be `10`.
   - Important distinction: frontend paging alone is not enough; the backend should avoid sending more than the newest 10 items to mobile clients.
   - Benefit: faster load, smaller HTML payload, simpler UI, fewer Drive calls.

2) **Separate backend limit from UI page size**
   - Keep `MAX_FILES` for backend fetch size and `itemsPerPage` for frontend rendering.
   - In the chosen product direction, both can default to `10`, but they should remain separate settings.
   - Benefit: cleaner operational control. For example: fetch 10 total now, or fetch 30 and show 10 per page later without reworking the UI.

3) **Prefer a recent-window playlist over full-history browsing**
   - Treat the folder as an "active" feed of recent files, and archive older files elsewhere.
   - Benefit: operational simplicity without adding infrastructure.

4) **Add explicit mode toggle in CONFIG**
   - Example: `playbackMode: 'driveOnly' | 'experimentalHtmlAudio'`.
   - Default to `driveOnly`.
   - Benefit: future experiments remain reversible and do not mislead users.

5) **Improve empty/error states**
   - Replace codec-style errors with plain guidance such as "Open in Google Drive to play".
   - Write technical details only to console / debug output.
   - Benefit: less confusing UX and fewer false promises.

6) **Reduce frontend complexity after feature removal**
   - Remove fallback candidate URL logic, unsupported-by-id cache, watchdog retry logic, and browser-play gating if `driveOnly` becomes the default path.
   - Benefit: less code, fewer edge cases, easier maintenance.

7) **Add server-side metadata controls**
   - Optional config for allowed extensions, max files, sort order, and default title/book fallback.
   - Benefit: predictable behavior without editing multiple code paths.

8) **Expose "latest updated" or "latest uploaded" semantics explicitly**
   - Today ordering uses `getDateCreated()`.
   - If user workflow depends on re-uploads or replacements, consider whether created date vs updated date better matches expectations.
   - Benefit: more predictable "last 10" behavior.

9) **Keep all adjustable settings in one place**
   - Introduce a single config section in `Code.gs` for backend behavior (`MAX_FILES`, allowed extensions, sort mode, date format, cache TTL).
   - Keep a single config section in `Index.html` for UI behavior only, or inject a backend-generated settings object if centralization in one source of truth is preferred.
   - Benefit: easier maintenance and safer edits.

10) **Readable date format for list items**
   - Change displayed dates from `yyyy-MM-dd` to a human-friendly localized format.
   - Preferred behavior:
     - show localized `Yesterday`
     - show localized `Day before yesterday`
     - otherwise show localized compact date such as `Thu, 18 Mar 2026`
   - Use one formatter/helper so labels and dates follow the current UI language.
   - Benefit: faster scanning and less cognitive load.

11) **Drive-first "latest stories" UI**
   - Emphasize recent uploads rather than a generic file browser.
   - Chosen direction: recent-feed layout optimized for iPhone 12 width first, then larger screens.
   - Example structure: featured latest item at top, then compact recent list below.
   - Benefit: matches the real use case better than a file-manager style list.

12) **Sticky date group headers**
   - Use relative labels where they add value, but keep the chosen recent-feed layout primary.
   - Preferred relative labels: localized `Today`, `Yesterday`, and `Day before yesterday`.
   - For the current direction, lightweight date labels inside cards are preferred over heavier grouped sections.
   - Benefit: easier scanning without turning the page into a file manager.

13) **Clearer list hierarchy**
   - Make the main tap target the whole card.
   - Show title on first line, date on second line, and one obvious action on the right or bottom.
   - Benefit: simpler mobile/tablet use and fewer missed taps.

14) **Purposeful micro-feedback, not decoration**
   - Add subtle pressed states, active-card highlight, and lightweight loading feedback.
   - Avoid heavy animation; keep interaction feedback fast and quiet.
   - Benefit: modern feel without adding fragility.

15) **Accessibility-first controls**
   - Ensure large touch targets, strong contrast, and consistent button placement.
   - Favor one primary action per row and avoid small multi-link clusters.
   - Benefit: better usability on tablets/phones and for non-technical users.

16) **Refresh affordance for recent content**
   - Add a visible refresh action and optionally pull-to-refresh semantics on mobile/tablet.
   - Benefit: aligns with recency-based content patterns and reduces confusion after new uploads.

17) **iPhone-first interaction polish**
   - Design and test for iPhone 12 width as the primary mobile target.
   - Keep the main action thumb-friendly, avoid tiny inline links, and reduce horizontal clutter in each row.
   - Benefit: better one-handed mobile use.

18) **Efficient backend listing strategy**
   - Current `DriveApp.getFiles()` iteration may still require walking a large folder even if only 10 items are eventually returned.
   - Investigate switching to the Advanced Drive service / Drive API query path that can request files ordered by created time with a small page size.
   - Only adopt that change if the implementation is clearly justified and materially improves the result; otherwise keep `DriveApp`.
   - Goal: avoid unnecessary backend work when the folder contains 100+ files.
   - Benefit: better server-side efficiency and faster first paint for mobile users.

### UI direction ideas worth considering
- **Chosen direction: recent-feed layout**
  - newest item featured at top
  - remaining items as simple cards sorted newest-first
  - compact readable dates localized to the UI language
- **Minimal mobile-first layout**
  - one primary action
  - large touch areas
  - quiet metadata
  - no file-manager clutter
- **Drive-native trust cues**
  - show clearly that playback opens in Google Drive, so the UI matches the actual supported behavior
- **Recent-first hierarchy**
  - visually separate "latest" from "older recent" items without adding complex controls

### Decisions needed from product owner
Resolved:
1) App should be Drive-first by default.
2) Experimental embedded `<audio>` path should remain hidden behind a config flag.
3) Backend should show only the newest 10 items.
4) Sorting should use created date.
5) UI should use a recent-feed layout.
6) Dates should be localized to the active UI language and prefer `Today` / `Yesterday` / `Day before yesterday`, otherwise `Thu, 18 Mar 2026` style output.
7) On iPhone, the primary open action should use a new tab/window.
8) Backend listing should remain on `DriveApp` unless a stronger case for Advanced Drive service is found during implementation.

Open implementation questions:
1) Whether `DriveApp` proves fast enough in practice for the newest-10 goal, or whether implementation evidence shows a clear need to switch.

### Suggested next implementation order
1) Add centralized settings for backend and UI, including `MAX_FILES`, playback mode flag, and date display behavior.
2) Remove misleading browser-play UI path from the default UX while keeping the embedded `<audio>` path behind config.
3) Move technical errors to console/debug only; simplify user-facing messages.
4) Implement efficient backend limiting to the newest 10 items.
5) Switch date display to localized relative labels and localized compact dates.
6) Apply the recent-feed mobile-first layout for iPhone 12.
7) Simplify copy around Drive-first playback.
8) Remove obsolete experimental playback code only if it is no longer useful even behind config.
