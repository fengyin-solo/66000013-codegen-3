const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
const TEMPLATE_DRAFTS_FILE = path.join(DATA_DIR, 'template-drafts.json');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const readGroups = () => {
  ensureDataDir();
  if (!fs.existsSync(TEMPLATE_DRAFTS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(TEMPLATE_DRAFTS_FILE, 'utf8'));
  } catch (error) {
    console.error('[TemplateStore] Error reading template drafts file:', error);
    return [];
  }
};

const writeGroups = (groups) => {
  ensureDataDir();
  fs.writeFileSync(TEMPLATE_DRAFTS_FILE, JSON.stringify(groups, null, 2), 'utf8');
};

const sanitizeContent = (content = {}) => ({
  width: Number(content.width) || 3000,
  height: Number(content.height) || 2000,
  backgroundColor: content.backgroundColor || '#ffffff',
  layers: Array.isArray(content.layers)
    ? content.layers.map((layer, index) => ({
        name: layer.name || `图层 ${index + 1}`,
        visible: layer.visible !== false,
        locked: Boolean(layer.locked),
        order: typeof layer.order === 'number' ? layer.order : index,
        elements: Array.isArray(layer.elements) ? layer.elements : [],
      }))
    : [],
});

const normalizeVersionMetadata = (patch = {}) => {
  const useCases = Array.isArray(patch.useCases)
    ? patch.useCases
    : typeof patch.useCases === 'string'
      ? patch.useCases.split(/[\n,，]/)
      : [];

  return {
    name: typeof patch.name === 'string' ? patch.name.trim() : '',
    description: typeof patch.description === 'string' ? patch.description.trim() : '',
    category: typeof patch.category === 'string' ? patch.category.trim() : '',
    useCases: useCases.map((item) => String(item).trim()).filter(Boolean),
    icon: typeof patch.icon === 'string' ? patch.icon.trim() : '',
    thumbnail: typeof patch.thumbnail === 'string' ? patch.thumbnail.trim() : '',
  };
};

const contentHash = (content) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(content))
    .digest('hex');

const applyMetadata = (version, metadata) => {
  Object.assign(version, metadata);
  version.updatedAt = new Date().toISOString();
};

const createDraft = ({ ownerId, sourceBoardId, name, content }) => {
  if (!ownerId) {
    throw Object.assign(new Error('ownerId is required'), { status: 400 });
  }

  const now = new Date().toISOString();
  const group = {
    _id: `tpl-${uuidv4()}`,
    ownerId,
    sourceBoardId: sourceBoardId || null,
    createdAt: now,
    updatedAt: now,
    versions: [
      {
        version: 1,
        status: 'draft',
        name: (name || '').trim() || '未命名模板',
        description: '',
        category: '',
        useCases: [],
        icon: '',
        thumbnail: '',
        content: sanitizeContent(content),
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      },
    ],
  };

  const groups = readGroups();
  groups.unshift(group);
  writeGroups(groups);
  console.log(`[TemplateStore] Created draft template group: ${group._id} from board ${sourceBoardId || 'n/a'}`);
  return group;
};

const getOwnedGroup = (groupId, ownerId) => {
  const group = readGroups().find((g) => g._id === groupId);
  if (!group) return null;
  if (ownerId && group.ownerId !== ownerId) return null;
  return group;
};

const persistGroup = (group) => {
  const groups = readGroups();
  const index = groups.findIndex((g) => g._id === group._id);
  if (index < 0) {
    throw Object.assign(new Error('Template group not found'), { status: 404 });
  }
  group.updatedAt = new Date().toISOString();
  groups[index] = group;
  writeGroups(groups);
  return group;
};

const findVersion = (group, versionNumber) =>
  group.versions.find((v) => v.version === Number(versionNumber));

/**
 * Drafts visible to the owner: template groups that still contain at least one
 * draft version. Fully published groups disappear from the draft entry and are
 * only available in the featured template list.
 */
const listDrafts = (ownerId) =>
  readGroups()
    .filter((g) => g.ownerId === ownerId && g.versions.some((v) => v.status === 'draft'))
    .map((g) => ({
      _id: g._id,
      name: g.versions.reduce(
        (latest, v) => (v.version > latest.version ? v : latest),
        g.versions[0]
      ).name,
      sourceBoardId: g.sourceBoardId,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      versions: g.versions.map((v) => ({
        version: v.version,
        status: v.status,
        name: v.name,
        updatedAt: v.updatedAt,
        publishedAt: v.publishedAt,
      })),
    }));

const updateVersion = (groupId, ownerId, versionNumber, patch) => {
  const group = getOwnedGroup(groupId, ownerId);
  if (!group) {
    throw Object.assign(new Error('Template draft not found'), { status: 404 });
  }
  const version = findVersion(group, versionNumber);
  if (!version) {
    throw Object.assign(new Error('Template version not found'), { status: 404 });
  }
  if (version.status !== 'draft') {
    throw Object.assign(new Error('已发布的版本不可编辑，请新建版本后修改'), { status: 409 });
  }

  applyMetadata(version, normalizeVersionMetadata(patch));
  persistGroup(group);
  console.log(`[TemplateStore] Updated draft ${groupId} v${versionNumber}`);
  return group;
};

const addVersion = (groupId, ownerId, { fromVersion } = {}) => {
  const group = getOwnedGroup(groupId, ownerId);
  if (!group) {
    throw Object.assign(new Error('Template draft not found'), { status: 404 });
  }

  const base =
    (fromVersion ? findVersion(group, fromVersion) : null) ||
    group.versions.reduce((latest, v) => (v.version > latest.version ? v : latest), group.versions[0]);

  const now = new Date().toISOString();
  const nextNumber = Math.max(...group.versions.map((v) => v.version)) + 1;
  const copy = JSON.parse(JSON.stringify(base.content));
  const newVersion = {
    version: nextNumber,
    status: 'draft',
    name: base.name,
    description: base.description,
    category: base.category,
    useCases: [...base.useCases],
    icon: base.icon,
    thumbnail: base.thumbnail,
    content: copy,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };

  group.versions.push(newVersion);
  persistGroup(group);
  console.log(`[TemplateStore] Added v${nextNumber} to template group ${groupId} (from v${base.version})`);
  return { group, version: newVersion };
};

/**
 * Publish a draft version.
 * Returns:
 *  - { ok: false, reason: 'missing', missingFields: [{field,label}] }
 *  - { ok: false, reason: 'already-published' }
 *  - { ok: false, reason: 'duplicate', existingVersion }
 *  - { ok: true, templateId, group }
 * Metadata is always saved first, so a failed publish keeps everything the
 * user has entered.
 */
const PUBLISH_REQUIRED_FIELDS = [
  { field: 'name', label: '模板名称' },
  { field: 'description', label: '模板描述' },
  { field: 'useCases', label: '适用场景' },
  { field: 'icon', label: '图标' },
  { field: 'thumbnail', label: '预览' },
];

const publishVersion = (groupId, ownerId, versionNumber, patch) => {
  const group = getOwnedGroup(groupId, ownerId);
  if (!group) {
    throw Object.assign(new Error('Template draft not found'), { status: 404 });
  }
  const version = findVersion(group, versionNumber);
  if (!version) {
    throw Object.assign(new Error('Template version not found'), { status: 404 });
  }

  // Persist submitted metadata first so edits survive a failed publish.
  applyMetadata(version, normalizeVersionMetadata(patch));

  if (version.status === 'published') {
    persistGroup(group);
    return { ok: false, reason: 'already-published', version: version.version };
  }

  const missingFields = PUBLISH_REQUIRED_FIELDS.filter(({ field }) => {
    const value = version[field];
    return Array.isArray(value) ? value.length === 0 : !value;
  });

  if (missingFields.length > 0) {
    persistGroup(group);
    return { ok: false, reason: 'missing', missingFields };
  }

  const hash = contentHash(version.content);
  const duplicate = group.versions.find(
    (v) => v.status === 'published' && v.version !== version.version && contentHash(v.content) === hash
  );
  if (duplicate) {
    persistGroup(group);
    return { ok: false, reason: 'duplicate', existingVersion: duplicate.version };
  }

  version.status = 'published';
  version.publishedAt = new Date().toISOString();
  version.updatedAt = version.publishedAt;
  persistGroup(group);
  console.log(`[TemplateStore] Published template ${groupId} v${versionNumber}`);
  return {
    ok: true,
    templateId: `${groupId}--v${version.version}`,
    group,
  };
};

const deleteGroup = (groupId, ownerId) => {
  const groups = readGroups();
  const index = groups.findIndex((g) => g._id === groupId && g.ownerId === ownerId);
  if (index < 0) return false;
  groups.splice(index, 1);
  writeGroups(groups);
  console.log(`[TemplateStore] Deleted template group ${groupId}`);
  return true;
};

const parsePublishedId = (templateId) => {
  const match = /^(tpl-[a-zA-Z0-9-]+)--v(\d+)$/.exec(templateId);
  if (!match) return null;
  return { groupId: match[1], version: Number(match[2]) };
};

const resolvePublished = (templateId) => {
  const parsed = parsePublishedId(templateId);
  if (!parsed) return null;
  const group = readGroups().find((g) => g._id === parsed.groupId);
  if (!group) return null;
  const version = findVersion(group, parsed.version);
  if (!version || version.status !== 'published') return null;
  return { group, version };
};

const listPublished = () => {
  const result = [];
  for (const group of readGroups()) {
    for (const version of group.versions) {
      if (version.status === 'published') {
        result.push({ group, version });
      }
    }
  }
  return result;
};

module.exports = {
  PUBLISH_REQUIRED_FIELDS,
  createDraft,
  listDrafts,
  getOwnedGroup,
  findVersion,
  updateVersion,
  addVersion,
  publishVersion,
  deleteGroup,
  resolvePublished,
  listPublished,
  parsePublishedId,
};
