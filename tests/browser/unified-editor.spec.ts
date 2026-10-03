import { expect, test, type Page } from "@playwright/test";

const original = "---\r\ncolor: sage\r\ncustom: keep\r\n---\r\n\r\n#   Heading\r\n\r\nFirst **bold** and [Reference][ref].\r\n\r\n- [ ] task one\r\n- [x] task two\r\n\r\n| Name | Value |\r\n| --- | ---: |\r\n| Note | 12 |\r\n\r\nInline $x^2$ and footnote[^1].\r\n\r\n$$\r\ny = mx + b\r\n$$\r\n\r\n```mermaid\r\ngraph TD\r\n  A-->B\r\n```\r\n\r\n[ref]: https://example.com\r\n\r\n[^1]: Definition\r\n\r\nLast line";
type Note = { id: string; title: string; content: string; folderId: null; revision: number; createdAt: string; updatedAt: string };
async function setup(page: Page) {
  const notes: Record<string, Note> = Object.fromEntries([['one', 'First note', original], ['two', 'Second note', '# Second\n\nUntouched second note']].map(([id, title, content]) => [id, { id, title, content, folderId: null, revision: 1, createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z' }]));
  const writes: Array<{ id: string; content: string }> = [];
  let attempts = 0;
  let failWrites = false;
  let conflict = false;
  await page.addInitScript(() => { localStorage.setItem('nota_lang', 'en'); });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { id: 'editor-test-user', name: 'Editor Test', email: 'test@example.invalid' } } });
    if (path === '/api/folders') return route.fulfill({ json: { folders: [] } });
    if (path === '/api/notes') return route.fulfill({ json: { notes: Object.values(notes), page: 0, hasMore: false } });
    const id = path.split('/')[3];
    if (notes[id]) {
      if (route.request().method() === 'PATCH') {
        attempts++;
        if (failWrites) return route.abort('failed');
        if (conflict) return route.fulfill({ status: 409, json: { error: 'Version conflict' } });
        const patch = route.request().postDataJSON() as { title?: string; content?: string; revision: number };
        if (patch.revision !== notes[id].revision) return route.fulfill({ status: 409, json: { error: 'Version conflict' } });
        notes[id] = { ...notes[id], ...patch, revision: notes[id].revision + 1 };
        writes.push({ id, content: notes[id].content });
      }
      return route.fulfill({ json: { note: notes[id] } });
    }
    return route.fulfill({ json: { enabled: false, connected: false } });
  });
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByText('First note', { exact: true }).click();
  await expect(page.locator('[data-editor="unified"]')).toBeVisible();
  await expect(page.locator('.cm-md-block table')).toBeVisible();
  return { notes, writes, get attempts() { return attempts; }, fail: () => { failWrites = true; }, recover: () => { failWrites = false; }, conflict: () => { conflict = true; }, resolveConflict: () => { conflict = false; } };
}
const source = (page: Page) => page.getByRole('button', { name: 'Markdown source', exact: true });
const content = (page: Page) => page.locator('.cm-content');

// Mock only HTTP boundaries; exercise the actual workspace, editor and draft store.
test('Live Preview renders complex blocks and switching views does not save or reset selection/history', async ({ page }) => {
  const { writes } = await setup(page);
  await expect(page.locator('.cm-md-widget .katex').first()).toBeVisible();
  await expect(page.locator('.cm-md-block svg').first()).toBeVisible();
  await expect(page.locator('.cm-md-inline-widget a[href="https://example.com"]')).toBeVisible();
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' ไทย');
  await expect.poll(() => writes.at(-1)?.content).toBe(original + ' ไทย');
  const beforeSwitch = writes.length;
  await source(page).click();
  await expect(content(page)).toContainText('custom: keep');
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  // Observe past the autosave delay to prove a view switch does not emit edits.
  await page.waitForTimeout(800);
  expect(writes.length).toBe(beforeSwitch);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => writes.at(-1)?.content ?? original).toBe(original);
  await page.screenshot({ path: 'test-results/unified-desktop.png', fullPage: true });
});

test('clicking table reveals its complete source and checklist edits one original byte', async ({ page }) => {
  const { writes } = await setup(page);
  await page.locator('.cm-md-task').first().check();
  await expect.poll(() => writes.at(-1)?.content).toBe(original.replace('- [ ] task one', '- [x] task one'));
  await page.locator('.cm-md-block table').click();
  await expect(page.locator('.cm-line').filter({ hasText: '| --- | ---: |' })).toBeVisible();
  await content(page).press('ControlOrMeta+End');
  await expect(page.locator('.cm-md-block table')).toBeVisible();
});

test('changing language updates preview widgets without editing the draft', async ({ page }) => {
  const { writes } = await setup(page);
  await expect(page.locator('.cm-md-task').first()).toHaveAttribute('aria-label', 'Task completed');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.cm-md-task').first()).toHaveAttribute('aria-label', 'ทำรายการเสร็จแล้ว');
  await expect(content(page)).toHaveAttribute('aria-label', 'เนื้อหาโน้ต');
  await expect(page.getByRole('button', { name: 'ต้นฉบับ Markdown', exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  expect(writes).toHaveLength(0);
});

test('toolbar formatting, rich paste, plain paste and find operate on the same draft', async ({ page }) => {
  const { writes } = await setup(page);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' selected');
  for (let index = 0; index < 8; index++) await page.keyboard.press('Shift+ArrowLeft');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect.poll(() => writes.at(-1)?.content).toBe(original + ' **selected**');
  await content(page).evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/html', '<p><strong>Rich paste</strong></p>');
    data.setData('text/plain', 'Rich paste');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect.poll(() => writes.at(-1)?.content).toContain('**Rich paste**');
  await page.keyboard.press('ArrowRight');
  const beforePlainPaste = writes.at(-1)!.content;
  await content(page).dispatchEvent('keydown', { key: 'v', ctrlKey: true, shiftKey: true });
  await content(page).evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/html', '<strong>Plain paste</strong>');
    data.setData('text/plain', 'Plain paste');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect.poll(() => writes.at(-1)?.content).toContain('Plain paste');
  expect(writes.at(-1)?.content.replace('Plain paste', '')).toBe(beforePlainPaste);
  await page.getByRole('button', { name: /Find in note/ }).click();
  await expect(page.locator('.cm-search input[name="search"]')).toBeVisible();
  await page.locator('.cm-search input[name="search"]').pressSequentially('Heading');
  await page.locator('.cm-search input[name="search"]').press('Enter');
  await expect(page.locator('.cm-searchMatch-selected')).toBeVisible();
});

test('rapid note switching saves to the correct note and reopens in Live Preview', async ({ page }) => {
  const { notes } = await setup(page);
  await source(page).click();
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' first edit');
  await page.getByText('Second note', { exact: true }).click();
  await expect(source(page)).toBeVisible();
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' second edit');
  await expect.poll(() => notes.one.content).toBe(original + ' first edit');
  await expect.poll(() => notes.two.content).toBe('# Second\n\nUntouched second note second edit');
});

test('failed saves survive reload as a draft and retry when back online', async ({ page }) => {
  const controls = await setup(page);
  controls.fail();
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' local recovery');
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText('First note', { exact: true }).click();
  await expect(content(page)).toContainText('local recovery');
  controls.recover();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => controls.notes.one.content).toBe(original + ' local recovery');
});

test('mobile keeps one editing surface and supports Thai composition events', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await content(page).dispatchEvent('compositionstart', { data: '' });
  await page.keyboard.insertText(' ภาษาไทย');
  await content(page).dispatchEvent('compositionend', { data: ' ภาษาไทย' });
  await expect(content(page)).toContainText('ภาษาไทย');
  await expect(page.locator('[data-editor="unified"]')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/unified-mobile.png', fullPage: true });
});

test('a revision conflict blocks autosave until the user selects their local draft', async ({ page }) => {
  const controls = await setup(page);
  controls.notes.one = { ...controls.notes.one, content: original + ' remote edit', revision: 2 };
  controls.conflict();
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' local conflict');
  await expect(page.getByRole('alert').filter({ hasText: 'You have an unsaved draft' })).toBeVisible();
  const attempts = controls.attempts;
  // The conflict must suppress the next scheduled autosave.
  await page.waitForTimeout(800);
  expect(controls.attempts).toBe(attempts);
  controls.resolveConflict();
  await page.getByRole('button', { name: 'Use selected draft', exact: true }).click();
  await expect.poll(() => controls.notes.one.content).toBe(original + ' local conflict');
  expect(controls.notes.one.revision).toBe(3);
});

test('long notes render only visible preview widgets and keep editing at the end', async ({ page }) => {
  const controls = await setup(page);
  const longNote = '# Long note\n\n' + Array.from({ length: 500 }, (_, index) => `## Section ${index}\n\nParagraph **${index}**\n\n| A | B |\n| --- | --- |\n| ${index} | value |\n\n`).join('');
  controls.notes.one = { ...controls.notes.one, content: longNote };
  await page.reload();
  await page.getByText('First note', { exact: true }).click();
  await expect(content(page)).toBeVisible();
  expect(await page.locator('.cm-md-block').count()).toBeLessThan(100);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('end edit');
  await expect.poll(() => controls.notes.one.content).toBe(longNote + 'end edit');
  expect(await page.locator('.cm-md-block').count()).toBeLessThan(100);
});

test('voice text and diagram wizard insert at the current selection and can be undone', async ({ page }) => {
  await page.addInitScript(() => {
    type SpeechResult = { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> };
    class TestSpeechRecognition {
      continuous = true;
      interimResults = true;
      lang = 'en-US';
      onresult: ((event: SpeechResult) => void) | null = null;
      onend: (() => void) | null = null;
      start() { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'voice_text' } }] }); }
      stop() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: TestSpeechRecognition });
  });
  const { writes } = await setup(page);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.getByRole('button', { name: 'Voice input', exact: true }).click();
  await expect.poll(() => writes.at(-1)?.content).toBe(original + 'voice\\_text');
  await content(page).press('ControlOrMeta+z');
  await expect.poll(() => writes.at(-1)?.content).toBe(original);
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  await page.getByRole('button', { name: 'Insert into note', exact: true }).click();
  await expect.poll(() => writes.at(-1)?.content.match(/```mermaid/g)?.length).toBe(2);
  await content(page).press('ControlOrMeta+z');
  await expect.poll(() => writes.at(-1)?.content).toBe(original);
});
