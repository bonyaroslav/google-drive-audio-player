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
  - grouping by `book`, showing metadata, debug toggles
  - pagination (`itemsPerPage`, default `10`) with top + bottom pager controls
  - autoplay-on-select (best-effort), auto-next on ended
  - seek step buttons (e.g., -10s/+30s)
  - UI language options (`ru`/`en`) with RU default; selected language persisted in `localStorage`
  - optional resume position via `localStorage`
  - numbering mode: `episodeNumberMode` (`backendGlobal` by default; also `perBook`/`none`)
  - download links in UI are disabled by default (`showDownloadLinkInList: false`; top-level Download button removed)
  - list actions: primary button opens Google Drive; browser-play button is shown only when `audio.canPlayType` indicates likely support for file format.
- Defensive rendering:
  - avoid `innerHTML` for user-controlled strings; use DOM + `textContent`.
- Reliability UX:
  - on playback error, auto-try alternate Drive stream URLs (`uc?export=download` / `uc?export=open`), then show message and provide “Open in Drive” fallback.
  - if autoplay/play tap produces no progress shortly after source switch, frontend also tries next candidate URL.
- Diagnostics:
  - `?debug=1` in URL enables in-page debug panel and console logs at runtime.
  - Early bootstrap logger (`window.__bootLog`) is initialized before main app script and captures `window.error` / `unhandledrejection`.
  - UI shows `build` timestamp to verify the active Web App deployment version.

---

## 4) Backend behavior (Code.gs)
- Reads files from Drive folder; filters `.mp3/.ogg/.m4a`.
- Folder source: Script Property `FOLDER_ID` (required). `Code.gs` throws a clear error if missing.
- Parses book/title from filename pattern:
  - strict split only by `Book. Title.ext` (dot + space). If pattern is absent, item falls back to default book and full base filename as title.
- Injects JSON into template using `safeJson_()` (escape for `<script>` context, including `<`, `>`, `&`, `U+2028`, `U+2029`).
- Frontend data path: parse `<script type="application/json" id="itemsData">`.
- Optional caching:
  - `CacheService` with small TTL (e.g., 120s) to reduce Drive calls.

---

## 5) Operational notes / known trade-offs
- **Autoplay restrictions:** mobile browsers may block autoplay until a user presses Play once.
- **Playback/seek reliability:** depends on how Drive serves media + browser behavior; MP3 is typically most compatible.
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
**Decision:** Move user-facing strings into one localization dictionary and add a top-right language selector (`RU`/`EN`) in `Index.html`. RU remains default.  
**Why:** Easier maintenance and safer text updates; no behavior change in backend contract.  
**Trade-off:** Slightly more frontend state handling (language persistence/re-rendering).

### 2026-02-19 — Playlist pagination (10 items/page)
**Decision:** Paginate rendered playlist to 10 items per page by default (`CONFIG.itemsPerPage`) and render pager controls above and below the list.  
**Why:** Better usability for long playlists, especially on tablets/phones.  
**Trade-off:** Adds page state and list re-rendering when moving between pages.
