import test from "node:test";
import assert from "node:assert/strict";
import * as s from "./stamps.mjs";

const setup = () => ({ templates: s.seedTemplates(), entries: [] });

test("seeds five templates", () => assert.equal(setup().templates.length, 5));

test("create, edit, delete template", () => {
  let { templates, entries } = setup();
  const r = s.createTemplate(templates, { name: "Shipped" });
  assert.equal(r.templates.length, 6);
  templates = s.updateTemplate(r.templates, r.template.id, { name: "Released" });
  assert.equal(templates.find((t) => t.id === r.template.id).name, "Released");
  assert.throws(() => s.createTemplate(templates, { name: " " }));
  ({ templates, entries } = s.deleteTemplate(templates, entries, r.template.id));
  assert.equal(templates.length, 5);
});

test("apply, edit, delete entry", () => {
  const { templates } = setup();
  let { entries, entry } = s.applyStamp([], templates, {
    templateId: templates[0].id, target: "README.md", tags: "a, b", evidenceUrls: "https://x.test",
  });
  assert.deepEqual(entry.tags, ["a", "b"]);
  entries = s.updateEntry(entries, entry.id, { note: "ok", tags: "c" });
  assert.deepEqual(entries[0].tags, ["c"]);
  assert.throws(() => s.applyStamp(entries, templates, { templateId: "x", target: "t" }));
  assert.throws(() => s.applyStamp(entries, templates, { templateId: templates[0].id, target: "" }));
  assert.equal(s.deleteEntry(entries, entry.id).length, 0);
});

test("filter entries", () => {
  const { templates } = setup();
  let entries = [];
  entries = s.applyStamp(entries, templates, { templateId: templates[0].id, target: "homepage", tags: "launch", createdAt: "2026-10-04T10:00:00Z" }).entries;
  entries = s.applyStamp(entries, templates, { templateId: templates[1].id, target: "bug", note: "urgent", createdAt: "2026-10-05T10:00:00Z" }).entries;
  const f = (x) => s.filterEntries(entries, templates, x).length;
  assert.equal(f({}), 2);
  assert.equal(f({ templateId: templates[0].id }), 1);
  assert.equal(f({ tag: "LAUNCH" }), 1);
  assert.equal(f({ target: "bug" }), 1);
  assert.equal(f({ from: "2026-10-05" }), 1);
  assert.equal(f({ to: "2026-10-04" }), 1);
  assert.equal(f({ text: "urgent" }), 1);
  assert.equal(f({ text: "needs review" }), 1);
});

test("markdown and json export", () => {
  const { templates } = setup();
  const { entries } = s.applyStamp([], templates, {
    templateId: templates[0].id, target: "homepage copy", note: "Ready to publish.",
    tags: "launch, copy", evidenceUrls: "https://example.com", createdAt: "2026-10-04T10:00:00Z",
  });
  assert.equal(s.exportMarkdown(entries, templates),
`# Stamp Log

## 2026-10-04

- **Approved** on \`homepage copy\`
  - Note: Ready to publish.
  - Tags: launch, copy
  - Evidence: https://example.com
`);
  assert.equal(JSON.parse(s.exportJson(entries, templates)).entries.length, 1);
});
