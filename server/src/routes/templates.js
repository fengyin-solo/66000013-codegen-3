const express = require('express');
const router = express.Router();
const { Board } = require('../storage');
const { getTemplates, getTemplateById } = require('../templates');
const templateStore = require('../templateStore');

const toPublishedSummary = (group, version) => ({
  _id: `${group._id}--v${version.version}`,
  groupId: group._id,
  version: version.version,
  name: version.name,
  description: version.description,
  category: version.category || 'custom',
  useCases: version.useCases,
  thumbnail: version.thumbnail,
  icon: version.icon,
  width: version.content.width,
  height: version.content.height,
  backgroundColor: version.content.backgroundColor,
  custom: true,
});

const toFullTemplate = (group, version) => ({
  ...toPublishedSummary(group, version),
  layers: version.content.layers,
});

// Featured templates: built-in templates + published custom template versions.
// Draft versions never appear here.
router.get('/', (req, res) => {
  try {
    const builtins = getTemplates().map((t) => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      category: t.category,
      thumbnail: t.thumbnail,
      icon: t.icon,
      width: t.width,
      height: t.height,
      backgroundColor: t.backgroundColor,
      custom: false,
    }));

    const customs = templateStore
      .listPublished()
      .map(({ group, version }) => toPublishedSummary(group, version));

    res.json([...builtins, ...customs]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Draft management -------------------------------------------------------

router.post('/drafts', (req, res) => {
  try {
    const { ownerId, boardId, name, content } = req.body;

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    if (!content || !Array.isArray(content.layers)) {
      return res.status(400).json({ error: 'content with layers is required' });
    }

    const group = templateStore.createDraft({
      ownerId,
      sourceBoardId: boardId,
      name: name || '未命名模板',
      content,
    });
    res.status(201).json(group);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/drafts', (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    res.json(templateStore.listDrafts(ownerId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/drafts/:groupId', (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    const group = templateStore.getOwnedGroup(req.params.groupId, ownerId);
    if (!group) {
      return res.status(404).json({ error: 'Template draft not found' });
    }
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/drafts/:groupId/versions/:version', (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    const group = templateStore.updateVersion(
      req.params.groupId,
      ownerId,
      req.params.version,
      req.body
    );
    res.json(group);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/drafts/:groupId/versions', (req, res) => {
  try {
    const { ownerId, fromVersion } = req.body;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    const { group, version } = templateStore.addVersion(req.params.groupId, ownerId, {
      fromVersion,
    });
    res.status(201).json({ group, version });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/drafts/:groupId/versions/:version/publish', (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    const result = templateStore.publishVersion(
      req.params.groupId,
      ownerId,
      req.params.version,
      req.body
    );

    if (result.ok) {
      return res.status(201).json({
        templateId: result.templateId,
        group: result.group,
      });
    }

    if (result.reason === 'already-published') {
      return res.status(409).json({
        error: '该版本已经发布，请勿重复发布',
        reason: 'already-published',
        version: result.version,
      });
    }

    if (result.reason === 'duplicate') {
      return res.status(409).json({
        error: `模板内容与已发布的 V${result.existingVersion} 完全相同，不能重复发布`,
        reason: 'duplicate',
        existingVersion: result.existingVersion,
      });
    }

    // Missing required items: metadata has already been saved, editing content
    // is preserved and the response states exactly what is missing.
    return res.status(400).json({
      error: `发布未完成，还缺少：${result.missingFields.map((f) => f.label).join('、')}`,
      reason: 'missing',
      missingFields: result.missingFields,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/drafts/:groupId', (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    const deleted = templateStore.deleteGroup(req.params.groupId, ownerId);
    if (!deleted) {
      return res.status(404).json({ error: 'Template draft not found' });
    }
    res.json({ message: 'Draft deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Template usage ---------------------------------------------------------

router.get('/:id', (req, res) => {
  try {
    const builtin = getTemplateById(req.params.id);
    if (builtin) {
      return res.json(builtin);
    }

    const resolved = templateStore.resolvePublished(req.params.id);
    if (!resolved) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(toFullTemplate(resolved.group, resolved.version));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/create', async (req, res) => {
  try {
    const { name, ownerId } = req.body;

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    const builtin = getTemplateById(req.params.id);
    const resolved = builtin ? null : templateStore.resolvePublished(req.params.id);

    if (!builtin && !resolved) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const templateName = builtin ? builtin.name : resolved.version.name;
    const width = builtin ? builtin.width : resolved.version.content.width;
    const height = builtin ? builtin.height : resolved.version.content.height;
    const backgroundColor = builtin
      ? builtin.backgroundColor
      : resolved.version.content.backgroundColor;
    const layers = builtin ? builtin.layers : resolved.version.content.layers;

    const boardData = {
      name: name || templateName,
      ownerId,
      width,
      height,
      backgroundColor,
      layers: layers.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
        elements: layer.elements,
      })),
    };

    const board = new Board(boardData);
    const savedBoard = await board.save();
    console.log(
      `[Template] Created board from template: ${savedBoard._id}, source: ${req.params.id}`
    );
    res.status(201).json(savedBoard);
  } catch (err) {
    console.error('[Template] Error creating board from template:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
