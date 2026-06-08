// fetch-data.mjs
// Runs in GitHub Actions — fetches latest Wayback Machine snapshots for each brand
// and writes results to ../data/live.json

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'live.json');

// ─── Brand list ───────────────────────────────────────────────────────────────
const brands = [
  { id: 'zoom',        url: 'zoom.us' },
  { id: 'nextiva',     url: 'nextiva.com' },
  { id: 'cisco',       url: 'webex.com' },
  { id: 'msteams',     url: 'microsoft.com/en-us/microsoft-teams/group-chat-software' },
  { id: 'grasshopper', url: 'grasshopper.com' },
  { id: '8x8',         url: '8x8.com' },
  { id: 'dialpad',     url: 'dialpad.com' },
  { id: 'genesys',     url: 'genesys.com' },
  { id: 'five9',       url: 'five9.com' },
  { id: 'talkdesk',    url: 'talkdesk.com' },
  { id: 'gong',        url: 'gong.io' },
  { id: 'cresta',      url: 'cresta.com' },
  { id: 'sierra',      url: 'sierra.ai' },
  { id: 'decagon',     url: 'decagon.ai' },
];

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function findLatestSnapshot(url) {
  // CDX API: find most recent successful snapshot from 2025 onward
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,statuscode,original&filter=statuscode:200&limit=1&from=20250101&fastLatest=true`;

  const res = await fetch(cdxUrl, { timeout: 15000 });
  const data = await res.json();

  if (data && data.length >= 2) {
    const [timestamp, , original] = data[1];
    return {
      timestamp,
      snapshotUrl: `https://web.archive.org/web/${timestamp}/${original}`,
    };
  }

  // Fallback: availability API
  const availRes = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    { timeout: 10000 }
  );
  const avail = await availRes.json();
  if (avail?.archived_snapshots?.closest?.available) {
    return {
      timestamp: avail.archived_snapshots.closest.timestamp,
      snapshotUrl: avail.archived_snapshots.closest.url,
    };
  }

  return null;
}

async function parseSnapshot(snapshotUrl) {
  const res = await fetch(snapshotUrl, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RCPositionTracker/1.0)' },
  });
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Title — strip Wayback toolbar artifacts
  let title = doc.querySelector('title')?.textContent?.trim() || null;
  if (title) title = title.replace(/\s*\|\s*Web Archive\s*$/i, '').trim();

  // Meta description
  const meta =
    doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
    null;

  // First meaningful H1
  let h1 = null;
  for (const el of doc.querySelectorAll('h1')) {
    const text = el.textContent?.trim();
    if (text && text.length > 3 && !text.toLowerCase().includes('wayback machine')) {
      h1 = text;
      break;
    }
  }

  return { title, meta, h1 };
}

function formatDate(timestamp) {
  if (!timestamp || timestamp.length < 8) return null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const y = timestamp.slice(0, 4);
  const m = parseInt(timestamp.slice(4, 6), 10);
  const d = parseInt(timestamp.slice(6, 8), 10);
  return `${months[m - 1]} ${d}, ${y}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Load existing data so we preserve previous results on error
  let existing = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8')); } catch (e) {}
  }

  const results = { ...existing };
  const runDate = new Date().toISOString();

  for (const brand of brands) {
    console.log(`\n→ ${brand.id} (${brand.url})`);
    try {
      const snapshot = await findLatestSnapshot(brand.url);
      if (!snapshot) {
        console.log(`  ✗ No snapshot found`);
        results[brand.id] = { ...existing[brand.id], error: 'No snapshot found', lastAttempt: runDate };
        continue;
      }

      console.log(`  Snapshot: ${snapshot.timestamp} — ${snapshot.snapshotUrl}`);
      const parsed = await parseSnapshot(snapshot.snapshotUrl);

      results[brand.id] = {
        title: parsed.title,
        meta: parsed.meta,
        h1: parsed.h1,
        fetchedAt: formatDate(snapshot.timestamp),
        snapshotTimestamp: snapshot.timestamp,
        snapshotUrl: snapshot.snapshotUrl,
        lastAttempt: runDate,
        error: null,
      };

      console.log(`  title: ${parsed.title?.slice(0, 60) || '(none)'}`);
      console.log(`  meta:  ${parsed.meta?.slice(0, 60) || '(none)'}`);
      console.log(`  h1:    ${parsed.h1?.slice(0, 60) || '(none)'}`);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      results[brand.id] = { ...existing[brand.id], error: err.message, lastAttempt: runDate };
    }

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Write output
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
