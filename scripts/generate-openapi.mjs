import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "generated");
const outputPath = path.join(outputDir, "openapi.json");
const specsDir = path.join(outputDir, "specs");
const sourceRef =
  process.env.OPENAPI_SOURCE_URL ?? "https://api.raul.ugps.io/api/openapi.json";
const tagDescriptions = {
  Auth: "Autenticacion, sesiones, usuarios y recuperacion de acceso.",
  Clients: "Clientes, contactos asociados y entidades comerciales.",
  GPS: "Dispositivos, inventario, conectividad y catalogos de GPS.",
  Subscriptions: "Planes, suscripciones, estados y ciclos de servicio.",
  Visits: "Visitas tecnicas, agenda operativa y seguimiento en terreno.",
  Billing: "Cobranza, documentos tributarios, pagos y facturacion.",
  Catalogs: "Catalogos maestros y datos de referencia del negocio.",
  Analytics: "Indicadores, reportes y consultas agregadas.",
};

const spec = await loadSpec(sourceRef);

if (typeof spec?.openapi !== "string") {
  throw new Error("Remote OpenAPI spec is missing a valid openapi version string");
}

sanitizeSpec(spec);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
await writeDomainSpecs(spec);

console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${sourceRef}`);

async function loadSpec(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI source: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  const localPath =
    source.startsWith("file://")
      ? fileURLToPath(source)
      : path.isAbsolute(source)
        ? source
        : path.resolve(repoRoot, source);

  const raw = await readFile(localPath, "utf8");
  return JSON.parse(raw);
}

function sanitizeSpec(document) {
  document.info = {
    ...(document.info ?? {}),
    title: "Raul API",
    version: document.info?.version || "1.0.0",
    description:
      "Referencia oficial de Raul API generada desde OpenAPI. Incluye autenticacion, clientes, GPS, suscripciones, visitas, billing y analytics sobre `https://api.raul.ugps.io`.",
  };

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

  normalizeTags(document);

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

async function writeDomainSpecs(document) {
  await mkdir(specsDir, { recursive: true });
  const coveredPaths = new Set();

  const domains = [
    {
      filename: "auth.json",
      title: "Raul API - Acceso",
      description: "Autenticacion, sesiones, usuarios y seguridad base.",
      match: (routePath) => routePath === "/api" || routePath.startsWith("/api/auth"),
    },
    {
      filename: "clients.json",
      title: "Raul API - Clientes",
      description: "Clientes, clientes padre, direcciones, contactos y activos asociados.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/v1/client",
          "/api/v1/client_father",
          "/api/v1/clients/",
          "/api/v1/client-addresses",
          "/api/v1/contact",
          "/api/v1/vehicle",
          "/api/v1/type_vehicle",
          "/api/v1/asset",
          "/api/v1/plataform_client",
        ]),
    },
    {
      filename: "operations.json",
      title: "Raul API - Operaciones",
      description: "Suscripciones, GPS, actividades, visitas y operacion tecnica.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/v1/subscription",
          "/api/v1/gps",
          "/api/v1/gps_",
          "/api/v1/activity",
          "/api/v1/activity-",
          "/api/v1/visit",
          "/api/v1/visit_",
          "/api/v1/technician",
          "/api/v1/patente",
          "/api/v1/patentes",
          "/api/v1/ticket",
          "/api/v1/transfers",
          "/api/v1/tasks",
          "/api/v1/inactive-devices",
        ]),
    },
    {
      filename: "communications.json",
      title: "Raul API - Comunicaciones",
      description: "Inbox, omnichannel, bandejas compartidas, email sync, WhatsApp, spam y tags.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/omnichannel",
          "/api/shared-mailboxes",
          "/api/webhooks/mailgun",
          "/api/v1/omnichannel/email/sync",
        ]),
    },
    {
      filename: "sales.json",
      title: "Raul API - Ventas",
      description: "Cotizaciones, pipeline, outreach comercial, equipos cotizables y ventas de equipamiento.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/v1/quotes",
          "/api/quotes/",
          "/api/v1/quoter",
          "/api/v1/pipeline-stages",
          "/api/v1/equipment-sales",
          "/api/v1/shipments",
          "/api/v1/shipment-orders",
          "/api/v1/sellers",
          "/api/v1/currency",
          "/api/v1/accessory",
          "/api/v1/plans",
          "/api/v1/plan-categories",
          "/api/product-knowledge",
          "/api/v1/warehouse",
        ]),
    },
    {
      filename: "finance.json",
      title: "Raul API - Finanzas",
      description: "Facturas, boletas, ejecuciones de billing, cuentas por pagar y medios de pago.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/v1/factura",
          "/api/v1/boleta",
          "/api/billing",
          "/api/v1/facturacion-2",
          "/api/v1/expense",
          "/api/v1/bank-account",
          "/api/v1/payment-method",
          "/api/v1/credit-card",
          "/api/v1/credits",
          "/api/v1/invoice",
          "/api/v1/supplier",
          "/api/v1/accounting-account",
          "/api/v1/recurring",
          "/api/accounts-payable/expenses",
          "/api/v1/descuentos",
          "/api/v1/billing/invoices",
          "/api/v1/billing/clients/",
          "/api/v1/billing/groups/",
          "/api/v1/payments",
          "/api/v1/webhooks/mercadopago",
          "/api/v1/dte",
          "/api/v1/sii-company",
          "/api/v1/analytics",
          "/api/analytics/graphics",
        ]),
    },
    {
      filename: "diagnostics.json",
      title: "Raul API - Diagnostico",
      description: "Health, consumo, conectividad, SIMs, webhooks fallidos y estados tecnicos.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/health",
          "/api/v1/consumption",
          "/api/v1/sim",
          "/api/v1/catalog/chips",
          "/api/v1/chip-catalog",
          "/api/v1/emnify",
          "/api/omnichannel/failed-webhooks",
          "/api/billing/health",
          "/api/v1/atlas",
          "/api/v1/flespi",
        ]),
    },
    {
      filename: "settings.json",
      title: "Raul API - Configuraciones",
      description: "Catalogos, tipos, plantillas y configuraciones maestras del sistema.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/v1/rubro",
          "/api/v1/city",
          "/api/v1/type_of_contract",
          "/api/v1/cargo",
          "/api/v1/communication",
          "/api/v1/client_lifecycle",
          "/api/v1/billing/config",
          "/api/notification-config",
          "/api/v1/catalogs",
        ]),
    },
    {
      filename: "platform.json",
      title: "Raul API - Plataforma",
      description: "Portal cliente, templates, RRHH, notificaciones y automatizaciones internas.",
      match: (routePath) =>
        matchesAnyPrefix(routePath, [
          "/api/hr",
          "/api/templates",
          "/api/notifications",
          "/api/portal",
          "/api/ai-support",
          "/api/teams-bot",
          "/api/changelog",
        ]),
    },
  ];

  for (const domain of domains) {
    const matchingEntries = Object.entries(document.paths).filter(([routePath]) => domain.match(routePath));
    for (const [routePath] of matchingEntries) {
      coveredPaths.add(routePath);
    }

    const filteredPaths = Object.fromEntries(matchingEntries);

    if (Object.keys(filteredPaths).length === 0) {
      continue;
    }

    const usedTags = new Set();
    for (const pathItem of Object.values(filteredPaths)) {
      for (const operation of Object.values(pathItem)) {
        if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
          continue;
        }

        for (const tag of operation.tags ?? []) {
          usedTags.add(tag);
        }
      }
    }

    const nextSpec = {
      ...document,
      info: {
        ...document.info,
        title: domain.title,
        description: domain.description,
      },
      tags: (document.tags ?? []).filter((tag) => usedTags.has(tag.name)),
      paths: filteredPaths,
    };

    if (Array.isArray(document["x-tagGroups"])) {
      nextSpec["x-tagGroups"] = document["x-tagGroups"]
        .map((group) => ({
          ...group,
          tags: group.tags.filter((tag) => usedTags.has(tag)),
        }))
        .filter((group) => group.tags.length > 0);
    }

    await writeFile(
      path.join(specsDir, domain.filename),
      `${JSON.stringify(nextSpec, null, 2)}\n`,
      "utf8",
    );
  }

  const missingPaths = Object.keys(document.paths ?? {}).filter((routePath) => !coveredPaths.has(routePath));
  if (missingPaths.length > 0) {
    throw new Error(
      `OpenAPI paths not assigned to a Mintlify domain spec (${missingPaths.length}): ${missingPaths.slice(0, 20).join(", ")}`,
    );
  }
}

function matchesAnyPrefix(routePath, prefixes) {
  return prefixes.some((prefix) => routePath.startsWith(prefix));
}

function normalizeTags(document) {
  if (!Array.isArray(document.tags)) {
    return;
  }

  document.tags = document.tags
    .map((tag) => ({
      ...tag,
      description: tag.description || tagDescriptions[tag.name] || `${tag.name} endpoints.`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  document["x-tagGroups"] = [
    {
      name: "Access",
      tags: ["Auth"],
    },
    {
      name: "Operations",
      tags: ["Clients", "GPS", "Subscriptions", "Visits"],
    },
    {
      name: "Finance and Insights",
      tags: ["Billing", "Catalogs", "Analytics"],
    },
  ].filter((group) => group.tags.some((tagName) => document.tags.some((tag) => tag.name === tagName)));
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
