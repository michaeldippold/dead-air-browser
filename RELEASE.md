# Release Procedure

Follow these steps every time a version ships. Do them in order. Don't skip steps because you plan to "do them later."

---

## Step 1 — Update CHANGELOG.md

Add a new entry at the **top** of the changelog (below the header, above the previous version).

Structure:
```
## [X.Y.Z] — YYYY-MM-DD

### Overview
One paragraph describing the version in plain language.

---

### [Topic area]
- Bullet points for each notable change in that area.
```

Rules:
- Write past tense ("Added X", "Replaced Y") — these are facts, not plans
- One section per major area (UI, simulation, narrative, etc.)
- Mention the *why* when it's non-obvious, not just the *what*
- If you shipped something and can't remember what changed, read `git log --oneline` between the previous tag and HEAD

---

## Step 2 — Update todo.md

- Move completed items out of their version section and into **What's Shipped**
- Update version headers if the roadmap has shifted
- Remove any items that were cut or are no longer relevant

---

## Step 3 — Commit the documentation

```
git add CHANGELOG.md todo.md
git commit -m "vX.Y.Z: update changelog and todo"
```

---

## Step 4 — Tag the release

```
git tag vX.Y.Z
```

This marks the exact commit as the canonical release point. Tags are what the release zip corresponds to — don't tag before the documentation is committed.

---

## Step 5 — Build and create the release zip

The game is a Vite project (since Map v3): `index.html` + `main.js` are bundled, and the map
data in `public/data/` (tiles, road graph, districts, places) is copied through verbatim.

```
npm ci
npm run build
```

`dist/` is the playable build. Zip it:

```powershell
Compress-Archive -Path dist\* -DestinationPath releases/dispatch-vX.Y.Z.zip -Force
```

Deploy = serve `dist/` from any static host that supports HTTP Range requests (GitHub Pages,
Netlify, `npx serve dist` all do). `lexington.pmtiles` is one 10 MB file read by byte range;
without Range support the basemap never loads. Verify in the Network tab: tile requests are
`206 Partial Content`.

Do NOT include: `.git/`, `releases/`, `design.md`, `todo.md`, `CHANGELOG.md`, `RELEASE.md`,
`map-integration.md`, `spike-map/`, `node_modules/`.

---

## Step 6 — Commit the zip and push

```
git add releases/dispatch-vX.Y.Z.zip
git commit -m "Add release zip vX.Y.Z"
git push
git push --tags
```

---

## Version Number Rules

| Pattern | When to use |
|---|---|
| `0.Y.0` | Pre-1.0 milestone releases. Y increments for each named version (0.7, 0.8, 0.9...) |
| `1.0.0` | First public release. Strangers can pick it up without help. |
| `1.Y.0` | Post-1.0 feature releases. Increment Y for each batch of new features. |
| `1.Y.Z` | Patch releases. Increment Z for bug fixes or small polish with no new features. |

**The third digit (Z) does not exist before 1.0.0.** Pre-1.0 versions are always `0.Y.0`.

---

## Quick Reference — What Goes Where

| Thing | Where |
|---|---|
| What changed and why | CHANGELOG.md |
| What's coming next | todo.md |
| How to release | RELEASE.md (this file) |
| Playable builds | releases/ |
| Canonical version points | git tags |
