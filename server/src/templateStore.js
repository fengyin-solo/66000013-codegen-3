const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
const DRAFTS_FILE = path.join(DATA_DIR, 'template-drafts.json');
const PUBLISHED_FILE = path.join(DATA_DIR, 'published-templates.json');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const readJson = (file) => {
  ensureDataDir();
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`[TemplateStore] Error reading ${file}:`, error);
    return [];
  }
};

const writeJson = (file, data) => {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

const readDrafts = () => readJson(DRAFTS_FILE);
const writeDrafts = (drafts) => writeJson(DRAFTS_FILE, drafts);
const readPublished = () => readJson(PUBLISHED_FILE);
const writePublished = (templates) => writeJson(PUBLISHED_FILE, templates);

// Fields that must be filled before a draft can be published
const REQUIRED_PUBLISH_FIELDS = [
  { key: 'name', label: '模板名称' },
  { key: 'scenario', label: '适用场景' },
  { key: 'icon', label: '图标' },
  { key: 'preview', label: '预览' },
];

const getMissingFields = (draft) => {
  return REQUIRED_PUBLISH_FIELDS.filter(({ key }) => {
    const value = draft[key];
    return typeof value !== 'string' || value.trim() === '';
  });
};

const TemplateDraftStore = {
  list(ownerId) {
    const drafts = readDrafts();
    const result = ownerId ? drafts.filter((d) => d.ownerId === ownerId) : drafts;
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getById(id) {
    return readDrafts().find((d) => d._id === id) || null;
  },

  create({ name, ownerId, sourceBoardId, snapshot }) {
    const now = new Date().toISOString();
    const version = {
      versionId: uuidv4(),
      versionNumber: 1,
      note: '初始版本',
      snapshot,
      createdAt: now,
    };
    const draft = {
      _id: uuidv4(),
      name: name || '',
      ownerId,
      sourceBoardId,
      status: 'draft',
      scenario: '',
      icon: '',
      preview: '',
      category: 'custom',
      versions: [version],
      currentVersionId: version.versionId,
      createdAt: now,
      updatedAt: now,
    };
    const drafts = readDrafts();
    drafts.unshift(draft);
    writeDrafts(drafts);
    console.log(`[TemplateStore] Created draft: ${draft._id}, name: ${draft.name}`);
    return draft;
  },

  update(id, updates) {
    const drafts = readDrafts();
    const index = drafts.findIndex((d) => d._id === id);
    if (index < 0) return null;

    const draft = drafts[index];
    for (const key of ['name', 'scenario', 'icon', 'preview', 'category']) {
      if (updates[key] !== undefined) {
        draft[key] = updates[key];
      }
    }
    draft.updatedAt = new Date().toISOString();
    drafts[index] = draft;
    writeDrafts(drafts);
    console.log(`[TemplateStore] Updated draft: ${id}`);
    return draft;
  },

  addVersion(id, { snapshot, note }) {
    const drafts = readDrafts();
    const index = drafts.findIndex((d) => d._id === id);
    if (index < 0) return null;

    const draft = drafts[index];
    const version = {
      versionId: uuidv4(),
      versionNumber: draft.versions.length + 1,
      note: note || `版本 ${draft.versions.length + 1}`,
      snapshot,
      createdAt: new Date().toISOString(),
    };
    draft.versions.push(version);
    draft.currentVersionId = version.versionId;
    draft.updatedAt = new Date().toISOString();
    drafts[index] = draft;
    writeDrafts(drafts);
    console.log(`[TemplateStore] Added version ${version.versionNumber} to draft: ${id}`);
    return draft;
  },

  setCurrentVersion(id, versionId) {
    const drafts = readDrafts();
    const index = drafts.findIndex((d) => d._id === id);
    if (index < 0) return null;

    const draft = drafts[index];
    if (!draft.versions.some((v) => v.versionId === versionId)) {
      return { error: 'version_not_found' };
    }
    draft.currentVersionId = versionId;
    draft.updatedAt = new Date().toISOString();
    drafts[index] = draft;
    writeDrafts(drafts);
    console.log(`[TemplateStore] Switched draft ${id} to version ${versionId}`);
    return draft;
  },

  markPublished(id) {
    const drafts = readDrafts();
    const index = drafts.findIndex((d) => d._id === id);
    if (index < 0) return null;
    drafts[index].status = 'published';
    drafts[index].updatedAt = new Date().toISOString();
    writeDrafts(drafts);
    return drafts[index];
  },

  remove(id) {
    const drafts = readDrafts();
    const index = drafts.findIndex((d) => d._id === id);
    if (index < 0) return null;
    const deleted = drafts[index];
    drafts.splice(index, 1);
    writeDrafts(drafts);
    console.log(`[TemplateStore] Deleted draft: ${id}`);
    return deleted;
  },
};

const PublishedTemplateStore = {
  list() {
    return readPublished().sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  },

  getById(id) {
    return readPublished().find((t) => t._id === id) || null;
  },

  findByDraftVersion(draftId, versionId) {
    return (
      readPublished().find(
        (t) => t.sourceDraftId === draftId && t.sourceVersionId === versionId
      ) || null
    );
  },

  publish(draft, version) {
    const snapshot = version.snapshot;
    const template = {
      _id: uuidv4(),
      name: draft.name.trim(),
      description: draft.scenario.trim(),
      category: draft.category || 'custom',
      thumbnail: draft.preview,
      icon: draft.icon,
      width: snapshot.width,
      height: snapshot.height,
      backgroundColor: snapshot.backgroundColor,
      layers: snapshot.layers,
      sourceDraftId: draft._id,
      sourceVersionId: version.versionId,
      versionNumber: version.versionNumber,
      publishedAt: new Date().toISOString(),
    };
    const templates = readPublished();
    templates.unshift(template);
    writePublished(templates);
    console.log(
      `[TemplateStore] Published template: ${template._id} from draft ${draft._id} v${version.versionNumber}`
    );
    return template;
  },
};

module.exports = {
  TemplateDraftStore,
  PublishedTemplateStore,
  getMissingFields,
};
