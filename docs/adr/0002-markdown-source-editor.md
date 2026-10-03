---
status: accepted
---

# One Markdown source editor for every note

## Context

Notes already persist as Markdown strings. Two editing implementations (Tiptap visual documents and a Markdown textarea) require conversion, compatibility gates, opaque placeholders and separate latest-draft handling. Whole-note features such as footnotes can behave differently when parsed per block. The product decision is one Live Preview editor, with direct source access and the existing storage/autosave model.

## Decision

Use CodeMirror 6 for both Live Preview and Markdown source views. Decorations change presentation; editing transactions change the single Markdown source. Preserve the original raw source and map normalized editor offsets to raw line endings. History carries position-mapped metadata for deleted line breaks and changed boundary spellings so undo restores original CRLF/mixed line endings without retaining full source snapshots; external updates remain outside undo history. If an edit joins a lone CR token directly to an LF token, spell the first as CRLF to preserve two logical newlines; undo restores its original CR spelling. View switches preserve selection/history and never emit a content change.

Reuse the Markdown reading renderer for preview widgets. Cache whole-note AST context (including definitions/footnotes), parse after document edits with a 150 ms debounce, and let CodeMirror mount visible widgets. Preserve unsupported syntax as editable source. Keep raw HTML inert and existing safe image/link policies.

Keep the HTTP content:string contract, draft ownership/revisions, local stash at 250 ms and server autosave at 700 ms. Open every note in Live Preview. Formatted paste converts supported HTML once at the input boundary; plain paste remains available.

## Consequences

Source preservation no longer depends on a rich-text serializer. We maintain selection-aware decorations and widgets, including mapping after edits and proper widget disposal. Full context parsing and serializing the raw string are O(n) after document changes; cursor movement does not parse or reconstruct source. CodeMirror, its parser and browser interaction tests replace Tiptap dependencies and serializer tests.

This decision concerns the editor. Local filesystem vaults, backlinks and sync are separate product decisions.
