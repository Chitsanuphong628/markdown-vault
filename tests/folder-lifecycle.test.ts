import assert from "node:assert/strict";
import test from "node:test";
import { deleteEmptyFolder } from "../src/lib/folderLifecycle";

test("folder deletion reports a nonempty folder without deleting its contents", async () => {
  const result = await deleteEmptyFolder("owner-a", "folder-a", {
    rpc: async (_name, args) => {
      assert.deepEqual(args, { target_folder_id: "folder-a", target_user_id: "owner-a" });
      return { data: false, error: null };
    },
  });
  assert.equal(result.deleted, false);
});

test("folder deletion propagates storage failure instead of reporting success", async () => {
  await assert.rejects(() => deleteEmptyFolder("owner-a", "folder-a", {
    rpc: async () => ({ data: null, error: new Error("database unavailable") }),
  }), /database unavailable/);
});
