# HRMS Backend — Setup & Contribution Guide

This document outlines how to set up the project locally and the required workflow for contributing through GitHub.
Please follow these guidelines strictly to maintain repository consistency.

---

# Installation & Setup

## 1. Clone the Repository

```bash
git clone https://github.com/projjwalsen/Razonova-HRMS-Backend.git
cd HRMS-BACKEND
```

## 2. Install Dependencies

```bash
npm install
# or
yarn install
```

## 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/hrms_db"
PORT=5000
JWT_SECRET="your-secret-key"
```

## 4. Run Prisma Migrations

```bash
npx prisma migrate dev
# or to just apply existing migrations
npx prisma migrate deploy
```

## 5. Seed the Database (Permissions)

```bash
npx prisma db seed
```

## 6. Start Development Server

```bash
npm run dev
# or
yarn dev
```

Open `http://localhost:5000` with Insomnia or Postman to test the API.
Swagger docs available at `http://localhost:5000/api-docs`.

---

# Git Workflow — Mandatory

## Step 1: Always Pull the Latest `dev`

Before creating any branch, ensure you have the latest code:

```bash
git checkout dev
git pull origin dev
```

## Step 2: Create a Feature Branch

Use proper naming convention → `phase-name/task-name` (all lowercase, hyphen-separated)

Examples:

```bash
git checkout -b p1/auth
git checkout -b p1/org-settings
git checkout -b p2/permissions
git checkout -b p2/role-management
```

## Step 3: Work on Your Feature

Make changes, test thoroughly, and keep commits atomic and meaningful.

```bash
git add .
git commit -m "feat: add organization settings upsert controller"
```

**Commit message conventions:**

| Prefix | When to use |
|---|---|
| `feat:` | New feature or endpoint |
| `fix:` | Bug fix |
| `refactor:` | Code change with no feature/fix |
| `chore:` | Config, deps, or tooling changes |
| `docs:` | Documentation only |

Make sure to take the latest pull from `dev` before pushing your code:

```bash
git pull origin dev
```

Resolve any merge conflicts locally before proceeding.

## Step 4: Generate a Build Locally Before Pushing

Ensure everything compiles without errors:

```bash
npm run build
```

Also verify Prisma client is in sync:

```bash
npx prisma generate
```

Only push if your build completes successfully — **never push a broken build.**

## Step 5: Push Your Branch

```bash
git push origin <your-branch>
```

Example:

```bash
git push origin p1/org-settings
```

Then open a **Pull Request** on GitHub targeting the `dev` branch.

---

# Pull Request Guidelines

- PR title must match the branch name and describe the change clearly
- Add a short description of **what** you changed and **why**
- Tag at least one reviewer before marking as Ready for Review
- Never merge your own PR — always wait for approval
- Delete your branch after it is merged

---

# Project Structure

```
hrms-backend/
├── prisma/
│   ├── schema.prisma        # DB models
│   ├── migrations/          # Auto-generated migration files
│   └── seed.ts              # Permission seeder
├── src/
│   ├── controllers/
│   │   ├── org.controller.ts        # Organization settings
│   │   └── permission.controller.ts # Permissions
│   ├── routes/
│   │   └── org.routes.ts
│   ├── middleware/
│   └── index.ts             # Entry point
├── .env                     # Local env (never commit this)
├── .env.example             # Committed env template
└── package.json
```

---

# Rules — No Exceptions

| Rule | Why |
|---|---|
| Always branch from latest `dev` | Avoid merge conflicts |
| Never push directly to `dev` or `main` | Protect stable branches |
| Build must pass before push | No broken code in remote |
| Pull from `dev` before pushing | Stay in sync with teammates |
| One feature per branch | Clean, reviewable PRs |
| Never commit `.env` | Security — secrets stay local |
