# Raul API Docs

Documentacion tecnica de Raul API en Mintlify.

Este repo publica dos cosas a la vez:

- **Guias editoriales** para entender dominios, permisos y flujos
- **Referencia API** generada desde el OpenAPI productivo de `https://api.raul.ugps.io/api/openapi.json`

## Requisitos

- Node `20` (`.nvmrc`)
- `git`
- acceso a internet para validar Mintlify y descargar el CLI via `npx`

## Scripts principales

```bash
npm run openapi:generate      # Regenera generated/openapi.json y generated/specs/*
npm run openapi:assert-clean  # Falla si los artefactos generados difieren de git
npm run openapi:check         # Generate + assert-clean
npm run docs:validate         # Valida build de Mintlify
npm run docs:broken-links     # Revisa links rotos
npm run docs:ci               # Flujo completo de CI
npm run docs:dev              # Preview local con tu Node actual
npm run docs:dev:lts          # Preview local forzando Node 20
```

## Flujo recomendado de trabajo

1. Usa `nvm use`.
2. Edita las paginas `.mdx` o la configuracion `docs.json`.
3. Si cambias algo relacionado con endpoints o agrupacion OpenAPI, corre `npm run openapi:generate`.
4. Antes de cerrar cambios, corre:

```bash
npm run docs:validate
npm run docs:broken-links
```

## OpenAPI y dominio de specs

El archivo [scripts/generate-openapi.mjs](./scripts/generate-openapi.mjs) hace tres cosas:

1. descarga o carga el OpenAPI fuente
2. normaliza detalles para Mintlify
3. divide la referencia por dominios (`auth`, `clients`, `operations`, `communications`, `sales`, `finance`, `diagnostics`, `settings`, `platform`)

Si aparece una ruta nueva que no calza en ningun dominio, la generacion falla. Eso evita dejar endpoints fuera del tab **API**.

## CI y drift detection

El repo incluye workflows para:

- validar docs en PR y `main`
- regenerar OpenAPI y comprobar que los artefactos generados estan committed
- detectar drift del OpenAPI remoto en ejecuciones programadas

Si CI marca drift, regenera con:

```bash
npm run openapi:generate
```

y commitea los cambios de `generated/openapi.json` y `generated/specs/*`.

## Publicacion

Mintlify despliega este repo; el backend solo expone:

- `/api/openapi.json`
- `/api/docs` como entrypoint hacia la UI de docs

## Referencias

- [Mintlify docs](https://mintlify.com/docs)
- [OpenAPI productivo](https://api.raul.ugps.io/api/openapi.json)
