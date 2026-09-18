import React, { useState } from 'react';
import { TemplateDraft } from '../types';
import { templateDraftApi, PublishError } from '../services/api';

const ICON_CHOICES = ['📝', '🔄', '📅', '🧠', '📊', '🎯', '🗺️', '💡', '📋', '🚀', '🎨', '🧩'];

const PREVIEW_CHOICES = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
];

const formatVersionTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

interface TemplateDraftEditorProps {
  draft: TemplateDraft;
  onClose: () => void;
  onChanged: () => void;
  onPublished: (message: string) => void;
}

export const TemplateDraftEditor: React.FC<TemplateDraftEditorProps> = ({
  draft: initialDraft,
  onClose,
  onChanged,
  onPublished,
}) => {
  const [draft, setDraft] = useState<TemplateDraft>(initialDraft);
  const [name, setName] = useState(initialDraft.name);
  const [scenario, setScenario] = useState(initialDraft.scenario);
  const [icon, setIcon] = useState(initialDraft.icon);
  const [preview, setPreview] = useState(initialDraft.preview);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = saving || publishing || switching;
  const currentVersion = draft.versions.find((v) => v.versionId === draft.currentVersionId);

  const applyDraft = (updated: TemplateDraft) => {
    setDraft(updated);
    onChanged();
  };

  const handleSave = async (): Promise<TemplateDraft | null> => {
    if (busy) return null;
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const updated = await templateDraftApi.updateDraft(draft._id, { name, scenario, icon, preview });
      applyDraft(updated);
      setNotice('草稿已保存');
      return updated;
    } catch (err) {
      console.error('Failed to save draft:', err);
      setError('保存草稿失败，请重试');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (busy) return;
    try {
      setPublishing(true);
      setError(null);
      setMissing([]);
      setNotice(null);
      const result = await templateDraftApi.publishDraft(draft._id, { name, scenario, icon, preview });
      onChanged();
      onPublished(
        result.duplicated
          ? `「${result.template.name}」该版本已发布过，未重复生成模板`
          : `「${result.template.name}」已发布到精选模板`
      );
      onClose();
    } catch (err) {
      if (err instanceof PublishError) {
        // 编辑内容已随发布请求保存到草稿，本地输入也保留，只需提示缺少项
        setMissing(err.missing);
        setError(err.message);
      } else {
        console.error('Failed to publish draft:', err);
        setError('发布失败，请重试');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleSwitchVersion = async (versionId: string) => {
    if (busy || versionId === draft.currentVersionId) return;
    try {
      setSwitching(true);
      setError(null);
      setNotice(null);
      const updated = await templateDraftApi.switchVersion(draft._id, versionId);
      applyDraft(updated);
      const v = updated.versions.find((item) => item.versionId === versionId);
      setNotice(`已切换到版本 V${v?.versionNumber ?? ''}`);
    } catch (err) {
      console.error('Failed to switch version:', err);
      setError('切换版本失败，请重试');
    } finally {
      setSwitching(false);
    }
  };

  const handleSnapshotVersion = async () => {
    if (busy) return;
    try {
      setSwitching(true);
      setError(null);
      setNotice(null);
      const updated = await templateDraftApi.addVersion(draft._id, {});
      applyDraft(updated);
      setNotice(`已从源白板快照为新版本 V${updated.versions.length}`);
    } catch (err) {
      console.error('Failed to snapshot version:', err);
      setError('生成新版本失败，请重试');
    } finally {
      setSwitching(false);
    }
  };

  const fieldHighlight = (key: string): React.CSSProperties =>
    missing.includes(key) ? { borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)' } : {};

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
  };

  const requiredMark = <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '720px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              编辑模板草稿
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              补充适用场景、图标和预览后发布到精选模板
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
              {missing.length > 0 && (
                <span style={{ display: 'block', marginTop: '4px', color: '#991b1b' }}>
                  以下内容已保留，补齐后即可重新发布。
                </span>
              )}
            </div>
          )}
          {notice && (
            <div
              style={{
                padding: '10px 14px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                color: '#15803d',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {notice}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>模板名称{requiredMark}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入模板名称"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                ...fieldHighlight('name'),
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>适用场景{requiredMark}</label>
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="描述这个模板适合用在什么场景，例如：团队周会、项目复盘……"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                ...fieldHighlight('scenario'),
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>图标{requiredMark}</label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: missing.includes('icon') ? '8px' : '0',
                borderRadius: '8px',
                ...(missing.includes('icon') ? { border: '1px solid #dc2626' } : {}),
              }}
            >
              {ICON_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setIcon(choice)}
                  style={{
                    width: '40px',
                    height: '40px',
                    fontSize: '20px',
                    borderRadius: '8px',
                    border: icon === choice ? '2px solid #667eea' : '1px solid #e5e7eb',
                    background: icon === choice ? '#eef2ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>预览{requiredMark}</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                padding: missing.includes('preview') ? '8px' : '0',
                borderRadius: '8px',
                ...(missing.includes('preview') ? { border: '1px solid #dc2626' } : {}),
              }}
            >
              {PREVIEW_CHOICES.map((choice) => (
                <div
                  key={choice}
                  onClick={() => setPreview(choice)}
                  style={{
                    height: '48px',
                    borderRadius: '8px',
                    background: choice,
                    cursor: 'pointer',
                    border: preview === choice ? '2px solid #667eea' : '2px solid transparent',
                    boxShadow: preview === choice ? '0 0 0 2px rgba(102, 126, 234, 0.3)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {preview === choice && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>内容版本（发布前可反复切换）</label>
              <button
                type="button"
                onClick={handleSnapshotVersion}
                disabled={busy}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#667eea',
                  background: '#eef2ff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                从源白板生成新版本
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...draft.versions]
                .sort((a, b) => b.versionNumber - a.versionNumber)
                .map((version) => {
                  const isCurrent = version.versionId === draft.currentVersionId;
                  return (
                    <div
                      key={version.versionId}
                      onClick={() => handleSwitchVersion(version.versionId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: isCurrent ? '2px solid #667eea' : '1px solid #e5e7eb',
                        background: isCurrent ? '#eef2ff' : '#fff',
                        cursor: switching ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                          V{version.versionNumber} · {version.note}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {formatVersionTime(version.createdAt)} · {version.snapshot.layers.length} 个图层
                        </div>
                      </div>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#667eea',
                            background: '#fff',
                            padding: '2px 10px',
                            borderRadius: '10px',
                            border: '1px solid #c7d2fe',
                          }}
                        >
                          当前版本
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
            {currentVersion && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b7280' }}>
                将发布版本 V{currentVersion.versionNumber} 的内容到精选模板
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {draft.status === 'published' ? '该草稿已有版本发布' : '草稿不会出现在使用入口'}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                background: '#e5e7eb',
                border: 'none',
                borderRadius: '8px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#667eea',
                background: '#eef2ff',
                border: 'none',
                borderRadius: '8px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {saving ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#fff',
                background: '#667eea',
                border: 'none',
                borderRadius: '8px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.8 : 1,
              }}
              onMouseEnter={(e) => {
                if (!busy) e.currentTarget.style.background = '#5a67d8';
              }}
              onMouseLeave={(e) => {
                if (!busy) e.currentTarget.style.background = '#667eea';
              }}
            >
              {publishing ? '发布中...' : '发布到精选模板'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
