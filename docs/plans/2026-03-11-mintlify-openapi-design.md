# Mintlify OpenAPI Sanitization Design

## Goal

Make `mintlify-docs` usable with Mintlify by generating a local OpenAPI document from the backend spec and applying the minimum fixes Mintlify needs to render and validate it.

## Problem

- `mint dev` does not run on Node 25+, and this repo does not pin a supported Node version.
- `docs.json` points directly to `https://api.raul.ugps.io/api/openapi.json`.
- The remote spec is not Mintlify-safe. It contains invalid security references, missing operation summaries, and nullable schemas without explicit types.

## Recommended approach

Generate a local sanitized OpenAPI artifact inside the docs repo and make Mintlify consume that file.

### Why this approach

- It removes runtime dependence on an invalid upstream spec during local build.
- It keeps the source of truth in the backend while making docs builds deterministic.
- It avoids adding a proxy service or custom runtime just to transform JSON.

## Design

### Inputs

- Remote source: `https://api.raul.ugps.io/api/openapi.json`

### Outputs

- Generated file: `generated/openapi.json`

### Sanitization rules

1. Rewrite `security` requirements that reference `bearer` to `JWT-auth` when that scheme exists.
2. Add `summary` to operations that do not define one.
3. Add explicit `type` when `nullable: true` appears without `type`.
4. Normalize `servers` so the generated spec points to `https://api.raul.ugps.io`.

### Repo changes

- Add `scripts/generate-openapi.mjs`
- Add `package.json` with scripts for generation and validation
- Add `.nvmrc` with LTS Node
- Update `docs.json` to use the generated file
- Update `README.md` with the new workflow

## Validation

- `npm run openapi:generate`
- `npx mint validate`
- `npx mint broken-links`

## Non-goals

- Fully repairing all backend OpenAPI defects at the source
- Building a custom documentation renderer
