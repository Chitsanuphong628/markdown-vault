import path from "node:path";

function normalized(value) {
  return value.replaceAll(path.sep, "/");
}

function moduleLocation(filename) {
  const match = normalized(filename).match(/(?:^|\/)src\/modules\/([^/]+)(?:\/(.*))?$/);
  return match ? { name: match[1], innerPath: match[2] || "" } : null;
}

function importedTarget(filename, source) {
  const alias = source.match(/^@\/modules\/([^/]+)(?:\/(.*))?$/);
  if (alias) return { kind: "module", name: alias[1], innerPath: alias[2] || "", public: true };

  const platform = source.match(/^@\/platform(?:\/(.*))?$/);
  if (platform) return { kind: "platform", innerPath: platform[1] || "" };

  if (!source.startsWith(".")) return null;
  const resolved = path.resolve(path.dirname(filename), source);
  const location = moduleLocation(resolved);
  if (location) return { kind: "module", ...location, public: false };
  const normalizedResolved = normalized(resolved);
  const platformMatch = normalizedResolved.match(/(?:^|\/)src\/platform(?:\/(.*))?$/);
  if (platformMatch) return { kind: "platform", innerPath: platformMatch[1] || "" };
  return null;
}

function isClientPath(innerPath) {
  return innerPath === "client" || innerPath === "client.ts" || innerPath.startsWith("client/");
}

function isServerPath(innerPath) {
  return innerPath === "server" || innerPath === "server.ts" || innerPath.startsWith("server/");
}

const tableOwners = new Map([
  ["User", "identity"],
  ["Note", "notes"],
  ["Folder", "notes"],
  ["McpCredential", "mcp"],
  ["McpOAuthClient", "mcp"],
  ["McpOAuthCode", "mcp"],
]);

// Cross-module dependencies are intentional and reviewed as part of the
// architecture contract. Use the narrowest public entrypoint for each edge.
const moduleDependencies = {
  identity: {},
  notes: {
    "app-shell": ["client", "shared"],
    content: ["client", "shared"],
  },
  content: {
    "app-shell": ["client", "shared"],
  },
  mcp: {
    identity: ["server"],
    notes: ["server"],
  },
  "app-shell": {
    mcp: ["client"],
    identity: ["client"],
  },
};

export const moduleBoundaryPlugin = {
  rules: {
    imports: {
      meta: {
        type: "problem",
        docs: { description: "Keep module imports on public entrypoints and persistence inside its owner" },
        schema: [],
        messages: {
          privateImport: "Import {{target}} through its public client, server, or shared entrypoint.",
          moduleDependency: "{{importer}} cannot depend on {{target}} through this entrypoint; update the documented module dependency contract before adding this edge.",
          clientServerImport: "Client code cannot import server-only module code.",
          serverClientImport: "Server code cannot import client module code.",
          clientPlatformImport: "Client code cannot import platform server adapters.",
          platformFeatureImport: "Platform adapters cannot depend on feature modules.",
          tableOwner: "The {{table}} table is owned by the {{owner}} module.",
          platformEntrypoint: "Import platform code through @/platform/server.",
        },
      },
      create(context) {
        const filename = context.filename || context.getFilename();
        const importer = moduleLocation(filename);
        const normalizedFilename = normalized(filename);
        const isAppSource = /(?:^|\/)src\/app\//.test(normalizedFilename);
        const isPlatformSource = /(?:^|\/)src\/platform\//.test(normalizedFilename);
        let hasUseClientDirective = false;
        const isClientModule = Boolean(importer && isClientPath(importer.innerPath));
        const isServerModule = Boolean(importer && isServerPath(importer.innerPath));

        function isClientSource() {
          return isClientModule || hasUseClientDirective;
        }

        function checkImport(node) {
          const source = node.source.value;
          if (typeof source !== "string") return;
          const target = importedTarget(filename, source);
          if (!target) return;

          if (isPlatformSource && target.kind === "module") {
            context.report({ node, messageId: "platformFeatureImport" });
            return;
          }

          if (target.kind === "platform") {
            if (isPlatformSource) return;
            if (target.innerPath !== "server") {
              context.report({ node, messageId: "platformEntrypoint" });
            }
            if (isClientSource()) context.report({ node, messageId: "clientPlatformImport" });
            return;
          }

          if (isClientSource() && isServerPath(target.innerPath)) {
            context.report({ node, messageId: "clientServerImport" });
          }
          if (isServerModule && isClientPath(target.innerPath)) {
            context.report({ node, messageId: "serverClientImport" });
          }

          if (importer?.name === target.name) return;
          if (isAppSource || importer) {
            if (!["client", "server", "shared"].includes(target.innerPath)) {
              context.report({
                node,
                messageId: "privateImport",
                data: { target: target.name },
              });
            }
            if (importer) {
              const allowedEntrypoints = moduleDependencies[importer.name]?.[target.name] ?? [];
              if (!allowedEntrypoints.includes(target.innerPath)) {
                context.report({
                  node,
                  messageId: "moduleDependency",
                  data: { importer: importer.name, target: target.name },
                });
              }
            }
          }
        }

        return {
          Program(node) {
            hasUseClientDirective = node.body.some(statement =>
              statement.type === "ExpressionStatement" &&
              statement.expression.type === "Literal" &&
              statement.expression.value === "use client"
            );
          },
          ImportDeclaration: checkImport,
          ExportNamedDeclaration(node) {
            if (node.source) checkImport(node);
          },
          ExportAllDeclaration: checkImport,
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== "MemberExpression" || callee.computed) return;
            if (callee.property.type !== "Identifier" || callee.property.name !== "from") return;
            const firstArg = node.arguments[0];
            if (!firstArg || firstArg.type !== "Literal" || typeof firstArg.value !== "string") return;
            const owner = tableOwners.get(firstArg.value);
            if (owner && importer?.name !== owner) {
              context.report({ node, messageId: "tableOwner", data: { table: firstArg.value, owner } });
            }
          },
        };
      },
    },
  },
};
