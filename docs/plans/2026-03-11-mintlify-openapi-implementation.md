# Mintlify OpenAPI Sanitization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a local Mintlify-safe OpenAPI file and wire the docs site to use it.

**Architecture:** A Node script fetches the backend OpenAPI, applies minimal structural repairs, and writes a generated artifact inside the repo. Mintlify reads the generated artifact instead of the remote URL.

**Tech Stack:** Node.js, Mintlify CLI, JSON/OpenAPI

---

### Task 1: Add generation tooling

**Files:**
- Create: `scripts/generate-openapi.mjs`
- Create: `package.json`

**Step 1: Write the failing test**

Create a validation step by running Mintlify against the current remote spec and confirm it fails.

**Step 2: Run test to verify it fails**

Run: `npx mint validate`
Expected: FAIL due to OpenAPI validation warning

**Step 3: Write minimal implementation**

Add a generator script that fetches the remote OpenAPI and writes `generated/openapi.json` after applying the required transformations.

**Step 4: Run test to verify it passes**

Run: `npm run openapi:generate`
Expected: generated file exists and is valid JSON

### Task 2: Point Mintlify at the generated artifact

**Files:**
- Modify: `docs.json`
- Create: `.nvmrc`
- Modify: `README.md`

**Step 1: Write the failing test**

Use the current Mintlify config and confirm local development is blocked or validation fails.

**Step 2: Run test to verify it fails**

Run: `npx mint validate`
Expected: FAIL

**Step 3: Write minimal implementation**

Point `docs.json` to `generated/openapi.json`, pin Node to an LTS release, and document the generation step.

**Step 4: Run test to verify it passes**

Run: `npx mint validate && npx mint broken-links`
Expected: validation succeeds and no broken links are reported
