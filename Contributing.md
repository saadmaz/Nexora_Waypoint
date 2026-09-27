# 🤝 Waypoint — Team Git & Repository Guide

Welcome to the Waypoint repository! 🚚

This document explains **how everyone should use the repository**, how we manage branches, how we submit code, and the rules we follow to avoid conflicts and Git chaos. 😭

> **Golden Rule:** Nobody pushes directly to `main`.

---

# 🗺️ 1. How Our Git Structure Works

We use three levels of branches:

```text
                         🚀 main
                           ▲
                           │
                           │ Pull Request
                           │
                     🧪 develop
                           ▲
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             │             │             │
        feature/auth   feature/orders   feature/driver
             │             │             │
             👨‍💻            👩‍💻            👨‍💻
````

### 🟢 `main`

The **stable version** of Waypoint.

This should always be:

* Working
* Tested
* Demo-ready
* Safe to deploy

🚫 **Do NOT push directly to `main`.**

---

### 🟡 `develop`

The **main development/integration branch**.

All completed features are merged here first.

```text
feature/*
     ↓
 develop
     ↓
 testing
     ↓
 main
```

This is where the team's work comes together.

---

### 🔵 `feature/*`

Individual development branches.

Each person works on their assigned feature branch.

Example:

```text
feature/auth
feature/order-management
feature/dispatch-planning
feature/allocation-engine
feature/loader
feature/driver
feature/offline-sync
feature/store-receipt
feature/analytics
```

---

# 👥 2. Team Branch Assignment

Our initial branch ownership is:

| Branch                      | Responsibility                    |
| --------------------------- | --------------------------------- |
| `feature/auth`              | 🔐 Authentication & roles         |
| `feature/order-management`  | 📦 Orders & order lifecycle       |
| `feature/dispatch-planning` | 🗺️ Dispatcher planning           |
| `feature/allocation-engine` | 🧠 Fleet allocation & constraints |
| `feature/loader`            | 🏭 Loading workflow               |
| `feature/driver`            | 🚚 Driver delivery workflow       |
| `feature/offline-sync`      | 📡 Offline mode & synchronization |
| `feature/store-receipt`     | 🏪 Store receiving & confirmation |
| `feature/analytics`         | 📊 Analytics & intelligence       |

> ⚠️ Branch ownership does not mean nobody else can contribute to that area. It simply gives each area a primary owner.

---

# 💻 3. First Time Setup

Clone the repository:

```bash
git clone <REPOSITORY_URL>
```

Enter the project:

```bash
cd <REPOSITORY_NAME>
```

Check the available branches:

```bash
git branch -a
```

You should see something similar to:

```text
main
develop
remotes/origin/main
remotes/origin/develop
remotes/origin/feature/auth
...
```

---

# 🔀 4. Switch to Your Branch

For example, if you are working on authentication:

```bash
git checkout feature/auth
```

Or:

```bash
git switch feature/auth
```

Check that you're on the correct branch:

```bash
git branch
```

You should see:

```text
* feature/auth
  develop
  main
```

The `*` shows your current branch.

---

# 🧠 5. BEFORE You Start Coding

Always make sure your branch is up to date.

Run:

```bash
git checkout develop
git pull origin develop
```

Then return to your feature branch:

```bash
git checkout feature/auth
```

Update your feature branch with the latest development code:

```bash
git merge develop
```

Now you are working with the latest version of the project.

---

# ✍️ 6. Start Working

Now you can safely work on your assigned feature.

For example:

```text
feature/order-management
```

You might create:

```text
orders/
├── components/
├── services/
├── hooks/
└── ...
```

Follow the existing project structure.

🚨 **Do not randomly create new folders or architectures without discussing them with the team.**

---

# 💾 7. Check Your Changes

Before committing:

```bash
git status
```

Review what you've changed.

You can inspect specific changes with:

```bash
git diff
```

Make sure you haven't accidentally modified unrelated files.

---

# 📦 8. Commit Your Work

Add your changes:

```bash
git add .
```

Then commit:

```bash
git commit -m "feat: implement order management"
```

---

# 📝 9. Commit Message Convention

Please use clear commit messages.

### ✨ New Feature

```text
feat: add order creation
```

### 🐛 Bug Fix

```text
fix: resolve vehicle capacity validation
```

### 🛠️ Refactoring

```text
refactor: simplify allocation service
```

### 📚 Documentation

```text
docs: update architecture documentation
```

### 🧪 Tests

```text
test: add allocation engine tests
```

### 🎨 UI

```text
style: improve dispatcher dashboard layout
```

### ⚙️ Configuration

```text
chore: update docker configuration
```

---

# 🚀 10. Push Your Branch

After committing:

```bash
git push
```

If it's your first push:

```bash
git push -u origin feature/auth
```

Replace the branch name with your own branch.

---

# 🔀 11. Create a Pull Request

Once your feature is ready:

Go to GitHub.

You should see:

> **Compare & pull request**

Create a Pull Request:

```text
FROM:
feature/your-branch

TO:
develop
```

### ✅ Correct

```text
feature/auth
      ↓
     PR
      ↓
   develop
```

### ❌ Wrong

```text
feature/auth
      ↓
     PR
      ↓
    main
```

---

# 📋 12. Pull Request Format

Use a clear title.

Example:

```text
feat: implement order management
```

Description:

```markdown
## 🚀 What was added?

- Order creation
- Order validation
- Order status management
- Order API endpoints

## 🧪 Testing

- Tested order creation
- Tested order validation
- Tested status changes

## 📸 Screenshots

Add screenshots if relevant.

## ⚠️ Notes

Mention anything reviewers should know.
```

---

# 👀 13. Code Review

Every important PR should be reviewed by another team member.

The reviewer should check:

* ✅ Does it work?
* ✅ Is the code understandable?
* ✅ Does it follow the project structure?
* ✅ Does it break existing functionality?
* ✅ Are edge cases handled?
* ✅ Are database/API changes correct?
* ✅ Are tests included where appropriate?

If everything looks good:

**Approve → Merge**

---

# 🔄 14. Keeping Your Branch Updated

Because 9 people are working simultaneously, `develop` will change frequently.

Before starting work each day:

```bash
git checkout develop
git pull origin develop
```

Then:

```bash
git checkout feature/your-branch
git merge develop
```

If there are conflicts, resolve them carefully.

Then:

```bash
git add .
git commit -m "chore: resolve merge conflicts"
```

---

# ⚠️ 15. Merge Conflicts

Don't panic. 😭

A merge conflict usually means two people changed the same piece of code.

You'll see something like:

```text
<<<<<<< HEAD
Your changes
=======
Changes from develop
>>>>>>> develop
```

Decide which code should remain, or combine both changes.

Then remove the conflict markers:

```text
<<<<<<<
=======
>>>>>>>
```

After fixing:

```bash
git add .
git commit -m "fix: resolve merge conflict"
```

If you're unsure:

> 🛑 **Ask the person who owns that feature before resolving it.**

Do NOT blindly delete someone's work.

---

# 🚨 16. VERY IMPORTANT — Never Do This

### ❌ Don't push directly to main

```bash
git checkout main
git push
```

Don't.

---

### ❌ Don't force push

Avoid:

```bash
git push --force
```

Especially on:

```text
main
develop
```

Force pushing can destroy other people's work.

---

### ❌ Don't commit secrets

Never commit:

```text
.env
API keys
passwords
private keys
credentials
```

Use:

```text
.env.example
```

instead.

---

### ❌ Don't commit competition datasets

The Tech-Triathlon datasets must not be publicly distributed.

Keep them local.

---

### ❌ Don't commit random files

Before:

```bash
git add .
```

check:

```bash
git status
```

Make sure you're not accidentally committing:

```text
node_modules/
.env
large files
datasets
build files
temporary files
IDE files
```

---

# 🧹 17. Keep Your Code Clean

Before opening a PR:

```bash
npm run lint
```

or the project's equivalent.

Run tests:

```bash
npm test
```

Build the application:

```bash
npm run build
```

Use whatever commands are defined by the project.

A PR should ideally be:

```text
Code
  ↓
Lint
  ↓
Tests
  ↓
Build
  ↓
PR
```

---

# 🏗️ 18. Don't Change Core Architecture Without Discussion

Some parts of Waypoint affect everyone.

Examples:

* Database schema
* API contracts
* Authentication
* Shared types
* Allocation rules
* Core domain models
* Docker configuration

Before making major changes to these:

💬 Discuss them with the team.

Especially:

```text
Database
    ↓
API
    ↓
Frontend
```

If one person changes the database structure without informing the others, three other people's code might break.

---

# 🔗 19. Shared Contracts

The following should be treated as shared team contracts:

### API

```text
Request
↓
API
↓
Response
```

### Database

```text
Entity
↓
Relationship
↓
Validation
```

### Domain Models

```text
Order
Vehicle
Trip
Delivery
Outlet
User
```

Don't independently create different versions of the same model.

For example, don't have:

```text
Frontend:
orderId

Backend:
id

Allocation Engine:
order_ref
```

unless that difference is intentional and documented.

Consistency matters. 🧠

---

# 🚦 20. Development Flow

Our normal workflow is:

```text
🧑‍💻 Pick Task
      ↓
🌿 Checkout Feature Branch
      ↓
⬇️ Pull Latest develop
      ↓
💻 Code
      ↓
🧪 Test
      ↓
💾 Commit
      ↓
🚀 Push
      ↓
🔀 Pull Request
      ↓
👀 Code Review
      ↓
✅ Merge into develop
      ↓
🧪 Integration Testing
      ↓
🚀 develop → main
```

---

# 🏁 21. When Do We Merge Into `main`?

Not every feature.

`main` should only receive code when the team agrees that the current version is stable.

For example:

```text
All major features complete
          ↓
Integration testing
          ↓
End-to-end testing
          ↓
Judge walkthrough tested
          ↓
Critical bugs fixed
          ↓
develop → main
```

---

# 🧪 22. Testing the Full Waypoint Workflow

Before calling a build "ready", test the complete workflow:

```text
🏪 Store Manager
      ↓
📦 Create Order
      ↓
🧠 Dispatcher
      ↓
🚚 Allocate Vehicle
      ↓
🏭 Loader
      ↓
📦 Load Vehicle
      ↓
🚛 Driver
      ↓
📍 Deliver
      ↓
📸 Proof of Delivery
      ↓
🏪 Store Manager
      ↓
✅ Confirm Receipt
```

Also test:

```text
⚠️ Capacity exceeded
⚠️ Chilled order
⚠️ Van-only outlet
⚠️ Deferred order
⚠️ Loading issue
📡 Offline driver
🔄 Sync after reconnect
```

---

# 👨‍💻 23. Working With Another Developer

Sometimes two people need to work on the same feature.

Don't have both people randomly push to the same branch.

Instead:

```text
feature/driver
      │
      ├── feature/driver-route
      │
      └── feature/driver-pod
```

Each person works independently.

Then merge the smaller branches into the main feature branch.

---

# 📁 24. Repository Structure

The repository should broadly follow:

```text
Waypoint/
│
├── apps/
│   └── web/
│
├── services/
│   ├── api/
│   ├── allocation-engine/
│   └── prediction/
│
├── docs/
│
├── scripts/
│
├── data/
│
├── tests/
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

Don't create unnecessary top-level folders.

---

# 🔐 25. Protected Branches

The GitHub repository should have branch protection enabled for:

```text
main
```

Recommended rules:

* ✅ Pull Request required
* ✅ At least 1 approval
* ✅ No direct pushes
* ✅ No force pushes
* ✅ No branch deletion

Optionally protect:

```text
develop
```

as the project becomes more stable.

---

# 🆘 26. If You Mess Something Up

Don't panic.

Git is usually recoverable. 😭

If you're unsure what to do:

### STOP.

Don't run random commands from Stack Overflow.

Especially avoid:

```bash
git reset --hard
git push --force
git clean -fd
```

unless you know exactly what they do.

Ask the team first.

---

# 📌 27. Quick Command Cheat Sheet

### Check branch

```bash
git branch
```

### Switch branch

```bash
git checkout feature/your-branch
```

### Get latest develop

```bash
git checkout develop
git pull origin develop
```

### Update your feature branch

```bash
git checkout feature/your-branch
git merge develop
```

### Check changes

```bash
git status
```

### Add changes

```bash
git add .
```

### Commit

```bash
git commit -m "feat: your message"
```

### Push

```bash
git push
```

### Create a new branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/new-feature
git push -u origin feature/new-feature
```

---

# 🚀 28. Our Golden Rules

## 🥇 Rule 1

**Never push directly to `main`.**

## 🥈 Rule 2

**Always work on a feature branch.**

## 🥉 Rule 3

**Pull from `develop` regularly.**

## 4️⃣ Rule 4

**Make small, focused commits.**

## 5️⃣ Rule 5

**Test before creating a PR.**

## 6️⃣ Rule 6

**Review other people's code.**

## 7️⃣ Rule 7

**Don't commit secrets or competition datasets.**

## 8️⃣ Rule 8

**Don't change shared architecture without telling the team.**

## 9️⃣ Rule 9

**If you don't understand a merge conflict, ask.**

## 🔟 Rule 10

**Keep `main` stable.**

---

# ❤️ Final Principle

We're 9 people working on one product.

That means Git is not just about pushing code.

It's about making sure:

```text
Your work
   +
Their work
   +
Everyone else's work
   ↓
One working Waypoint
```

Don't optimize for:

> "My feature is finished."

Optimize for:

> **"Our system works."** 🚚

---

# 🚚 Waypoint

**Order. Plan. Allocate. Load. Deliver. Confirm.**

Let's build something that works. 🔥
