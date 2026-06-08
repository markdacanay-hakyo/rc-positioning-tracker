# RingCentral Competitor Homepage Positioning Tracker

Tracks H1, page title, and meta description changes for 14 UCaaS, CCaaS, Revenue AI, and AI-Native competitors — automatically updated weekly via the Wayback Machine.

## How it works

1. **GitHub Pages** hosts `index.html` as a live website
2. **GitHub Actions** runs every Monday at 8am UTC — fetches the latest archived snapshot for each competitor from the [Wayback Machine CDX API](https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server), parses the HTML for `<title>`, `<meta name="description">`, and `<h1>`, then commits results to `data/live.json`
3. The dashboard reads `live.json` on load and highlights any fields that differ from stored baselines

## Setup

### 1. Create a new GitHub repo and push these files

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_ORG/rc-positioning-tracker.git
git push -u origin main
```

### 2. Enable GitHub Pages

- Go to **Settings → Pages**
- Set Source to `Deploy from a branch`
- Set Branch to `main`, folder `/ (root)`
- Save — your site will be live at `https://YOUR_ORG.github.io/rc-positioning-tracker`

### 3. Trigger the first data fetch

- Go to **Actions → Refresh Competitor Data → Run workflow**
- This fetches all 14 brands and commits `data/live.json`
- After that it runs automatically every Monday at 8am UTC

## Repo structure

```
index.html                        # Dashboard (GitHub Pages entry point)
data/
  live.json                       # Auto-committed by GitHub Actions each week
scripts/
  fetch-data.mjs                  # Node.js script that queries Wayback CDX API
  package.json
.github/
  workflows/
    refresh.yml                   # Scheduled GitHub Action
README.md
.gitignore
```

## Adjusting the refresh schedule

Edit the `cron` line in `.github/workflows/refresh.yml`:

```yaml
- cron: '0 8 * * 1'    # Every Monday 8am UTC  (default)
- cron: '0 8 * * *'    # Daily at 8am UTC
- cron: '0 8 1 * *'    # Monthly, 1st of the month
```

## Updating baselines

When a competitor officially repositions and you want to reset the diff, edit the `brands` array in `index.html` — update `current` and move the old values into `history`.

## Manual browser refresh

The dashboard also has a **"Refresh All Brands"** button and per-card **"↻ Refresh"** buttons for on-demand spot checks. These run browser-side and are in-memory only — they don't write back to `live.json`.
