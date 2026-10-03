import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sidebar from "../src/modules/notes/client/components/Sidebar";

test("the sidebar hides child folders until their parent is opened without an inline move form", () => {
  const noop = async () => {};
  const html = renderToStaticMarkup(createElement(Sidebar, {
    user: { id: "user", name: "Test", email: "test@example.com" },
    folders: [
      { id: "parent", name: "Parent", parentId: null },
      { id: "child", name: "Child", parentId: "parent" },
    ],
    notes: [],
    activeNoteId: null,
    selectedFolderId: null,
    lang: "en",
    setLang: () => {},
    onSelectNote: () => {},
    onSelectFolder: () => {},
    onOpenUpload: () => {},
    onCreateFolder: noop,
    onDeleteFolder: noop,
    onCreateNote: noop,
    onDeleteNote: noop,
    onMoveFolder: async () => true,
    onLogout: () => {},
    searchQuery: "",
    setSearchQuery: () => {},
    hasMoreNotes: false,
    isLoadingMoreNotes: false,
    onLoadMoreNotes: noop,
  }));
  assert.match(html, />Parent</);
  assert.doesNotMatch(html, />Child</);
  assert.doesNotMatch(html, /Move folder|Move to|move-folder-/);
  assert.match(html, /draggable="true"/);
});
