Technical notes + decisions log (single file by design). Keep it concise.

---

## 1) Architecture (high level)
- **Storage:** Google Drive folder (`FOLDER_ID` Script Property) contains audio files.
- **Backend:** Google Apps Script Web App (`doGet`) lists Drive files and injects `itemsJson` into `Index.html` via HtmlService templates.
- **Frontend:** `Index.html` renders playlist UI and controls playback via HTML5 `<audio>`.

Official docs:
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- HtmlService templates: https://developers.google.com/apps-script/guides/html/templates
- Advanced Drive service: https://developers.google.com/apps-script/advanced/drive
- Drive API files list: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- HTML `<audio>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio

---

## 2) Data Contract (itemsJson)
`itemsJson` is the **full** list of audio items (newest-first), injected at page load. UI expects an array of items with at least:
- `id` (Drive file id)
- `name` (filename)
- `createdMs` (number)
- `book` (string)
- `title` (string)
- `number` (int; global episode number — newest = total count, oldest = `1`)
- `url` (direct play/download URL, usually `uc?export=download&id=...`)
- `viewUrl` (Drive file view URL fallback)

Notes:
- Newest-first display is by `createdMs` desc (Drive `orderBy: createdTime desc`).
- `number` is computed backend-side as `total - index` across the whole folder.
- The frontend paginates this array client-side (`CONFIG.pageSize`, default `6`).
- Display date is derived client-side from `createdMs` (no `createdStr` is injected).

---

## 3) Frontend behavior (Index.html)
- Central `CONFIG` controls:
  - playback mode toggle: `driveOnly` by default, `experimentalHtmlAudio` optional
  - page size is a frontend setting `CONFIG.pageSize` (`6` by default)
  - client-side pagination over the full injected list, with a single compact bottom pager: first (`«`), jump back N pages (`‹‹`, `CONFIG.pagerJumpStep`, default `5`), prev (`‹`), `Page X / Y` indicator, next (`›`), jump forward N pages (`››`), last (`»`)
  - the feed heading also shows the total recording count
  - hard-coded low-light dark theme; no user-facing theme switcher
  - autoplay-on-select (best-effort), auto-next on ended when experimental audio is enabled
  - seek step buttons (e.g., -10s/+30s) in experimental audio mode
  - UI language options (`uk`/`ru`/`en`) with Ukrainian default on fresh clients; selected language persisted in versioned cookies and `localStorage`
  - optional resume position via `localStorage`
  - numbering mode: `episodeNumberMode` (`backendGlobal` by default; also `perBook`/`none`); shown as `N. Title` (newest = total count)
  - newest-first flat list layout with book separators, per-card book labels, highlighted date chips, large card actions, and iPhone-first sizing
  - list actions: primary button opens Google Drive in a new tab/window; explicit "Select record" buttons are removed
  - parsed `book` name (filename prefix before the first `.`) is shown as a large separator before a changed-prefix item and as a small label at the start of each card; it does not reorder the newest-first list
  - readable local font stack prefers Atkinson Hyperlegible when installed, then Segoe UI / Verdana / system sans-serif; no external font files are loaded
- Defensive rendering:
  - avoid `innerHTML` for user-controlled strings; use DOM + `textContent`.
- Reliability UX:
  - default UX avoids custom Drive streaming and instead directs users to Drive's own viewer for playback
  - user-facing errors should be plain guidance; technical details stay in debug logging / console
- Diagnostics:
  - `?debug=1` in URL enables in-page debug panel and console logs at runtime.
  - Refresh is browser-native only; the frontend does not add cache-busting query parameters.
  - Page title is set server-side via `HtmlOutput.setTitle()`. Description/theme-color/icon hints are applied client-side because `HtmlService` does not support arbitrary head tags directly.
  - Early bootstrap logger (`window.__bootLog`) is initialized before main app script and captures `window.error` / `unhandledrejection`.
  - UI shows `build` timestamp to verify the active Web App deployment version.

---

## 4) Backend behavior (Code.gs)
- Reads files from Drive folder; filters `.mp3/.ogg/.m4a`.
- Backend configuration is centralized in `BACKEND_CONFIG` (`driveListBatchSize`, `maxItems`, `allowedExtensions`, `cacheSeconds`, timezone, defaults).
- Folder source: Script Property `FOLDER_ID` (required). `Code.gs` throws a clear error if missing.
- Uses Advanced Drive service (`Drive`, API v3) for ordered Drive listing.
- `getAllAudioItems_()` scans the whole folder newest-first (looping `nextPageToken` until exhausted or `maxItems`), then assigns `number = total - index` so the newest item carries the total count and the oldest is `1`.
- Parses book/title from filename pattern:
  - split by the first `.` in the base filename. Text before the first dot is `book`; text after it is `title`. If the dot is absent, item falls back to default book and full base filename as title.
- Injects JSON into template using `safeJson_()` (escape for `<script>` context, including `<`, `>`, `&`, `U+2028`, `U+2029`).
- Frontend data path: parse `<script type="application/json" id="itemsData">` (full list; no lazy older/newer fetch).
- Optional caching:
  - `CacheService` with small TTL (e.g., 120s) to reduce Drive calls. Cache values are capped at ~100KB; if the full list exceeds that, `put()` is skipped and the list is recomputed each load (still functional). `createdStr` is intentionally not injected to keep the payload small.

---

## 5) Operational notes / known trade-offs
- **Autoplay restrictions:** mobile browsers may block autoplay until a user presses Play once.
- **Playback/seek reliability:** custom HTML5 `<audio>` playback from Drive download-style URLs is not a documented/supported streaming contract; reliability depends on how Drive serves media + browser behavior. Drive's own viewer is the safer browser playback path. MP3 is typically most compatible.
- **Privacy model:** relies on Drive sharing + Web App access. “Anyone with link” is unlisted public.
- **Scale:** the backend loads the whole folder on each cold cache and injects it inline. This is fine at the intended scale (last ~100–300 files); keep the “active” folder limited and archive elsewhere. `BACKEND_CONFIG.maxItems` caps the scan as a safety valve.
- **Paging trade-off:** client-side pagination gives exact global numbers and instant `Page X / Y` navigation (first/last/±5/±1), at the cost of a full-folder scan + larger initial payload. The compact pager has no direct numbered-page buttons; reaching a distant page uses ±5/±1 steps (acceptable since paging is rare).

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
**Decision:** Paginate rendered playlist to 10 items per page and render a single pager below the list.  
**Why:** Better usability for long playlists without duplicating controls at the bottom of the page.  
**Trade-off:** Returning to page navigation requires scrolling to the list footer.

### 2026-03-19 — Forced refresh bypasses browser and Apps Script cache
**Decision:** Removed the visible forced-refresh path from the current frontend. Refresh is now browser-native only, and backend cache expires by TTL.
**Why:** The custom refresh path could leave the deployed page in a broken state for the user.
**Trade-off:** New uploads may remain hidden until the short cache TTL expires or the user reopens the Web App after deployment cache clears.

### 2026-03-19 — Centralized page metadata config
**Decision:** Keep page title, description, theme color, and optional favicon URL in `BACKEND_CONFIG`. Set the title server-side and apply the remaining head metadata client-side.  
**Why:** Apps Script officially supports server-side title and favicon APIs, but arbitrary `<meta>` / `<link>` tags are not reliably preserved in `HtmlService` output.  
**Trade-off:** Description/icon hints added client-side are best-effort and may not be used by every crawler or bookmark surface.

### 2026-03-19 — Avoid SVG in `setFaviconUrl()`
**Decision:** Keep `BACKEND_CONFIG.faviconUrl` empty until a supported PNG/ICO favicon asset is available.  
**Why:** An SVG favicon URL caused runtime failure: `Exception: The favicon icon image type is not supported.`  
**Trade-off:** Server-side favicon remains unset for now; client-side fallback icon hints may still help some bookmark/tab surfaces but are not equivalent to `setFaviconUrl()`.

### 2026-03-18 — Drive-first mobile playback + recent list layout
**Decision:** Default the UI to `playbackMode: 'driveOnly'`, show a recent list layout, and keep embedded HTML audio behind an experimental config flag.

**Why:** Google Drive viewer is the more reliable playback path on iPhone 12 Safari/Chrome and on Android browsers.

**Trade-off:** Default UI no longer exposes in-page seek/player controls unless experimental mode is enabled.

### 2026-05-08 — Remove featured latest section
**Decision:** Remove the separate featured latest card and render all records in one newest-first list. Show the book name as a large centered separator before an item when the prefix changes from the previous item, repeat it as a small label at the start of each card, and make the date more visible with a small highlighted chip.

**Why:** A standalone latest section can make a second fresh recording easier to miss, especially when recordings are added for different books close together.

**Trade-off:** The newest item no longer gets a larger visual treatment, but every item now follows the same scanning pattern.

### 2026-05-08 — Remove refresh button
**Decision:** Remove the visible refresh button from the frontend.

**Why:** It could leave the deployed page blank for the user; the list is simpler and safer without it.

**Trade-off:** Users refresh through the browser or reopen the Web App URL; the backend relies on the configured cache TTL.

### 2026-06-14 — Hard-coded low-light dark UI
**Decision:** Use one hard-coded dark theme; no theme switcher.
**Why:** Target use is nighttime playback on iPhone-sized Safari/Chrome screens.
**Constraints:** Keep controls simple, high contrast, large touch targets, and no extra UI settings.
**Trade-off:** Daytime/light theme requires a code change or future explicit theme feature.

### 2026-06-14 — Server-backed older/newer paging
**Decision:** Use Drive `nextPageToken` pagination and compact `Newer` / `Older` controls.
**Problem fixed:** Previous frontend paging was capped by the injected backend window (`100` files = `10` pages at 10/page).
**Constraints:** Total page count is unknown; do not build UI that depends on "page X of Y".
**Trade-off:** Older pages load on demand through `google.script.run`, so paging failures must be handled in the pager UI.

### 2026-06-14 — Advanced Drive service for ordered listing
**Decision:** Use Advanced Drive service (`Drive`, API v3) instead of `DriveApp` for playlist listing.
**Why:** Need ordered file listing and page tokens without scanning the full folder.
**Constraints:** Apps Script deployment must enable the `Drive` advanced service with API version `v3`.
**Trade-off:** Setup is slightly less simple, but runtime paging is more scalable and removes the 10-page ceiling.

### 2026-06-14 — No exact global numbering in lazy paging
**Decision:** Return `number: null` in server-paged mode.
**Why:** Exact "oldest = #1" numbering requires scanning the full folder, which conflicts with lazy paging.
**Constraints:** Do not reintroduce full-folder scans just to show episode numbers.
**Trade-off:** The list relies on title, book, and date for orientation.
**Superseded by:** "Client-side full pagination" and "Global episode numbering" (2026-06-14, below).

### 2026-06-14 — Client-side full pagination (supersedes server-backed older/newer paging)
**Decision:** Load the entire folder once in `doGet`, inject the full `itemsJson`, and paginate client-side at `CONFIG.pageSize` (6/page) with a compact pager: first / jump −N / prev / `Page X / Y` / next / jump +N / last.
**Why:** The user needs exact `Page X / Y`, jumps of several pages, and direct first/last navigation. At the intended scale (~100–300 files) a full load is cheap and makes rare paging instant.
**Constraints:** Cap the scan with `BACKEND_CONFIG.maxItems`; keep the cached payload under ~100KB (drop `createdStr`).
**Trade-off:** Larger initial payload and a full-folder scan on cold cache; the pager has no direct numbered-page buttons (distant pages reached via ±N/±1).

### 2026-06-14 — Global episode numbering (supersedes "no exact global numbering")
**Decision:** Compute `number = total - index` over the whole newest-first list so the newest item shows the total count and the oldest shows `1`; render as `N. Title`. The feed heading also shows the total count.
**Why:** The user wants a running number per recording to see how many exist and to locate one by number.
**Trade-off:** Requires the full-folder scan adopted above; numbers shift by one whenever a new file is added (expected behavior).

---

## 8) Remaining safe improvements

1) **Simplify experimental browser playback**
   - Keep `playbackMode: 'driveOnly'` as the default.
   - If embedded `<audio>` is no longer useful for testing, remove the hidden experimental player in a separate small change.

2) **Improve paging diagnostics**
   - Keep user-facing errors plain.
   - Add debug-only logging for Drive page tokens, page sizes, and load failures when `?debug=1` is enabled.

3) **Watch payload/scan size as the folder grows**
   - Global numbering + client-side paging rely on loading the whole folder. Around the ~100KB cache limit the list stops being cached (recomputed each load).
   - If the folder grows large, revisit: archive old files, raise the cache strategy, or move to a hybrid (inject count + lazy-load remainder).

4) **Validate target devices**
   - Test the dark theme and the compact pager (first/last/±5/±1) on the actual iPhone/Safari and Chrome targets before changing spacing or contrast further.
