const express = require('express');
const router = express.Router();
const { Board } = require('../storage');
const { TemplateDraftStore, PublishedTemplateStore, getMissingFields } = require('../templateStore');

const snapshotBoard = (board) => ({
  width: board.width,
  height: board.height,
  backgroundColor: board.backgroundColor,
  layers: (board.layers || []).map((layer) => ({
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    order: layer.order,
    elements: layer.elements,
  })),
});

// List drafts for a user
router.get('/', (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    res.json(TemplateDraftStore.list(ownerId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a draft from an existing board (snapshot as version 1)
router.post('/', async (req, res) => {
  try {
    const { boardId, name, ownerId } = req.body;

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    if (!boardId) {
      return res.status(400).json({ error: 'boardId is required' });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const draft = TemplateDraftStore.create({
      name: name || board.name,
      ownerId,
      sourceBoardId: board._id,
      snapshot: snapshotBoard(board),
    });
    res.status(201).json(draft);
  } catch (err) {
    console.error('[TemplateDrafts] Error creating draft:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a single draft
router.get('/:id', (req, res) => {
  try {
    const draft = TemplateDraftStore.getById(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update draft metadata (name / scenario / icon / preview)
router.put('/:id', (req, res) => {
  try {
    const draft = TemplateDraftStore.update(req.params.id, req.body);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Snapshot the source board again as a new version
router.post('/:id/versions', async (req, res) => {
  try {
    const draft = TemplateDraftStore.getById(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const boardId = req.body.boardId || draft.sourceBoardId;
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const updated = TemplateDraftStore.addVersion(draft._id, {
      snapshot: snapshotBoard(board),
      note: req.body.note,
    });
    res.status(201).json(updated);
  } catch (err) {
    console.error('[TemplateDrafts] Error adding version:', err);
    res.status(500).json({ error: err.message });
  }
});

// Switch the version the draft points to (can switch back and forth before publishing)
router.put('/:id/current-version', (req, res) => {
  try {
    const { versionId } = req.body;
    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required' });
    }
    const result = TemplateDraftStore.setCurrentVersion(req.params.id, versionId);
    if (!result) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    if (result.error === 'version_not_found') {
      return res.status(404).json({ error: 'Version not found' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish the current version to the curated template gallery.
// Editable fields may be sent along with the publish request; they are saved
// first so that a failed publish never loses edits. Publishing is idempotent
// per (draft, version): re-publishing the same version returns the existing
// template instead of creating a duplicate.
router.post('/:id/publish', (req, res) => {
  try {
    const { name, scenario, icon, preview, category } = req.body || {};

    // Persist any edits that came with the publish request before validating
    if (name !== undefined || scenario !== undefined || icon !== undefined || preview !== undefined || category !== undefined) {
      TemplateDraftStore.update(req.params.id, { name, scenario, icon, preview, category });
    }

    const draft = TemplateDraftStore.getById(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const missing = getMissingFields(draft);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `发布未完成，缺少：${missing.map((f) => f.label).join('、')}`,
        missing: missing.map((f) => f.key),
        missingLabels: missing.map((f) => f.label),
        draft,
      });
    }

    const version = draft.versions.find((v) => v.versionId === draft.currentVersionId);
    if (!version) {
      return res.status(400).json({ error: '发布未完成，缺少：模板内容版本', missing: ['version'] });
    }

    // Idempotency: the same draft version can only be published once
    const existing = PublishedTemplateStore.findByDraftVersion(draft._id, version.versionId);
    if (existing) {
      return res.status(200).json({ template: existing, duplicated: true });
    }

    const template = PublishedTemplateStore.publish(draft, version);
    TemplateDraftStore.markPublished(draft._id);
    res.status(201).json({ template, duplicated: false });
  } catch (err) {
    console.error('[TemplateDrafts] Error publishing draft:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a draft
router.delete('/:id', (req, res) => {
  try {
    const deleted = TemplateDraftStore.remove(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    res.json({ message: 'Draft deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
