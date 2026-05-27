# Files to DELETE from your repo

Run these commands in your skss-catalogue repo root:

```bash
git rm lib/supabase.ts
git rm postcss.config.mjs
git commit -m "fix: remove dead lib/supabase.ts and duplicate postcss.config.mjs"
```

Also add package-lock.json to git (it was on disk but not tracked):
```bash
git add package-lock.json
git commit -m "chore: track package-lock.json for reproducible builds"
```
