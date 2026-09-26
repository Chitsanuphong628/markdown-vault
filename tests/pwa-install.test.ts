import assert from "node:assert/strict";
import test from "node:test";
import { getPwaInstallAction, isIosLike, isPwaInstalled, isSafariOnMac } from "../src/lib/pwaInstall";

test("install UI selects prompt, manual guidance, and installed states", () => {
  assert.equal(getPwaInstallAction({ installed: true, hasPrompt: true }), "hidden");
  assert.equal(getPwaInstallAction({ installed: false, hasPrompt: true }), "prompt");
  assert.equal(getPwaInstallAction({ installed: false, hasPrompt: false }), "instructions");
});

test("standalone detection includes display mode and the iOS standalone flag", () => {
  assert.equal(isPwaInstalled(true, false), true);
  assert.equal(isPwaInstalled(false, true), true);
  assert.equal(isPwaInstalled(false, false), false);
});

test("iPadOS desktop user agents are recognized as iOS devices", () => {
  assert.equal(isIosLike("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5), true);
  assert.equal(isIosLike("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0), false);
  assert.equal(isIosLike("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", 1), true);
});

test("Safari on Mac gets its Add to Dock flow without misclassifying other browsers", () => {
  assert.equal(isSafariOnMac("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", 0), true);
  assert.equal(isSafariOnMac("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Chrome/120.0 Safari/605.1.15", 0), false);
  assert.equal(isSafariOnMac("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", 5), false);
});
