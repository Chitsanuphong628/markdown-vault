import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { type Components } from "react-markdown";
import { GfmAlertBlockquote, GfmAlertCard, GfmAlertMarkdownBlockquote } from "../src/components/GfmAlertCard";

test("renders GFM alerts with a readable label and formatted body", () => {
  const markup = renderToStaticMarkup(createElement(GfmAlertCard, {
    type: "WARNING",
    body: "Keep **important** details visible.\n\nA second paragraph.",
    lang: "en",
  }));

  assert.match(markup, /<aside[^>]*aria-label="Warning"/);
  assert.match(markup, />Warning</);
  assert.match(markup, /<strong>important<\/strong>/);
  assert.match(markup, /A second paragraph\./);
  assert.doesNotMatch(markup, /\[!WARNING\]/);
});

test("uses a Thai label when the interface language is Thai", () => {
  const markup = renderToStaticMarkup(createElement(GfmAlertCard, {
    type: "NOTE",
    body: "ข้อความประกอบ",
    lang: "th",
  }));

  assert.match(markup, /aria-label="หมายเหตุ"/);
  assert.match(markup, />หมายเหตุ</);
});

test("renders an alert blockquote as a callout and leaves ordinary quotes unchanged", () => {
  const alert = renderToStaticMarkup(createElement(GfmAlertBlockquote, {
    source: "> [!TIP]\n> Use the note editor.",
    uiLanguage: "en",
  }, createElement("p", null, "Marker source")));
  const quote = renderToStaticMarkup(createElement(GfmAlertBlockquote, {
    source: "> A regular quote.",
    uiLanguage: "en",
    className: "note-quote",
  }, createElement("p", null, "A regular quote.")));

  assert.match(alert, /aria-label="Tip"/);
  assert.match(alert, /Use the note editor\./);
  assert.doesNotMatch(alert, /Marker source/);
  assert.match(quote, /<blockquote class="note-quote"><p>A regular quote\.<\/p><\/blockquote>/);
});

test("uses Markdown source positions to render an alert blockquote", () => {
  const markdown = "Before.\n\n> [!IMPORTANT]\n> Keep **the source**.\n\nAfter.";
  const start = markdown.indexOf("> [!IMPORTANT]");
  const end = markdown.indexOf("\n\nAfter.");
  const markup = renderToStaticMarkup(createElement(GfmAlertMarkdownBlockquote, {
    markdown,
    markdownNode: { position: { start: { offset: start }, end: { offset: end } } },
    uiLanguage: "en",
  }, createElement("p", null, "Marker source")));

  assert.match(markup, /aria-label="Important"/);
  assert.match(markup, /<strong>the source<\/strong>/);
  assert.doesNotMatch(markup, /Marker source/);
});

test("renders GitHub alert syntax through the Markdown reading pipeline", () => {
  const markdown = "Before.\n\n> [!WARNING]\n> Keep **important** details visible.\n\nAfter.";
  const components: Components = {
    blockquote: ({ node, children, ...props }) => createElement(
      GfmAlertMarkdownBlockquote,
      { markdown, markdownNode: node, uiLanguage: "en", ...props },
      children,
    ),
  };
  const markup = renderToStaticMarkup(createElement(ReactMarkdown, { components }, markdown));

  assert.match(markup, /<p>Before\.<\/p>/);
  assert.match(markup, /aria-label="Warning"/);
  assert.match(markup, /<strong>important<\/strong>/);
  assert.match(markup, /<p>After\.<\/p>/);
  assert.doesNotMatch(markup, /\[!WARNING\]/);
});
