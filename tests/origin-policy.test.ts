import assert from "node:assert/strict";
import test from "node:test";
import { rejectCrossOrigin } from "../src/lib/security";

test("production accepts its Vercel project domain even if canonical metadata URL differs", () => {
  const previous = {
    canonical: process.env.NEXT_PUBLIC_APP_URL,
    production: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    deployment: process.env.VERCEL_URL,
    vercelEnv: process.env.VERCEL_ENV,
    allowed: process.env.APP_ALLOWED_ORIGINS,
  };
  try {
    process.env.NEXT_PUBLIC_APP_URL = "https://old.example";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "notemd-psi.vercel.app";
    process.env.VERCEL_URL = "note-random.vercel.app";
    process.env.VERCEL_ENV = "production";
    delete process.env.APP_ALLOWED_ORIGINS;
    const valid = new Request("https://notemd-psi.vercel.app/api/auth/login", {
      method: "POST", headers: { Origin: "https://notemd-psi.vercel.app" },
    });
    assert.equal(rejectCrossOrigin(valid), null);
    const evil = new Request("https://evil.example/api/auth/login", {
      method: "POST", headers: { Origin: "https://evil.example" },
    });
    assert.equal(rejectCrossOrigin(evil)?.status, 403);
    const crossOrigin = new Request("https://notemd-psi.vercel.app/api/auth/login", {
      method: "POST", headers: { Origin: "https://old.example" },
    });
    assert.equal(rejectCrossOrigin(crossOrigin)?.status, 403);
    const canonicalOnly = new Request("https://old.example/api/auth/login", {
      method: "POST", headers: { Origin: "https://old.example" },
    });
    assert.equal(rejectCrossOrigin(canonicalOnly)?.status, 403);
    process.env.APP_ALLOWED_ORIGINS = "https://custom.example";
    const custom = new Request("https://custom.example/api/auth/login", {
      method: "POST", headers: { Origin: "https://custom.example" },
    });
    assert.equal(rejectCrossOrigin(custom), null);
  } finally {
    if (previous.canonical === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous.canonical;
    if (previous.production === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = previous.production;
    if (previous.deployment === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = previous.deployment;
    if (previous.vercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.vercelEnv;
    if (previous.allowed === undefined) delete process.env.APP_ALLOWED_ORIGINS; else process.env.APP_ALLOWED_ORIGINS = previous.allowed;
  }
});

test("production handles reverse proxy x-forwarded headers correctly", () => {
  const previous = {
    production: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelEnv: process.env.VERCEL_ENV,
  };
  try {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "notemd-psi.vercel.app";
    process.env.VERCEL_ENV = "production";

    // Vercel reverse proxy sends http://localhost:3000 or http://... internally with x-forwarded-* headers
    const proxyValid = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://notemd-psi.vercel.app",
        "x-forwarded-host": "notemd-psi.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(rejectCrossOrigin(proxyValid), null);

    // Proxy request with evil origin is rejected
    const proxyEvil = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "x-forwarded-host": "notemd-psi.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(rejectCrossOrigin(proxyEvil)?.status, 403);

    // Fallback to referer when origin header is missing
    const refererValid = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        Referer: "https://notemd-psi.vercel.app/notes",
        "x-forwarded-host": "notemd-psi.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(rejectCrossOrigin(refererValid), null);

    // Insecure HTTP origin is rejected in production
    const insecureHttp = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "http://notemd-psi.vercel.app",
        "x-forwarded-host": "notemd-psi.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(rejectCrossOrigin(insecureHttp)?.status, 403);
  } finally {
    if (previous.production === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = previous.production;
    if (previous.vercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.vercelEnv;
  }
});

test("accepts NEXT_PUBLIC_APP_URL when VERCEL_PROJECT_PRODUCTION_URL is unset", () => {
  const previous = {
    canonical: process.env.NEXT_PUBLIC_APP_URL,
    production: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelEnv: process.env.VERCEL_ENV,
    allowed: process.env.APP_ALLOWED_ORIGINS,
  };
  try {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.APP_ALLOWED_ORIGINS;
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://data-aipredict.vercel.app";

    const valid = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://data-aipredict.vercel.app",
        "x-forwarded-host": "data-aipredict.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(rejectCrossOrigin(valid), null);
  } finally {
    if (previous.canonical === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous.canonical;
    if (previous.production === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = previous.production;
    if (previous.vercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.vercelEnv;
    if (previous.allowed === undefined) delete process.env.APP_ALLOWED_ORIGINS; else process.env.APP_ALLOWED_ORIGINS = previous.allowed;
  }
});

