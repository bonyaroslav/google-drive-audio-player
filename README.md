# Drive Stories Player

<p align="center">
  <strong>Mobile-first Google Drive audio player built with Apps Script</strong><br/>
  Drive-first playback, newest-first list navigation, book separators and labels, localized UI, and a zero-extra-infrastructure deployment model.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Google%20Apps%20Script-Web%20App-4285F4?logo=googleappsscript&logoColor=white" alt="Google Apps Script Web App" />
  <img src="https://img.shields.io/badge/Google%20Drive-Audio%20Source-0F9D58?logo=googledrive&logoColor=white" alt="Google Drive audio source" />
  <img src="https://img.shields.io/badge/Playback-Drive--First-1F6FEB" alt="Drive-first playback" />
  <img src="https://img.shields.io/badge/UI-UA%20Default-6F42C1" alt="Ukrainian default UI" />
  <img src="https://img.shields.io/badge/Localization-UA%20%2F%20RU%20%2F%20EN-7A3EFF" alt="Ukrainian Russian English localization" />
  <img src="https://img.shields.io/badge/Book%20Markers-From%20Filename%20Prefix-CB6D51" alt="Book markers from filename prefix" />
  <img src="https://img.shields.io/badge/Frontend-Plain%20HTML%20%2B%20JS-F59E0B" alt="Plain HTML and JavaScript frontend" />
  <img src="https://img.shields.io/badge/Infra-Zero%20Extra-2DA44E" alt="Zero extra infrastructure" />
</p>

A small **Google-only** web app that turns a Drive folder into a focused audio page optimized for phone use. The default playback path opens files in **Google Drive** for better reliability on iPhone and Android, while an experimental in-page player remains available behind config.

## What it does
- Reads audio files from a single Google Drive folder (`.mp3`, `.ogg`, `.m4a`)
- Renders a web page (Apps Script Web App) with:
  - Drive-first newest-first list layout optimized for phones
  - Primary “Open in Google Drive” action for each item
  - UA/RU/EN UI switcher (Ukrainian default)
  - Language preference persisted in cookies and `localStorage` with Ukrainian as the default on fresh clients
  - Distinct book separators and per-card book labels parsed from the filename prefix before the first `.`
  - Highlighted relative localized dates (`Today` / `Yesterday` / compact date)
  - Server-backed older/newer pagination with 10 items per page
  - Single compact bottom pager that can continue to the end of the Drive folder
  - Hard-coded low-light dark UI for nighttime phone use
  - Optional experimental HTML5 `<audio>` mode kept behind frontend config
  - Configurable page title/description metadata and optional favicon support

## Icon note
- Apps Script `HtmlOutput.setFaviconUrl()` should use a browser-supported favicon image type such as PNG or ICO.
- SVG URLs should not be used here; keep `BACKEND_CONFIG.faviconUrl` empty until you have a supported public HTTPS PNG/ICO asset.
- Shows newest files first; exact global episode numbering is skipped in server-paged mode
- Loads the newest 10 files first and fetches older pages on demand

## Architecture (high level)
- **Storage:** Google Drive folder contains audio files
- **Backend:** Google Apps Script Web App (`doGet()`) reads Drive folder metadata and injects `itemsJson` into the HTML template
- **Frontend:** Static HTML + JS builds a newest-first list UI and defaults to Drive viewer playback for better mobile reliability

Official references:
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Advanced Drive service in Apps Script: https://developers.google.com/apps-script/advanced/drive
- Drive API files list: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- HtmlService templates: https://developers.google.com/apps-script/guides/html/templates
- HTML `<audio>` element: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio

## Repository layout
- `Code.gs`  
  Apps Script backend: lists Drive files, builds metadata, injects `itemsJson`.
- `Index.html`  
  Frontend page: renders the list, drives the audio player, and provides controls.

## Data model (`itemsJson`)
Each audio item looks like:
```json
{
  "id": "DriveFileId",
  "name": "Book. Chapter 1-3.mp3",
  "createdMs": 1700000000000,
  "createdStr": "2026-02-18 21:30",
  "book": "Book",
  "title": "Chapter 1-3",
  "number": null,
  "url": "https://drive.google.com/uc?export=download&id=DriveFileId",
  "viewUrl": "https://drive.google.com/file/d/DriveFileId/view"
}
```

## Setup (Apps Script)
1. Create an Apps Script project at https://script.google.com.
2. Add files in project root:
   - `Code.gs`
   - `Index.html`
3. Open `Project Settings` -> `Script properties`.
4. Add the Advanced Drive service:
   - In the Apps Script editor, next to `Services`, click `+`.
   - Select `Drive API`.
   - Keep the identifier as `Drive`.
   - Add it with API version `v3`.
   - If your Apps Script project uses a standard Google Cloud project, also enable the Drive API in that Cloud project.
5. Add property:
   - Key: `FOLDER_ID`
   - Value: your Google Drive folder ID (the folder that contains audio files).
6. Ensure Apps Script has permission to read that folder.

## Deploy
1. In Apps Script, click `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: choose per your privacy model (for family use, usually restricted is better than public).
5. Deploy and open the Web App URL.

## Important security note
- Do not hardcode `FOLDER_ID` in `Code.gs`.
- Keep `FOLDER_ID` only in Script Properties so it is outside Git history/repository.
