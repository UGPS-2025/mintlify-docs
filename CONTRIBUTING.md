# Contributing to Raul API Docs

Gracias por mejorar la documentacion de Raul.

## Antes de abrir cambios

1. Usa Node `20`:

```bash
nvm use
```

2. Crea una rama para tu trabajo.
3. Si tu cambio toca endpoints, OpenAPI o agrupacion de dominio, regenera artefactos:

```bash
npm run openapi:generate
```

## Checklist minimo

Antes de abrir PR, corre:

```bash
npm run docs:validate
npm run docs:broken-links
```

Si cambiaste el flujo OpenAPI o el backend ya expone nuevos endpoints, corre ademas:

```bash
npm run openapi:assert-clean
```

## Cuando debes regenerar OpenAPI

Haz `npm run openapi:generate` cuando:

- cambie `scripts/generate-openapi.mjs`
- cambie la clasificacion de dominios en `docs.json`
- aparezcan endpoints nuevos en el backend
- se renombren grupos funcionales de la referencia API

## Estilo editorial

- Escribe en espanol claro y directo.
- Prioriza contexto de negocio en las guias y contrato exacto en la pestaña **API**.
- No dupliques todo el OpenAPI en MDX manual si la referencia ya lo cubre.
- Cuando una regla sea inferida del backend actual, dilo explicitamente.
- Prefiere ejemplos concretos y flujos completos por sobre listas abstractas.

## PRs recomendados

Un PR de docs ideal deja claro:

- que paginas cambiaste
- si hubo que regenerar `generated/openapi.json`
- si se agregaron o movieron specs dentro de `generated/specs/*`
- que validaciones corriste

## CI

El repo valida automaticamente:

- generacion OpenAPI
- drift de artefactos generados
- build de Mintlify
- broken links
