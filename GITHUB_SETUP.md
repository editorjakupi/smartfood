# GitHub Setup Instructions

## Quick Commands

After creating the GitHub repository, run these commands in order:

```bash
# 1. Make sure you're in the project directory
cd "studymodules/NBI Handlesakademin/AI - teori och tillämpning/del2/Kunskapkskontroll/del2/smartfood"

# 2. Remove TFDS data from staging (if already added - it's too large)
git reset HEAD data/tfds/ 2>/dev/null || echo "TFDS not in staging"

# 3. Stage all files (TFDS will be ignored now)
git add .

# 4. Check what will be committed
git status

# 5. Commit
git commit -m "Initial commit: SmartFood AI food classification system"

# 6. Add remote (REPLACE with your actual GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/smartfood.git

# 7. Verify remote
git remote -v

# 8. Push to GitHub
git branch -M main
git push -u origin main
```

## Important Notes

- The warnings about LF/CRLF are normal on Windows - you can ignore them
- `data/tfds/` folder is now ignored (too large for GitHub)
- `.env.local` is ignored (contains your API keys)
- Model files (_.keras, _.h5) are ignored (too large)

## After First Push

1. Go to Vercel.com
2. Import your GitHub repository
3. Add environment variables:
   - `GROQ_API_KEY`
   - `GOOGLE_CLOUD_VISION_API_KEY`
4. Deploy!

Future pushes will automatically deploy to Vercel.
