/**
 * Apps Script Web App backend for "Stories" page
 * - Reads ALL audio files from a Drive folder (newest-first)
 * - Builds an array of items:
 *   { id, name, createdMs, book, title, number, url, viewUrl }
 * - Assigns global episode numbers (newest = total count, oldest = 1)
 * - Injects itemsJson into Index.html template; the frontend paginates client-side
 */

var BACKEND_CONFIG = {
  timezone: 'Europe/Madrid',
  cacheSeconds: 120,
  driveListBatchSize: 100,
  maxItems: 2000,
  allowedExtensions: ['.mp3', '.ogg', '.m4a'],
  defaultBook: 'Казки',
  pageTitle: 'Казки - аудіо з Google Drive',
  pageDescription: 'Мобільна сторінка для прослуховування свіжих аудіофайлів із папки Google Drive.',
  themeColor: '#07111f',
  faviconUrl: ''
};

function doGet(e) {
  var items = getAllAudioItemsCached_();
  var tpl = HtmlService.createTemplateFromFile('Index');
  tpl.itemsJson = safeJson_(items);
  tpl.totalCount = items.length;
  tpl.buildId = Utilities.formatDate(new Date(), BACKEND_CONFIG.timezone, "yyyy-MM-dd HH:mm:ss");
  tpl.pageMetaJson = safeJson_(getPageMeta_());

  var output = tpl.evaluate()
    .setTitle(BACKEND_CONFIG.pageTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  if (BACKEND_CONFIG.faviconUrl) {
    output = output.setFaviconUrl(BACKEND_CONFIG.faviconUrl);
  }

  return output;
}

function getAllAudioItemsCached_() {
  if (!BACKEND_CONFIG.cacheSeconds || BACKEND_CONFIG.cacheSeconds <= 0) return getAllAudioItems_();

  var cache = CacheService.getScriptCache();
  var cached = cache.get('itemsAll_v1');
  if (cached) {
    try { return JSON.parse(cached); } catch (err) { /* fallthrough */ }
  }

  var items = getAllAudioItems_();
  // Cache values are capped at ~100KB; if the payload is larger put() is a no-op
  // and we simply recompute on the next load. That keeps the app working either way.
  try {
    cache.put('itemsAll_v1', JSON.stringify(items), BACKEND_CONFIG.cacheSeconds);
  } catch (err) { /* payload too large to cache; ignore */ }
  return items;
}

function getPageMeta_() {
  return {
    pageTitle: BACKEND_CONFIG.pageTitle,
    pageDescription: BACKEND_CONFIG.pageDescription,
    themeColor: BACKEND_CONFIG.themeColor,
    faviconUrl: BACKEND_CONFIG.faviconUrl
  };
}

// Scans the whole folder (newest-first) and returns every audio item.
// Each item gets a global episode number: newest = total count, oldest = 1.
function getAllAudioItems_() {
  var folderId = getFolderId_();
  var out = [];
  var nextToken = '';
  var maxItems = getConfiguredMaxItems_();
  var batchSize = getConfiguredDriveListBatchSize_();

  while (out.length < maxItems) {
    var response = listDriveFilesPage_(folderId, nextToken, Math.min(batchSize, maxItems - out.length));
    var files = response.files || [];

    for (var i = 0; i < files.length && out.length < maxItems; i += 1) {
      var f = files[i];
      var name = f.name || '';
      var lower = name.toLowerCase();

      if (!isAllowedAudioFile_(lower)) continue;

      out.push(buildItemFromDriveFile_(f));
    }

    nextToken = response.nextPageToken || '';
    if (!nextToken) break;
  }

  var total = out.length;
  for (var j = 0; j < total; j += 1) {
    out[j].number = total - j;
  }

  return out;
}

function listDriveFilesPage_(folderId, pageToken, pageSize) {
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.list) {
    throw new Error('Advanced Drive service is required. In Apps Script, add the Drive API service (Drive, v3).');
  }

  var params = {
    q: "'" + escapeDriveQueryLiteral_(folderId) + "' in parents and trashed = false",
    orderBy: 'createdTime desc',
    pageSize: pageSize,
    fields: 'nextPageToken,files(id,name,createdTime)'
  };

  if (pageToken) params.pageToken = pageToken;

  return Drive.Files.list(params);
}

function buildItemFromDriveFile_(f) {
  var created = f.createdTime ? new Date(f.createdTime) : new Date();
  var id = f.id || '';
  var name = f.name || '';

  return {
    id: id,
    name: name,
    createdMs: created.getTime(),
    book: parseBook_(name),
    title: parseTitle_(name),
    number: null,
    // Kept for optional experimental HTML audio mode.
    // Default UX opens Google Drive's viewer for better mobile reliability.
    url: 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id),
    viewUrl: 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'
  };
}

// Naming convention support: "Book Title.Chapter 1-3.mp3" or "Book Title. Chapter 1-3.mp3"
function parseBook_(filename) {
  var base = filename.replace(/\.[^.]+$/, '');
  var dotIndex = base.indexOf('.');
  if (dotIndex > 0) return base.slice(0, dotIndex).trim();
  return BACKEND_CONFIG.defaultBook;
}

function getFolderId_() {
  var folderId = (PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  if (!folderId) {
    throw new Error('Missing required Script Property: FOLDER_ID');
  }
  return folderId;
}

function parseTitle_(filename) {
  var base = filename.replace(/\.[^.]+$/, '');
  var dotIndex = base.indexOf('.');
  if (dotIndex > 0) {
    var title = base.slice(dotIndex + 1).trim();
    return title || base;
  }
  return base;
}

function isAllowedAudioFile_(lowerName) {
  var extensions = BACKEND_CONFIG.allowedExtensions || [];
  for (var i = 0; i < extensions.length; i += 1) {
    var ext = String(extensions[i]).toLowerCase();
    if (lowerName.slice(-ext.length) === ext) return true;
  }
  return false;
}

function getConfiguredMaxItems_() {
  var n = Number(BACKEND_CONFIG.maxItems);
  if (!isFinite(n) || n < 1) return 2000;
  return Math.floor(n);
}

function getConfiguredDriveListBatchSize_() {
  var n = Number(BACKEND_CONFIG.driveListBatchSize);
  if (!isFinite(n) || n < 1) return 100;
  return Math.floor(n);
}

function escapeDriveQueryLiteral_(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// IMPORTANT: protect the template injection from breaking script tag content.
function safeJson_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
