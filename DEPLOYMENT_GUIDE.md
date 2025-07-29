# Habit Tracker - Deployment Guide

This comprehensive guide will help you deploy the Habit Tracker application to GitHub Pages or other hosting platforms.

## 🚨 Current Issue: "Failed to Fetch" Error

The "failed to fetch" error occurs because the application requires Supabase environment variables that aren't configured in the deployment environment.

## 📋 Prerequisites

Before deploying, ensure you have:

1. **Supabase Project**: Set up a Supabase project with the required database schema
2. **GitHub Account**: For GitHub Pages deployment
3. **Node.js**: Version 18 or higher installed locally

## 🔑 Required Environment Variables

Your application needs these environment variables:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🗄️ Database Setup

Your Supabase project needs these tables:

### 1. Users Table
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);
```

### 2. Habits Table
```sql
CREATE TYPE habit_type AS ENUM (
  'book', 'running', 'ai_learning', 'job_search', 
  'swimming', 'weight', 'exercise', 'instagram'
);

CREATE TABLE habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type habit_type NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own habits" ON habits
  FOR ALL USING (auth.uid() = user_id);
```

### 3. Habit Completions Table
```sql
CREATE TABLE habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  habit_id uuid REFERENCES habits(id) ON DELETE CASCADE,
  date date NOT NULL,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, date)
);

ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own completions" ON habit_completions
  FOR ALL USING (auth.uid() = user_id);
```

### 4. Books Table
```sql
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  total_pages integer DEFAULT 0,
  finished_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own books" ON books
  FOR ALL USING (auth.uid() = user_id);
```

## 🚀 Deployment Options

### Option 1: GitHub Pages (Recommended)

#### Step 1: Prepare Repository
```bash
# Clone or fork the repository
git clone <your-repo-url>
cd habit-tracker

# Install dependencies
npm install
```

#### Step 2: Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Step 3: Update Package.json
Add these scripts to your `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist",
    "build": "vite build --base=/your-repo-name/"
  }
}
```

#### Step 4: Install GitHub Pages Dependency
```bash
npm install --save-dev gh-pages
```

#### Step 5: Configure Vite for GitHub Pages
Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/', // Replace with your repository name
  build: {
    outDir: 'dist',
  },
});
```

#### Step 6: Deploy
```bash
# Build and deploy
npm run deploy
```

#### Step 7: Configure GitHub Pages
1. Go to your repository on GitHub
2. Navigate to Settings → Pages
3. Select "Deploy from a branch"
4. Choose `gh-pages` branch
5. Your site will be available at: `https://yourusername.github.io/your-repo-name/`

### Option 2: Netlify

#### Step 1: Build Settings
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Step 2: Environment Variables
In Netlify dashboard:
1. Go to Site Settings → Environment Variables
2. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Option 3: Vercel

#### Step 1: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

#### Step 2: Set Environment Variables
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

## 🛠️ Troubleshooting

### Common Issues:

#### 1. "Failed to Fetch" Error
**Cause**: Missing environment variables
**Solution**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

#### 2. Build Failures
**Cause**: TypeScript or linting errors
**Solution**: Run `npm run build` locally to identify issues

#### 3. 404 Errors on Refresh
**Cause**: Missing redirect rules for SPA
**Solution**: Ensure `_redirects` file exists in `public` folder

#### 4. Authentication Issues
**Cause**: Incorrect Supabase URL or misconfigured RLS policies
**Solution**: Verify Supabase project setup and environment variables

### Debug Steps:

1. **Test Local Build**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Check Environment Variables**:
   ```javascript
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   ```

3. **Verify Supabase Connection**:
   - Test authentication in Supabase dashboard
   - Check RLS policies are properly configured

## 📁 File Structure

```
habit-tracker/
├── public/
│   ├── _redirects           # SPA redirect rules
│   └── index.html
├── src/
│   ├── components/          # React components
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client configuration
│   │   └── database.types.ts
│   ├── utils/
│   │   └── types.ts        # TypeScript type definitions
│   └── App.tsx             # Main application component
├── .env                    # Environment variables (local)
├── .env.example            # Environment variables template
├── package.json
├── vite.config.ts          # Vite configuration
└── netlify.toml           # Netlify configuration
```

## 🔒 Security Considerations

1. **Never commit `.env` files** to version control
2. **Use environment variables** for all sensitive data
3. **Configure RLS policies** properly in Supabase
4. **Enable email confirmation** in production (optional)
5. **Set up proper CORS** policies in Supabase

## 📱 Mobile Optimization

The app is designed mobile-first and includes:
- Touch-optimized interactions
- Responsive design
- PWA capabilities (can be added)
- Offline functionality (with service worker)

## 🎯 Performance Tips

1. **Enable Gzip compression** on your hosting platform
2. **Use CDN** for static assets
3. **Implement caching** strategies
4. **Optimize images** using WebP format
5. **Lazy load** components when needed

## 📞 Support

If you encounter issues:

1. Check the browser console for errors
2. Verify all environment variables are set
3. Test the Supabase connection independently
4. Review the deployment logs for specific error messages
5. Ensure your domain is added to Supabase allowed origins

## 🔄 Continuous Deployment

To set up automatic deployments:

### GitHub Actions (for GitHub Pages)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Remember to add your environment variables to GitHub Secrets!

---

**Happy Tracking! 🎯**

Your habit tracker is now ready to help you and your friends build consistent daily habits. The mobile-optimized interface makes it easy to track progress anywhere, anytime.