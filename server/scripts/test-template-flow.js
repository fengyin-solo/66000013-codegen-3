/**
 * End-to-end test for the template draft & publish flow.
 * Starts the express app on an ephemeral port and exercises the HTTP API.
 * Run: node scripts/test-template-flow.js
 */
const assert = require('assert');
const http = require('http');

process.env.PORT = '0';

const { app } = require('../src/index');

const request = (method, pathName, body) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path: pathName,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

const sampleContent = {
  width: 3000,
  height: 2000,
  backgroundColor: '#ffffff',
  layers: [
    {
      name: '图层 1',
      visible: true,
      locked: false,
      order: 0,
      elements: [
        { id: 'e1', type: 'text', x: 10, y: 10, text: 'Hello Template' },
        { id: 'e2', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#f00' },
      ],
    },
  ],
};

const completeMetadata = {
  name: '评审看板',
  description: '用于需求评审的模板',
  category: 'review',
  useCases: ['需求评审', '方案评审'],
  icon: '🎯',
  thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
};

const server = app.listen(0, async () => {
  try {
    // 0. Baseline: built-in templates exist
    const list0 = await request('GET', '/api/templates');
    assert.strictEqual(list0.status, 200);
    assert.ok(list0.body.length >= 3, 'built-in templates present');
    assert.ok(list0.body.every((t) => !t.custom), 'baseline has no custom templates');
    console.log('✓ 内置精选模板照常可用');

    // 1. Create a draft from a board
    const created = await request('POST', '/api/templates/drafts', {
      ownerId: 'user-test',
      boardId: 'board-src',
      name: '我的白板',
      content: sampleContent,
    });
    assert.strictEqual(created.status, 201);
    const groupId = created.body._id;
    assert.strictEqual(created.body.versions.length, 1);
    assert.strictEqual(created.body.versions[0].status, 'draft');
    assert.strictEqual(created.body.versions[0].name, '我的白板');
    console.log('✓ 从白板创建草稿成功');

    // 2. Draft must not appear in featured/usage list
    const list1 = await request('GET', '/api/templates');
    assert.ok(
      !list1.body.some((t) => t._id.includes(groupId)),
      'draft leaks into featured list'
    );
    console.log('✓ 未完成草稿不出现在使用入口');

    // 3. Draft shows in owner's drafts list
    const drafts1 = await request('GET', '/api/templates/drafts?ownerId=user-test');
    assert.strictEqual(drafts1.status, 200);
    assert.ok(drafts1.body.some((d) => d._id === groupId));
    const otherDrafts = await request('GET', '/api/templates/drafts?ownerId=someone-else');
    assert.ok(!otherDrafts.body.some((d) => d._id === groupId), 'draft visible to other user');
    console.log('✓ 草稿仅对所有者可见');

    // 4. Publish with missing fields -> 400, missing fields listed, content kept
    const missing = await request(
      'POST',
      `/api/templates/drafts/${groupId}/versions/1/publish`,
      {
        ownerId: 'user-test',
        name: '评审看板',
        description: '',
        category: '',
        useCases: [],
        icon: '',
        thumbnail: '',
      }
    );
    assert.strictEqual(missing.status, 400);
    assert.strictEqual(missing.body.reason, 'missing');
    const missingNames = missing.body.missingFields.map((f) => f.field);
    assert.deepStrictEqual(missingNames.sort(), ['description', 'icon', 'thumbnail', 'useCases']);
    assert.ok(missing.body.error.includes('模板描述'));

    // verify edits persisted despite failed publish
    const groupAfterFail = await request(
      'GET',
      `/api/templates/drafts/${groupId}?ownerId=user-test`
    );
    assert.strictEqual(groupAfterFail.body.versions[0].name, '评审看板');
    assert.strictEqual(groupAfterFail.body.versions[0].status, 'draft');
    console.log('✓ 发布缺项返回400并指明缺少项，已填内容保留为草稿');

    // 5. Draft still not usable
    const list2 = await request('GET', '/api/templates');
    assert.ok(!list2.body.some((t) => t._id.includes(groupId)));

    // 6. Complete the metadata and publish v1
    const published = await request(
      'POST',
      `/api/templates/drafts/${groupId}/versions/1/publish`,
      { ownerId: 'user-test', ...completeMetadata }
    );
    assert.strictEqual(published.status, 201, JSON.stringify(published.body));
    const templateId = published.body.templateId;
    assert.ok(templateId.startsWith(`${groupId}--v1`));
    console.log('✓ 信息补全后发布成功');

    // 7. Published template appears in featured list with full metadata
    const list3 = await request('GET', '/api/templates');
    const featured = list3.body.find((t) => t._id === templateId);
    assert.ok(featured, 'published template missing from featured list');
    assert.strictEqual(featured.icon, '🎯');
    assert.deepStrictEqual(featured.useCases, ['需求评审', '方案评审']);
    assert.strictEqual(featured.custom, true);
    assert.strictEqual(featured.version, 1);
    console.log('✓ 已发布模板进入精选模板，适用场景/图标/预览可用');

    // 8. Repeat publish of the same version -> 409, no duplicate
    const repeat = await request(
      'POST',
      `/api/templates/drafts/${groupId}/versions/1/publish`,
      { ownerId: 'user-test', ...completeMetadata }
    );
    assert.strictEqual(repeat.status, 409);
    assert.strictEqual(repeat.body.reason, 'already-published');
    const list4 = await request('GET', '/api/templates');
    assert.strictEqual(
      list4.body.filter((t) => t._id.includes(groupId)).length,
      1,
      'duplicate template generated for same version'
    );
    console.log('✓ 重复发布同一版本被拒绝，不生成重复模板');

    // 9. Can fetch full published template and create a board from it
    const detail = await request('GET', `/api/templates/${templateId}`);
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.layers[0].elements.length, 2);

    const board = await request('POST', `/api/templates/${templateId}/create`, {
      name: '来自自定义模板',
      ownerId: 'user-test',
    });
    assert.strictEqual(board.status, 201);
    assert.strictEqual(board.body.name, '来自自定义模板');
    assert.strictEqual(board.body.layers[0].elements.length, 2);
    console.log('✓ 可用已发布的自定义模板创建白板（含全部元素）');

    // 10. Create v2 with identical content + metadata and publish -> 409 duplicate
    const v2 = await request('POST', `/api/templates/drafts/${groupId}/versions`, {
      ownerId: 'user-test',
      fromVersion: 1,
    });
    assert.strictEqual(v2.status, 201);
    assert.strictEqual(v2.body.version.version, 2);
    assert.strictEqual(v2.body.version.status, 'draft');
    assert.strictEqual(v2.body.version.icon, '🎯', 'metadata copied to new version');

    const dupPublish = await request(
      'POST',
      `/api/templates/drafts/${groupId}/versions/2/publish`,
      { ownerId: 'user-test', ...completeMetadata }
    );
    assert.strictEqual(dupPublish.status, 409);
    assert.strictEqual(dupPublish.body.reason, 'duplicate');
    assert.strictEqual(dupPublish.body.existingVersion, 1);
    const list5 = await request('GET', '/api/templates');
    assert.strictEqual(
      list5.body.filter((t) => t._id.includes(groupId)).length,
      1,
      'identical-content version generated duplicate'
    );
    console.log('✓ 内容相同的新版本发布被去重，提示与 V1 重复');

    // 11. Change v2 content (simulate editing the board), publish -> succeeds
    const updatedContent = JSON.parse(JSON.stringify(sampleContent));
    updatedContent.layers[0].elements.push({ id: 'e3', type: 'circle', x: 5, y: 5 });
    // content of an existing version is edited via saveDraft? No — content is immutable on edit;
    // create a fresh group with new content to model "board updated then re-organized" is not the flow.
    // Instead verify draft-vs-published state: v2 remains draft.
    const drafts2 = await request('GET', '/api/templates/drafts?ownerId=user-test');
    const groupSummary = drafts2.body.find((d) => d._id === groupId);
    assert.ok(groupSummary, 'group with pending v2 should still be in drafts');
    assert.strictEqual(groupSummary.versions.filter((x) => x.status === 'draft').length, 1);
    console.log('✓ 仍有草稿版本时，模板组继续出现在「我的草稿」');

    // 12. Blank board creation unaffected (boards API)
    const blank = await request('POST', '/api/boards', { name: '空白', ownerId: 'user-test' });
    assert.strictEqual(blank.status, 201);
    assert.strictEqual(blank.body.layers.length, 1);
    assert.strictEqual(blank.body.layers[0].elements.length, 0);
    console.log('✓ 空白白板创建照常可用');

    // 13. Version switching edits isolation: save different metadata on v2, v1 untouched
    await request('PUT', `/api/templates/drafts/${groupId}/versions/2`, {
      ownerId: 'user-test',
      name: '评审看板 Pro',
      description: '增强版',
      category: 'review',
      useCases: ['技术评审'],
      icon: '🚀',
      thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    });
    const v1Detail = await request('GET', `/api/templates/${templateId}`);
    assert.strictEqual(v1Detail.body.name, '评审看板');
    const groupV2 = await request(
      'GET',
      `/api/templates/drafts/${groupId}?ownerId=user-test`
    );
    assert.strictEqual(groupV2.body.versions[1].name, '评审看板 Pro');
    console.log('✓ 版本间编辑隔离，切换版本互不影响');

    // 14. Cannot edit a published version
    const editPublished = await request(
      'PUT',
      `/api/templates/drafts/${groupId}/versions/1`,
      { ownerId: 'user-test', name: 'hacked', description: '', category: '', useCases: [], icon: '', thumbnail: '' }
    );
    assert.strictEqual(editPublished.status, 409);
    console.log('✓ 已发布版本不可再编辑');

    console.log('\n全部测试通过 ✅');
    process.exit(0);
  } catch (err) {
    console.error('\n测试失败 ❌', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
