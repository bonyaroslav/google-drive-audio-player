/**
 * Apps Script Web App backend for "Stories" page
 * - Reads audio files from a Drive folder
 * - Builds an array of items:
 *   { id, name, createdMs, createdStr, book, title, number, url, viewUrl }
 * - Injects itemsJson into Index.html template
 */

var BACKEND_CONFIG = {
  timezone: 'Europe/Madrid',
  cacheSeconds: 120,
  pageSize: 10,
  driveListBatchSize: 50,
  allowedExtensions: ['.mp3', '.ogg', '.m4a'],
  defaultBook: 'Казки',
  pageTitle: 'Казки - аудіо з Google Drive',
  pageDescription: 'Мобільна сторінка для прослуховування свіжих аудіофайлів із папки Google Drive.',
  themeColor: '#07111f',
  faviconUrl: ''
};

function doGet(e) {
  var page = getInitialItemsPageCached_();
  var tpl = HtmlService.createTemplateFromFile('Index');
  tpl.itemsJson = safeJson_(page.items);
  tpl.pageStateJson = safeJson_(getInitialPageState_(page));
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

function getInitialItemsPageCached_() {
  if (!BACKEND_CONFIG.cacheSeconds || BACKEND_CONFIG.cacheSeconds <= 0) return getItemsPage_('');

  var cache = CacheService.getScriptCache();
  var cached = cache.get('itemsPage_v3');
  if (cached) {
    try { return JSON.parse(cached); } catch (err) { /* fallthrough */ }
  }

  var page = getItemsPage_('');
  cache.put('itemsPage_v3', JSON.stringify(page), BACKEND_CONFIG.cacheSeconds);
  return page;
}

function getInitialPageState_(page) {
  return {
    nextPageToken: page.nextPageToken || '',
    hasMore: !!page.hasMore
  };
}

function getItemsPage(pageToken) {
  return getItemsPage_(pageToken || '');
}

function getPageMeta_() {
  return {
    pageTitle: BACKEND_CONFIG.pageTitle,
    pageDescription: BACKEND_CONFIG.pageDescription,
    themeColor: BACKEND_CONFIG.themeColor,
    faviconUrl: BACKEND_CONFIG.faviconUrl
  };
}

function getItemsPage_(pageToken) {
  var folderId = getFolderId_();
  var out = [];
  var nextToken = sanitizePageToken_(pageToken);
  var maxItems = getConfiguredPageSize_();
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

  return {
    items: out,
    nextPageToken: nextToken,
    hasMore: !!nextToken
  };
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
    createdStr: Utilities.formatDate(created, BACKEND_CONFIG.timezone, 'yyyy-MM-dd'),
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

function getConfiguredPageSize_() {
  var n = Number(BACKEND_CONFIG.pageSize);
  if (!isFinite(n) || n < 1) return 10;
  return Math.floor(n);
}

function getConfiguredDriveListBatchSize_() {
  var n = Number(BACKEND_CONFIG.driveListBatchSize);
  if (!isFinite(n) || n < 1) return getConfiguredPageSize_();
  return Math.floor(n);
}

function sanitizePageToken_(pageToken) {
  var token = pageToken == null ? '' : String(pageToken);
  if (token.length > 1024) throw new Error('Invalid Drive page token.');
  return token;
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
