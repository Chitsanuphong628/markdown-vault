import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../src/app/manifest";

test("PWA manifest requests a standalone Nota app with Android icon sizes", () => {
  const appManifest = manifest();
  assert.equal(appManifest.name, "Nota");
  assert.equal(appManifest.short_name, "Nota");
  assert.equal(appManifest.start_url, "/");
  assert.equal(appManifest.display, "standalone");
  assert.equal(appManifest.background_color, "#090a0f");
  assert.equal(appManifest.theme_color, "#090a0f");
  assert.deepEqual(
    appManifest.icons?.map(icon => icon.sizes),
    ["192x192", "512x512"],
  );
  assert.ok(appManifest.icons?.every(icon => icon.src.startsWith("/")));
});
