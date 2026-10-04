import * as s from "./stamps.mjs";

const KEY = "stamp-system-v1";
const $ = (id) => document.getElementById(id);

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.templates) && Array.isArray(d.entries)) return d;
  } catch {}
  return { templates: s.seedTemplates(), entries: [] };
}

let state = load();
let editingTemplate = null;
let editingEntry = null;

const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};
const stampBadge = (t) => {
  const b = el("span", { className: "stamp" }, `${t.icon} ${t.name}`);
  b.style.setProperty("--c", t.color);
  return b;
};
const fail = (fn) => {
  try { fn(); $("error").textContent = ""; } catch (e) { $("error").textContent = e.message; }
};
const filters = () => Object.fromEntries(new FormData($("filters")));

function download(name, text, type) {
  const a = el("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}

function renderTemplates() {
  const list = $("templates");
  list.replaceChildren();
  for (const t of state.templates) {
    const use = el("button", { className: "stamp", title: t.description || t.name }, `${t.icon} ${t.name}`);
    use.style.setProperty("--c", t.color);
    use.onclick = () => {
      const f = $("apply-form");
      f.templateId.value = t.id;
      if (t.defaultNote && !f.note.value) f.note.value = t.defaultNote;
      f.target.focus();
    };
    const edit = el("button", { className: "icon-btn", title: "Edit template" }, "✏️");
    edit.onclick = () => {
      editingTemplate = t.id;
      const f = $("template-form");
      for (const k of ["name", "icon", "color", "description", "defaultNote"]) f[k].value = t[k] || "";
      $("template-form-title").textContent = "✏️ Edit template";
      $("template-cancel").hidden = false;
      renderPreview();
    };
    const del = el("button", { className: "icon-btn", title: "Delete template" }, "🗑️");
    del.onclick = () => {
      if (!confirm(`Delete "${t.name}" and its applied stamps?`)) return;
      state = { ...state, ...s.deleteTemplate(state.templates, state.entries, t.id) };
      render();
    };
    list.append(el("li", {}, use, edit, del));
  }
  const options = state.templates.map((t) => el("option", { value: t.id }, `${t.icon} ${t.name}`));
  const sel = $("apply-form").templateId;
  const prev = sel.value;
  sel.replaceChildren(...options);
  if (state.templates.some((t) => t.id === prev)) sel.value = prev;
  const fsel = $("filters").templateId;
  const fprev = fsel.value;
  fsel.replaceChildren(el("option", { value: "" }, "All stamps"), ...options.map((o) => o.cloneNode(true)));
  fsel.value = state.templates.some((t) => t.id === fprev) ? fprev : "";
}

function renderPreview() {
  const f = $("template-form");
  $("preview").replaceChildren(stampBadge({ icon: f.icon.value || "🏷️", name: f.name.value || "Preview", color: f.color.value }));
}

function renderTimeline() {
  const list = $("timeline");
  list.replaceChildren();
  const byId = new Map(state.templates.map((t) => [t.id, t]));
  const found = s.filterEntries(state.entries, state.templates, { ...filters(), text: $("search").value });
  if (!found.length) list.append(el("li", { className: "meta" }, "No stamps yet."));
  for (const e of found) {
    const t = byId.get(e.templateId);
    const edit = el("button", { className: "icon-btn", title: "Edit entry" }, "✏️");
    edit.onclick = () => {
      editingEntry = e.id;
      const f = $("apply-form");
      f.templateId.value = e.templateId;
      f.target.value = e.target;
      f.note.value = e.note || "";
      f.evidenceUrls.value = e.evidenceUrls.join(", ");
      f.tags.value = e.tags.join(", ");
      $("apply-title").textContent = "Edit stamp";
      $("apply-cancel").hidden = false;
      f.target.focus();
    };
    const del = el("button", { className: "icon-btn", title: "Delete entry" }, "🗑️");
    del.onclick = () => {
      state = { ...state, entries: s.deleteEntry(state.entries, e.id) };
      render();
    };
    const li = el("li", { className: "entry" },
      el("header", {}, t ? stampBadge(t) : "Unknown", el("code", {}, e.target),
        el("span", { className: "spacer" }),
        el("time", { dateTime: e.createdAt }, new Date(e.createdAt).toLocaleString()), edit, del));
    if (e.note) li.append(el("p", {}, e.note));
    if (e.tags.length) li.append(el("div", {}, ...e.tags.map((g) => el("span", { className: "tag" }, `#${g}`))));
    for (const u of e.evidenceUrls) {
      const safe = /^https?:\/\//i.test(u);
      li.append(el("div", { className: "meta" }, "🔗 ", safe ? el("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, u) : u));
    }
    if (e.updatedAt !== e.createdAt) li.append(el("div", { className: "meta" }, `Updated ${new Date(e.updatedAt).toLocaleString()}`));
    list.append(li);
  }
}

function render() {
  save();
  renderTemplates();
  renderTimeline();
}

function resetTemplateForm() {
  editingTemplate = null;
  $("template-form").reset();
  $("template-form-title").textContent = "➕ New template";
  $("template-cancel").hidden = true;
  renderPreview();
}
function resetApplyForm() {
  editingEntry = null;
  const keep = $("apply-form").templateId.value;
  $("apply-form").reset();
  $("apply-form").templateId.value = keep;
  $("apply-title").textContent = "Quick apply";
  $("apply-cancel").hidden = true;
}

$("template-form").oninput = renderPreview;
$("template-cancel").onclick = resetTemplateForm;
$("apply-cancel").onclick = resetApplyForm;
$("template-form").onsubmit = (ev) => {
  ev.preventDefault();
  fail(() => {
    const f = Object.fromEntries(new FormData(ev.target));
    f.description = f.description.trim() || undefined;
    f.defaultNote = f.defaultNote.trim() || undefined;
    f.icon = f.icon.trim() || "🏷️";
    if (editingTemplate) state.templates = s.updateTemplate(state.templates, editingTemplate, f);
    else state.templates = s.createTemplate(state.templates, f).templates;
    resetTemplateForm();
    render();
  });
};
$("apply-form").onsubmit = (ev) => {
  ev.preventDefault();
  fail(() => {
    const f = Object.fromEntries(new FormData(ev.target));
    if (editingEntry) {
      state.entries = s.updateEntry(state.entries, editingEntry, {
        templateId: f.templateId, target: f.target, note: f.note.trim() || undefined,
        evidenceUrls: f.evidenceUrls, tags: f.tags,
      });
    } else {
      state.entries = s.applyStamp(state.entries, state.templates, f).entries;
    }
    resetApplyForm();
    render();
  });
};
$("filters").oninput = renderTimeline;
$("filters").onreset = () => setTimeout(renderTimeline);
$("search").oninput = renderTimeline;
$("export-md").onclick = () => download("stamp-log.md", s.exportMarkdown(state.entries, state.templates), "text/markdown");
$("export-json").onclick = () => download("stamp-log.json", s.exportJson(state.entries, state.templates), "application/json");

renderPreview();
render();
