# Drive Stories Player (Google Apps Script + Google Drive)

A tiny **Google-only** web app that lists audio files from a Google Drive folder and provides a **stable “one-link” page** to **play, seek, auto-next**, and **download** recordings (e.g., bedtime stories, voice notes, daily updates).

## What it does
- Reads audio files from a single Google Drive folder (`.mp3`, `.ogg`, `.m4a`)
- Renders a web page (Apps Script Web App) with:
  - HTML5 `<audio>` player (native controls + seek)
  - RU/EN UI switcher (RU default)
  - Pagination (10 items per page) with large controls at top and bottom
  - Previous/Next navigation
  - Seek buttons (e.g., -10s / +30s)
  - Auto-next when a track ends
  - Optional resume position (localStorage)
  - Download link + “Open in Drive” fallback
- Shows newest files first; auto-generates episode numbering (oldest = #1)

## Architecture (high level)
- **Storage:** Google Drive folder contains audio files
- **Backend:** Google Apps Script Web App (`doGet()`) reads Drive folder metadata and injects `itemsJson` into the HTML template
- **Frontend:** Static HTML + JS builds playlist UI and controls playback using the browser’s `<audio>` element

Official references:
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Drive service in Apps Script (`DriveApp`): https://developers.google.com/apps-script/reference/drive
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
  "number": 42,
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
4. Add property:
   - Key: `FOLDER_ID`
   - Value: your Google Drive folder ID (the folder that contains audio files).
5. Ensure Apps Script has permission to read that folder.

## Deploy
1. In Apps Script, click `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: choose per your privacy model (for family use, usually restricted is better than public).
5. Deploy and open the Web App URL.

## Important security note
- Do not hardcode `FOLDER_ID` in `Code.gs`.
- Keep `FOLDER_ID` only in Script Properties so it is outside Git history/repository.
