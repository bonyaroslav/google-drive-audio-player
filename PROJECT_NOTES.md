Technical notes + decisions log (single file by design). Keep it concise.

---

## 1) Architecture (high level)
- **Storage:** Google Drive folder (`FOLDER_ID`) contains audio files.
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

---

## 3) Frontend behavior (Index.html)
- Central `CONFIG` controls:
  - grouping by `book`, showing metadata, debug toggles
  - autoplay-on-select (best-effort), auto-next on ended
  - seek step buttons (e.g., -10s/+30s)
  - optional resume position via `localStorage`
- Defensive rendering:
  - avoid `innerHTML` for user-controlled strings; use DOM + `textContent`.
- Reliability UX:
  - on playback error, show message and provide “Open in Drive” fallback.

---

## 4) Backend behavior (Code.gs)
- Reads files from Drive folder; filters `.mp3/.ogg/.m4a`.
- Parses book/title from filename pattern:
  - `Book. Title.ext`
- Injects JSON into template using `safeJson_()` (escape for `<script>` context).
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

### 2026-02-18 — Optional caching of Drive listing
**Decision:** Use CacheService with short TTL (e.g., 60–300s).  
**Why:** Faster loads; fewer Drive calls; acceptable delay for new uploads.  
**Trade-off:** New files may appear after TTL.
