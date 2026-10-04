// Pure helpers for the stamp system: models, CRUD, filtering, export.

export const DEFAULT_TEMPLATES = [
  { name: "Approved", color: "#2e7d32", icon: "✅", description: "Reviewed and accepted." },
  { name: "Needs Review", color: "#f9a825", icon: "👀", description: "Waiting on a reviewer." },
  { name: "Blocked", color: "#c62828", icon: "⛔", description: "Cannot proceed.", defaultNote: "Blocked by: " },
  { name: "Verified", color: "#1565c0", icon: "🔎", description: "Checked with evidence." },
  { name: "Decision", color: "#6a1b9a", icon: "⚖️", description: "A decision was made." },
];

let counter = 0;
export function newId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const now = () => new Date().toISOString();

export function splitList(value) {
  if (Array.isArray(value)) value = value.join(",");
  return String(value || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function seedTemplates() {
  const t = now();
  return DEFAULT_TEMPLATES.map((d) => ({ id: newId(), createdAt: t, updatedAt: t, ...d }));
}

export function createTemplate(templates, fields) {
  const name = String(fields.name || "").trim();
  if (!name) throw new Error("Template name is required");
  const t = now();
  const template = {
    id: newId(),
    name,
    color: fields.color || "#546e7a",
    icon: fields.icon || "🏷️",
    description: fields.description || undefined,
    defaultNote: fields.defaultNote || undefined,
    createdAt: t,
    updatedAt: t,
  };
  return { templates: [...templates, template], template };
}

export function updateTemplate(templates, id, fields) {
  return templates.map((t) => {
    if (t.id !== id) return t;
    const name = fields.name === undefined ? t.name : String(fields.name).trim();
    if (!name) throw new Error("Template name is required");
    return { ...t, ...fields, name, updatedAt: now() };
  });
}

// Deleting a template also removes entries that use it.
export function deleteTemplate(templates, entries, id) {
  return {
    templates: templates.filter((t) => t.id !== id),
    entries: entries.filter((e) => e.templateId !== id),
  };
}

export function applyStamp(entries, templates, fields) {
  const target = String(fields.target || "").trim();
  if (!target) throw new Error("Target is required");
  if (!templates.some((t) => t.id === fields.templateId)) throw new Error("Unknown template");
  const t = fields.createdAt || now();
  const entry = {
    id: newId(),
    templateId: fields.templateId,
    target,
    note: fields.note ? String(fields.note).trim() || undefined : undefined,
    evidenceUrls: splitList(fields.evidenceUrls),
    tags: splitList(fields.tags),
    createdAt: t,
    updatedAt: t,
  };
  return { entries: [entry, ...entries], entry };
}

export function updateEntry(entries, id, fields) {
  return entries.map((e) => {
    if (e.id !== id) return e;
    const next = { ...e, ...fields, updatedAt: now() };
    if ("evidenceUrls" in fields) next.evidenceUrls = splitList(fields.evidenceUrls);
    if ("tags" in fields) next.tags = splitList(fields.tags);
    if (!String(next.target || "").trim()) throw new Error("Target is required");
    return next;
  });
}

export function deleteEntry(entries, id) {
  return entries.filter((e) => e.id !== id);
}

// filters: { text, templateId, tag, target, from, to } (dates as YYYY-MM-DD)
export function filterEntries(entries, templates, filters = {}) {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const text = (filters.text || "").trim().toLowerCase();
  const target = (filters.target || "").trim().toLowerCase();
  const tag = (filters.tag || "").trim().toLowerCase();
  return entries
    .filter((e) => {
      const tpl = byId.get(e.templateId);
      const day = e.createdAt.slice(0, 10);
      if (filters.templateId && e.templateId !== filters.templateId) return false;
      if (tag && !e.tags.some((t) => t.toLowerCase() === tag)) return false;
      if (target && !e.target.toLowerCase().includes(target)) return false;
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (text) {
        const hay = [tpl && tpl.name, e.target, e.note, ...e.tags, ...e.evidenceUrls]
          .filter(Boolean)
          .join("\n")
          .toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function exportMarkdown(entries, templates) {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lines = ["# Stamp Log"];
  let day = null;
  for (const e of sorted) {
    const d = e.createdAt.slice(0, 10);
    if (d !== day) {
      day = d;
      lines.push("", `## ${d}`, "");
    }
    const tpl = byId.get(e.templateId);
    lines.push(`- **${tpl ? tpl.name : "Unknown"}** on \`${e.target}\``);
    if (e.note) lines.push(`  - Note: ${e.note}`);
    if (e.tags.length) lines.push(`  - Tags: ${e.tags.join(", ")}`);
    if (e.evidenceUrls.length) lines.push(`  - Evidence: ${e.evidenceUrls.join(", ")}`);
  }
  return lines.join("\n") + "\n";
}

export function exportJson(entries, templates) {
  return JSON.stringify({ templates, entries }, null, 2);
}
