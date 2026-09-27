import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEXT_SCALE, nextTextScale, parseTextScale, TEXT_SCALE_STEPS } from "../src/lib/textScale";

test("text scale accepts only the supported 100 to 200 percent steps", () => {
  assert.deepEqual(TEXT_SCALE_STEPS, [100, 125, 150, 175, 200]);
  assert.equal(parseTextScale("175"), 175);
  assert.equal(parseTextScale("150.5"), DEFAULT_TEXT_SCALE);
  assert.equal(parseTextScale("999"), DEFAULT_TEXT_SCALE);
  assert.equal(parseTextScale(null), DEFAULT_TEXT_SCALE);
});

test("text scale controls stop at the minimum and maximum", () => {
  assert.equal(nextTextScale(100, -1), 100);
  assert.equal(nextTextScale(100, 1), 125);
  assert.equal(nextTextScale(175, 1), 200);
  assert.equal(nextTextScale(200, 1), 200);
});
