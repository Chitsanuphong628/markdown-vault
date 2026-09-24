import assert from "node:assert/strict";
import test from "node:test";
import { importFiles, isSupportedFile } from "../src/lib/dataIngest";

test("import keeps a file in the failed list when the note endpoint rejects it", async () => {
  const file = new File(["# Meeting"], "meeting.md", { type: "text/markdown" });
  const result = await importFiles([file], null, async () => Response.json({ error: "Forbidden" }, { status: 403 }));
  assert.deepEqual(result.imported, []);
  assert.equal(result.failed[0]?.file, file);
  assert.match(result.failed[0]?.error ?? "", /Forbidden/);
});

test("import accepts supported markdown and rejects unsupported extensions", async () => {
  const file = new File(["# Meeting"], "meeting.md", { type: "text/markdown" });
  assert.equal(isSupportedFile(file), true);
  assert.equal(isSupportedFile(new File(["x"], "malware.exe")), false);
  assert.equal(isSupportedFile(new File(["# text"], "untitled", { type: "text/markdown" })), true);
  const result = await importFiles([file], null, async (_input, init) => {
    assert.match(String(init?.body), /# Meeting/);
    return Response.json({ note: { id: "note-a" } }, { status: 201 });
  });
  assert.deepEqual(result.imported, [file]);
  assert.deepEqual(result.failed, []);
});

test("invalid JSON stays available for correction and is not saved as a note", async () => {
  const file = new File(["{broken"], "broken.json", { type: "application/json" });
  const result = await importFiles([file], null, async () => {
    throw new Error("should not send an invalid file");
  });
  assert.deepEqual(result.imported, []);
  assert.match(result.failed[0]?.error ?? "", /Invalid JSON/);
});

test("extensionless CSV uses its MIME type for conversion", async () => {
  const file = new File(["name,score\nAda,10"], "upload", { type: "text/csv" });
  const result = await importFiles([file], null, async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.match(body.content, /Data Profile Summary/);
    assert.match(body.content, /Ada/);
    return Response.json({ note: { id: "note-csv" } }, { status: 201 });
  });
  assert.deepEqual(result.imported, [file]);
  assert.deepEqual(result.failed, []);
});

test("import does not report success for an empty success response", async () => {
  const file = new File(["# Meeting"], "meeting.md");
  const result = await importFiles([file], null, async () => Response.json({}, { status: 200 }));
  assert.deepEqual(result.imported, []);
  assert.equal(result.failed[0]?.file, file);
});
