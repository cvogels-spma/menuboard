/**
 * Space Magic Menuboard - Google Sheets Data Loader
 * Liest Produkte & Preise aus dem Google Sheet und rendert die Screens dynamisch.
 * Sheet-URL: https://docs.google.com/spreadsheets/d/1c5ZNc032MQx4-iTB67g2oFCoVbhe-fIH2HgN6S7FvY4
 */

const SHEET_ID = '1c5ZNc032MQx4-iTB67g2oFCoVbhe-fIH2HgN6S7FvY4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 Minuten
const CACHE_KEY = 'menuboard_cache';

// Bild-Mapping: Produkt -> URL (leer = Emoji-Icons werden gezeigt)
// Eigene Bilder hier eintragen: 'Produktname': 'https://...'
const PRODUCT_IMAGES = {};

// Emoji-Icons pro Produkt (fuer grosse Darstellung auf Screen 1)
// Nur 1 Emoji pro Produkt - klar und eindeutig
const PRODUCT_ICONS = {
  'Hamburger':        '🍔',
  'Cheeseburger':     '🍔',
  'Chicken Burger':   '🍔',
  'Veggie Burger':    '🍔',
  'Margherita':       '🍕',
  'Salami':           '🍕',
  'Wienerwurst':      '🌭',
  'Bockwurst im Br\u00f6tchen': '🌭',
  'Pommes':           '🍟',
  'Nuggets':          '🍗',
};

// Farb-Mapping aus dem Sheet
const COLOR_MAP = {
  'teal':   { accent: '#00e5c8', bg: 'rgba(0,229,200,0.15)',   gradient: 'linear-gradient(90deg, #00e5c8, #8b5cf6)' },
  'pink':   { accent: '#ff3d8e', bg: 'rgba(255,61,142,0.15)',   gradient: 'linear-gradient(90deg, #ff3d8e, #ff7b3a)' },
  'yellow': { accent: '#ffd235', bg: 'rgba(255,210,53,0.15)',   gradient: 'linear-gradient(90deg, #ffd235, #ff7b3a)' },
  'purple': { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',   gradient: 'linear-gradient(90deg, #8b5cf6, #00e5c8)' },
  'orange': { accent: '#ff7b3a', bg: 'rgba(255,123,58,0.15)',   gradient: 'linear-gradient(90deg, #ff7b3a, #ffd235)' },
};

/**
 * CSV parsen (einfacher RFC-konformer Parser)
 */
function parseCSV(csv) {
  const rows = [];
  let current = '';
  let inQuote = false;
  const lines = csv.split('\n');

  for (const line of lines) {
    if (inQuote) {
      current += '\n' + line;
    } else {
      current = line;
    }
    const quoteCount = (current.match(/"/g) || []).length;
    inQuote = quoteCount % 2 !== 0;
    if (!inQuote) {
      rows.push(parseCSVRow(current));
      current = '';
    }
  }

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.length === headers.length).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function parseCSVRow(line) {
  const cells = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Daten vom Google Sheet laden (mit localStorage-Cache als Fallback)
 */
async function fetchMenuData() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const data = parseCSV(csv);
    const visible = data.filter(item => item['Sichtbar'] === 'ja');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(visible)); } catch(e) {}
    return visible;
  } catch (err) {
    console.warn('Google Sheet nicht erreichbar, nutze Cache:', err.message);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return null;
  }
}

/**
 * Produkte nach Seite filtern
 */
function filterByPage(data, page) {
  return data.filter(item => item['Seite'] === page);
}

/**
 * Produkte nach Kategorie gruppieren
 */
function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    const cat = item['Kategorie'];
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

/**
 * Preis formatieren: 6.00 -> 6,00 EUR
 */
function formatPrice(price) {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return num.toFixed(2).replace('.', ',') + ' \u20AC';
}

/**
 * Bild-URL fuer ein Produkt holen (mit Fallback auf Emoji)
 */
function getProductImage(productName) {
  return PRODUCT_IMAGES[productName] || null;
}

/**
 * Auto-Refresh starten (mit sanftem Uebergang)
 */
function startAutoRefresh(renderFn) {
  renderFn();
  setInterval(async () => {
    await renderFn();
  }, REFRESH_INTERVAL);
}

/**
 * Seite komplett neu laden (fuer Elementi/SpinetiX Player)
 * Laedt die Seite alle 30 Min komplett neu um sicherzustellen
 * dass der Browser-Cache aktualisiert wird.
 */
const PAGE_RELOAD_INTERVAL = 30 * 60 * 1000; // 30 Minuten
setTimeout(() => { window.location.reload(); }, PAGE_RELOAD_INTERVAL);
setInterval(() => { window.location.reload(); }, PAGE_RELOAD_INTERVAL);
