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
