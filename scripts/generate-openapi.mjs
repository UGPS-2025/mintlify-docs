import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "generated");
const outputPath = path.join(outputDir, "openapi.json");
const sourceUrl =
  process.env.OPENAPI_SOURCE_URL ?? "https://api.raul.ugps.io/api/openapi.json";

const response = await fetch(sourceUrl, {
  headers: {
    accept: "application/json",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch OpenAPI source: ${response.status} ${response.statusText}`);
}

const spec = await response.json();

if (typeof spec?.openapi !== "string") {
  throw new Error("Remote OpenAPI spec is missing a valid openapi version string");
}

sanitizeSpec(spec);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${sourceUrl}`);

function sanitizeSpec(document) {
  document.info ??= {
    title: "Raul API",
    version: "1.0.0",
  };
  document.info.title ||= "Raul API";
  document.info.version ||= "1.0.0";

  document.servers = [
    {
      url: "https://api.raul.ugps.io",
      description: "Production",
    },
  ];

  document.components ??= {};
  document.components.securitySchemes = {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Bearer token authentication",
    },
  };

  if (Array.isArray(document.security)) {
    document.security = rewriteSecurity(document.security);
  }

  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    const expectedPathParams = extractPathParams(routePath);

    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!isOperation(method, operation)) {
        continue;
      }

      operation.summary ||= buildSummary(method, routePath, operation.operationId);
      operation.parameters ??= [];
      normalizeSecurity(operation);
      ensurePathParameters(operation, expectedPathParams);
    }
  }

  walk(document, (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }

    if (node.nullable === true && node.type == null) {
      const inferredType = inferSchemaType(node);
      if (inferredType) {
        node.type = inferredType;
      }
    }
  });
}

function normalizeSecurity(operation) {
  if (!Array.isArray(operation.security)) {
    return;
  }

  operation.security = rewriteSecurity(operation.security);
}

function ensurePathParameters(operation, expectedPathParams) {
  const present = new Set(
    operation.parameters
      .filter((parameter) => parameter?.in === "path" && typeof parameter.name === "string")
      .map((parameter) => parameter.name),
  );

  for (const name of expectedPathParams) {
    if (present.has(name)) {
      continue;
    }

    operation.parameters.push({
      name,
      in: "path",
      required: true,
      description: `Path parameter: ${name}`,
      schema: {
        type: "string",
      },
    });
  }
}

function buildSummary(method, routePath, operationId) {
  if (typeof operationId === "string" && operationId.trim().length > 0) {
    return operationId
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  return `${method.toUpperCase()} ${routePath}`;
}

function rewriteSecurity(securityEntries) {
  return securityEntries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return entry;
    }

    const scopes =
      entry.bearer ??
      entry["JWT-auth"] ??
      entry.bearerAuth ??
      [];

    return {
      bearerAuth: Array.isArray(scopes) ? scopes : [],
    };
  });
}

function extractPathParams(routePath) {
  const matches = routePath.match(/\{([^}]+)\}/g) ?? [];
  return matches.map((match) => match.slice(1, -1));
}

function inferSchemaType(schema) {
  if (schema.properties && typeof schema.properties === "object") {
    return "object";
  }

  if (schema.items) {
    return "array";
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return primitiveTypeFromValue(schema.enum.find((value) => value != null));
  }

  if (schema.example !== undefined) {
    return primitiveTypeFromValue(schema.example);
  }

  if (schema.default !== undefined) {
    return primitiveTypeFromValue(schema.default);
  }

  if (schema.allOf || schema.anyOf || schema.oneOf || schema.$ref) {
    return "object";
  }

  if (schema.format) {
    return "string";
  }

  return "string";
}

function primitiveTypeFromValue(value) {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null || value === undefined) {
    return "string";
  }

  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return Number.isInteger(value) ? "integer" : "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "string";
  }
}

function isOperation(method, operation) {
  return (
    operation &&
    typeof operation === "object" &&
    !Array.isArray(operation) &&
    ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(method)
  );
}

function walk(node, visitor) {
  visitor(node);

  if (!node || typeof node !== "object") {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visitor);
    }
    return;
  }

  for (const value of Object.values(node)) {
    walk(value, visitor);
  }
}
