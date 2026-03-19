/**
 * Apps Script Web App backend for "Stories" page
 * - Reads audio files from a Drive folder
 * - Builds an array of items:
 *   { id, name, createdMs, createdStr, book, title, number, url, viewUrl }
 * - Injects itemsJson into Index.html template
 */

const BACKEND_CONFIG = {
  timezone: 'Europe/Madrid',
  cacheSeconds: 120,
  maxFiles: 100,
  allowedExtensions: ['.mp3', '.ogg', '.m4a'],
  defaultBook: 'Казки',
  pageTitle: 'Казки - аудіо з Google Drive',
  pageDescription: 'Мобільна сторінка для прослуховування свіжих аудіофайлів із папки Google Drive.',
  themeColor: '#1f6b5f',
  faviconUrl: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/1f409.svg'
};

function doGet(e) {
  const items = getItemsCached_(shouldForceRefresh_(e));
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.itemsJson = safeJson_(items);
  tpl.buildId = Utilities.formatDate(new Date(), BACKEND_CONFIG.timezone, "yyyy-MM-dd HH:mm:ss");
  tpl.pageMetaJson = safeJson_(getPageMeta_());

  let output = tpl.evaluate()
    .setTitle(BACKEND_CONFIG.pageTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  if (BACKEND_CONFIG.faviconUrl) {
    output = output.setFaviconUrl(BACKEND_CONFIG.faviconUrl);
  }

  return output;
}

function getItemsCached_(forceRefresh) {
  if (forceRefresh) return getItems_();
  if (!BACKEND_CONFIG.cacheSeconds || BACKEND_CONFIG.cacheSeconds <= 0) return getItems_();

  const cache = CacheService.getScriptCache();
  const cached = cache.get('itemsJson_v1');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fallthrough */ }
  }

  const items = getItems_();
  cache.put('itemsJson_v1', JSON.stringify(items), BACKEND_CONFIG.cacheSeconds);
  return items;
}

function shouldForceRefresh_(e) {
  return !!(e && e.parameter && e.parameter.refresh);
}

function getPageMeta_() {
  return {
    pageTitle: BACKEND_CONFIG.pageTitle,
    pageDescription: BACKEND_CONFIG.pageDescription,
    themeColor: BACKEND_CONFIG.themeColor,
    faviconUrl: BACKEND_CONFIG.faviconUrl
  };
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
    if (!isAllowedAudioFile_(lower)) continue;

    const created = f.getDateCreated();         // stable for "when it first appeared"
    const id = f.getId();

    out.push({
      id,
      name,
      createdMs: created.getTime(),
      createdStr: Utilities.formatDate(created, BACKEND_CONFIG.timezone, 'yyyy-MM-dd'),
      book: parseBook_(name),
      title: parseTitle_(name),
      // Kept for optional experimental HTML audio mode.
      // Default UX opens Google Drive's viewer for better mobile reliability.
      url: `https://drive.google.com/uc?export=download&id=${id}`,
      viewUrl: `https://drive.google.com/file/d/${id}/view`
    });
  }

  // Numbering: 1 = oldest, N = newest
  out.sort((a, b) => a.createdMs - b.createdMs);
  out.forEach((x, idx) => x.number = idx + 1);

  // Display: newest first
  out.sort((a, b) => b.createdMs - a.createdMs);

  const maxFiles = Number(BACKEND_CONFIG.maxFiles);
  if (isFinite(maxFiles) && maxFiles > 0 && out.length > maxFiles) {
    return out.slice(0, Math.floor(maxFiles));
  }

  return out;
}

// Naming convention support: "Book Title.Chapter 1-3.mp3" or "Book Title. Chapter 1-3.mp3"
function parseBook_(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const dotIndex = base.indexOf('.');
  if (dotIndex > 0) return base.slice(0, dotIndex).trim();
  return BACKEND_CONFIG.defaultBook;
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
  const dotIndex = base.indexOf('.');
  if (dotIndex > 0) {
    const title = base.slice(dotIndex + 1).trim();
    return title || base;
  }
  return base;
}

function isAllowedAudioFile_(lowerName) {
  const extensions = BACKEND_CONFIG.allowedExtensions || [];
  for (let i = 0; i < extensions.length; i += 1) {
    if (lowerName.endsWith(String(extensions[i]).toLowerCase())) return true;
  }
  return false;
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
