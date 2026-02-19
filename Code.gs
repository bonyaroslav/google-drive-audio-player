/**
 * Apps Script Web App backend for "Stories" page
 * - Reads audio files from a Drive folder
 * - Builds an array of items:
 *   { id, name, createdMs, createdStr, book, title, number, url, viewUrl }
 * - Injects itemsJson into Index.html template
 */

const TZ = 'Europe/Madrid';

// Optional: cache listing to reduce Drive calls.
// Set to 0 to disable caching.
const CACHE_SECONDS = 120;

function doGet() {
  const items = getItemsCached_();
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.itemsJson = safeJson_(items);
  tpl.buildId = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss");

  return tpl.evaluate()
    .setTitle('Сказки')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getItemsCached_() {
  if (!CACHE_SECONDS || CACHE_SECONDS <= 0) return getItems_();

  const cache = CacheService.getScriptCache();
  const cached = cache.get('itemsJson_v1');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fallthrough */ }
  }

  const items = getItems_();
  cache.put('itemsJson_v1', JSON.stringify(items), CACHE_SECONDS);
  return items;
}

function getItems_() {
  const folderId = getFolderId_();
  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();

  const out = [];
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName();
    const lower = name.toLowerCase();

    // Only audio formats you care about
    if (!(lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.m4a'))) continue;

    const created = f.getDateCreated();         // stable for "when it first appeared"
    const id = f.getId();

    out.push({
      id,
      name,
      createdMs: created.getTime(),
      createdStr: Utilities.formatDate(created, TZ, 'yyyy-MM-dd'),
      book: parseBook_(name),
      title: parseTitle_(name),
      // Often works for in-browser playback + download. If it doesn't on a device,
      // the Drive fallback link still works.
      url: `https://drive.google.com/uc?export=download&id=${id}`,
      viewUrl: `https://drive.google.com/file/d/${id}/view`
    });
  }

  // Numbering: 1 = oldest, N = newest
  out.sort((a, b) => a.createdMs - b.createdMs);
  out.forEach((x, idx) => x.number = idx + 1);

  // Display: newest first
  out.sort((a, b) => b.createdMs - a.createdMs);

  return out;
}

// Naming convention support: "Book Title. Chapter 1-3.mp3"
function parseBook_(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const m = base.match(/^(.+?)\.\s+(.+)$/);
  if (m) return m[1].trim();
  return 'Сказки';
}

function getFolderId_() {
  const folderId = (PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  if (!folderId) {
    throw new Error('Missing required Script Property: FOLDER_ID');
  }
  return folderId;
}

function parseTitle_(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const m = base.match(/^(.+?)\.\s+(.+)$/);
  if (m) return m[2].trim() || base;
  return base;
}

// IMPORTANT: protect the template injection from breaking <script> content
function safeJson_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
