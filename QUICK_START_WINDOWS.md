# 🚀 Quick Start Guide for Windows Users

**Getting the "git is not recognized" error? Follow these steps:**

## Step 1: Install Git (Required)

1. **Go to this website:** [git-scm.com/download/win](https://git-scm.com/download/win)
2. **Click the download button** (it will download Git-2.xx.x-64-bit.exe)
3. **Run the downloaded file** and click "Next" through all screens
4. **⚠️ IMPORTANT: Restart your computer** after installation

## Step 2: Use the Right Terminal

**❌ Don't use PowerShell (the blue window you're using)**
**✅ Use Command Prompt instead:**

1. **Press Windows key + R**
2. **Type:** `cmd`
3. **Press Enter**
4. **You should see a black window** (not blue)

## Step 3: Test Git Installation

In the black Command Prompt window, type:
```
git --version
```

**If you see:** `git version 2.xx.x` → ✅ Git is installed correctly!
**If you see:** `git is not recognized` → ❌ Go back to Step 1

## Step 4: Navigate to Your Project

1. **In Command Prompt, type:** `cd ` (with a space after cd)
2. **Drag your project folder into the window** - this types the path automatically
3. **Press Enter**

Example: `cd C:\Users\Krishna Amar\Downloads\project\Habit-Tracker`

## Step 5: Run Git Commands

Now you can run the Git commands from the main guide:

1. `git init`
2. `git add .`
3. `git commit -m "Initial commit: My habit tracker app"`
4. `git branch -M main`
5. `git remote add origin https://github.com/YOUR_USERNAME/habit-tracker.git`
6. `git push -u origin main`

## Still Having Issues?

**Problem: PowerShell vs Command Prompt**
- PowerShell = Blue window with `PS C:\>` 
- Command Prompt = Black window with `C:\>`
- You MUST use Command Prompt (black window)

**Problem: Git still not recognized after restart**
- Try restarting your computer again
- Make sure you downloaded from git-scm.com (not another site)
- Try running Command Prompt as Administrator:
  - Right-click on Command Prompt
  - Select "Run as administrator"

**Problem: Path issues**
- Make sure you're in the right folder
- Use `dir` command to see what files are in your current folder
- You should see files like `package.json` and `src` folder