import React, { useEffect, useMemo, useState } from 'react';
import {
  MissingTemplateField,
  TemplateDraftGroup,
  TemplateVersion,
} from '../types';
import { templateApi, TemplatePublishError } from '../services/api';

const CURRENT_USER_ID = 'user-1';

const ICON_CHOICES = ['📝', '🔄', '📅', '🎯', '💡', '🗺️', '🧩', '🚀', '📊', '🧠', '✅', '⭐'];

const THUMBNAIL_CHOICES = [
  { label: '梦幻紫', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: '珊瑚粉', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: '海天蓝', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { label: '清新绿', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { label: '暖阳橙', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { label: '淡雅青', value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
];

interface EditorFields {
  name: string;
  description: string;
  category: string;
  useCasesText: string;
  icon: string;
  thumbnail: string;
}

const fieldsFromVersion = (version: TemplateVersion): EditorFields => ({
  name: version.name || '',
  description: version.description || '',
  category: version.category || '',
  useCasesText: (version.useCases || []).join('\n'),
  icon: version.icon || '',
  thumbnail: version.thumbnail || '',
});

const toPayload = (fields: EditorFields) => ({
  ownerId: CURRENT_USER_ID,
  name: fields.name.trim(),
  description: fields.description.trim(),
  category: fields.category.trim(),
  useCases: fields.useCasesText
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean),
  icon: fields.icon.trim(),
  thumbnail: fields.thumbnail.trim(),
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: '14px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
};

interface TemplateDraftEditorProps {
  isOpen: boolean;
  group: TemplateDraftGroup | null;
  onClose: () => void;
  onGroupChanged: (group: TemplateDraftGroup) => void;
  onPublished: (group: TemplateDraftGroup) => void;
}

export const TemplateDraftEditor: React.FC<TemplateDraftEditorProps> = ({
  isOpen,
  group,
  onClose,
  onGroupChanged,
  onPublished,
}) => {
  const [activeVersion, setActiveVersion] = useState<number>(1);
  // Per-version form cache so switching back and forth never loses edits.
  const [fieldCache, setFieldCache] = useState<Record<number, EditorFields>>({});
  const [busy, setBusy] = useState(false);
  const [addingVersion, setAddingVersion] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [missingFields, setMissingFields] = useState<MissingTemplateField[]>([]);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setNotice(null);
      setMissingFields([]);
      setHasUnsaved(false);
      const latest = group.versions.reduce((latest, v) =>
        v.version > latest.version ? v : latest
      );
      setActiveVersion(latest.version);
      const initialCache: Record<number, EditorFields> = {};
      group.versions.forEach((v) => {
        initialCache[v.version] = fieldsFromVersion(v);
      });
      setFieldCache(initialCache);
    }
  }, [isOpen, group]);

  const version = useMemo(
    () => group?.versions.find((v) => v.version === activeVersion) || null,
    [group, activeVersion]
  );

  const fields = version ? fieldCache[version.version] || fieldsFromVersion(version) : null;

  if (!isOpen || !group || !version || !fields) return null;

  const isPublished = version.status === 'published';
  const elementCount = (version.content?.layers || []).reduce(
    (sum, layer) => sum + layer.elements.length,
    0
  );

  const patchFields = (patch: Partial<EditorFields>) => {
    setFieldCache((cache) => ({
      ...cache,
      [version.version]: { ...fields, ...patch },
    }));
    setHasUnsaved(true);
    setNotice(null);
  };

  const switchVersion = (nextVersion: number) => {
    if (nextVersion === version.version) return;
    setActiveVersion(nextVersion);
    setNotice(null);
    setMissingFields([]);
    setHasUnsaved(false);
  };

  const refreshGroup = (updated: TemplateDraftGroup) => {
    const refreshedCache: Record<number, EditorFields> = {};
    updated.versions.forEach((v) => {
      refreshedCache[v.version] = fieldCache[v.version]
        ? { ...fieldCache[v.version] }
        : fieldsFromVersion(v);
    });
    setFieldCache(refreshedCache);
    onGroupChanged(updated);
  };

  const handleSaveDraft = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const updated = await templateApi.saveDraft(group._id, version.version, toPayload(fields));
      setHasUnsaved(false);
      setMissingFields([]);
      setNotice({ type: 'success', text: '草稿已保存，发布前可继续修改' });
      refreshGroup(updated);
    } catch (error) {
      console.error('Failed to save draft:', error);
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '保存草稿失败，请重试',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const result = await templateApi.publishDraft(
        group._id,
        version.version,
        toPayload(fields)
      );
      setHasUnsaved(false);
      setMissingFields([]);
      refreshGroup(result.group);
      setNotice({ type: 'success', text: '已发布到精选模板，可在模板中心使用' });
      onPublished(result.group);
    } catch (error) {
      if (error instanceof TemplatePublishError) {
        if (error.reason === 'missing' && error.missingFields) {
          // Submitted content was saved on the server; sync local state but keep
          // the form filled in and highlight exactly what is missing.
          setMissingFields(error.missingFields);
          setHasUnsaved(false);
          setNotice({
            type: 'error',
            text: `发布未完成，请补充：${error.missingFields.map((f) => f.label).join('、')}（已保留你填写的内容）`,
          });
        } else {
          setNotice({ type: 'error', text: error.message });
        }
      } else {
        console.error('Failed to publish draft:', error);
        setNotice({ type: 'error', text: '发布失败，请重试' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddVersion = async () => {
    if (busy || addingVersion) return;
    try {
      setAddingVersion(true);
      const result = await templateApi.addDraftVersion(group._id, {
        ownerId: CURRENT_USER_ID,
        fromVersion: version.version,
      });
      const newCache: Record<number, EditorFields> = {};
      result.group.versions.forEach((v) => {
        newCache[v.version] = fieldCache[v.version]
          ? { ...fieldCache[v.version] }
          : fieldsFromVersion(v);
      });
      setFieldCache(newCache);
      setActiveVersion(result.version.version);
      setHasUnsaved(false);
      setMissingFields([]);
      setNotice({ type: 'success', text: `已基于 V${version.version} 新建 V${result.version.version}，原版本保持不变` });
      onGroupChanged(result.group);
    } catch (error) {
      console.error('Failed to add version:', error);
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '新建版本失败，请重试',
      });
    } finally {
      setAddingVersion(false);
    }
  };

  const missingSet = new Set(missingFields.map((f) => f.field));
  const borderFor = (field: string) =>
    missingSet.has(field) ? { borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' } : {};

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
          width: '760px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              整理模板 · V{version.version}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              来自白板 {version.content ? `${elementCount} 个元素` : ''}，完善信息后发布到精选模板
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Version switcher */}
        <div
          style={{
            padding: '12px 28px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {group.versions.map((v) => {
            const active = v.version === activeVersion;
            return (
              <button
                key={v.version}
                type="button"
                onClick={() => switchVersion(v.version)}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  borderRadius: '999px',
                  border: active ? '1px solid #667eea' : '1px solid #d1d5db',
                  background: active ? 'rgba(102,126,234,0.08)' : '#fff',
                  color: active ? '#5a67d8' : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                V{v.version}
                {v.status === 'published' ? ' · 已发布' : ' · 草稿'}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleAddVersion}
            disabled={addingVersion}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '999px',
              border: '1px dashed #667eea',
              background: 'transparent',
              color: '#5a67d8',
              cursor: addingVersion ? 'not-allowed' : 'pointer',
              opacity: addingVersion ? 0.6 : 1,
            }}
          >
            + 新建版本
          </button>
          {hasUnsaved && (
            <span style={{ fontSize: '12px', color: '#d97706', marginLeft: 'auto' }}>
              有未保存的修改
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {isPublished && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                borderRadius: '8px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                fontSize: '13px',
              }}
            >
              V{version.version} 已发布且不可修改。可点击「新建版本」基于它继续调整。
            </div>
          )}

          {notice && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                borderRadius: '8px',
                fontSize: '13px',
                background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border:
                  notice.type === 'success'
                    ? '1px solid #bbf7d0'
                    : '1px solid #fecaca',
                color: notice.type === 'success' ? '#15803d' : '#dc2626',
              }}
            >
              {notice.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={labelStyle}>
                  模板名称 <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fields.name}
                  disabled={isPublished}
                  onChange={(e) => patchFields({ name: e.target.value })}
                  placeholder="例如：站会同步板"
                  style={{ ...inputStyle, ...borderFor('name') }}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  模板描述 <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  value={fields.description}
                  disabled={isPublished}
                  onChange={(e) => patchFields({ description: e.target.value })}
                  placeholder="一句话介绍这个模板的用途"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  适用场景 <span style={{ color: '#dc2626' }}>*</span>
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>
                    每行一个，例如：每日站会、迭代复盘
                  </span>
                </label>
                <textarea
                  value={fields.useCasesText}
                  disabled={isPublished}
                  onChange={(e) => patchFields({ useCasesText: e.target.value })}
                  placeholder={'每日站会\n迭代复盘\n需求评审'}
                  rows={3}
                  style={{ ...inputStyle, ...borderFor('useCases'), resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  图标 <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ICON_CHOICES.map((icon) => {
                    const selected = fields.icon === icon;
                    return (
                      <button
                        key={icon}
                        type="button"
                        disabled={isPublished}
                        onClick={() => patchFields({ icon })}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          fontSize: '20px',
                          border: selected
                            ? '2px solid #667eea'
                            : missingSet.has('icon')
                              ? '2px solid #fecaca'
                              : '1px solid #e5e7eb',
                          background: selected ? 'rgba(102,126,234,0.08)' : '#fff',
                          cursor: isPublished ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  预览底色 <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {THUMBNAIL_CHOICES.map((choice) => {
                    const selected = fields.thumbnail === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        disabled={isPublished}
                        onClick={() => patchFields({ thumbnail: choice.value })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: selected
                            ? '2px solid #667eea'
                            : missingSet.has('thumbnail')
                              ? '2px solid #fecaca'
                              : '1px solid #e5e7eb',
                          background: '#fff',
                          cursor: isPublished ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: '28px',
                            height: '20px',
                            borderRadius: '4px',
                            background: choice.value,
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#374151' }}>{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>预览效果</label>
              <div
                style={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                <div
                  style={{
                    height: '120px',
                    background: fields.thumbnail || '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '40px' }}>{fields.icon || '?'}</span>
                </div>
                <div style={{ padding: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                    {fields.name || '未命名模板'}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginTop: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {fields.description || '暂无描述'}
                  </div>
                </div>
              </div>
              {(fields.useCasesText
                .split(/[\n,，]/)
                .map((s) => s.trim())
                .filter(Boolean).length > 0) && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {fields.useCasesText
                    .split(/[\n,，]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((useCase, index) => (
                      <span
                        key={`${useCase}-${index}`}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: '#eef2ff',
                          color: '#4f46e5',
                        }}
                      >
                        {useCase}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '9px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: '8px',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            关闭
          </button>
          {!isPublished && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={busy}
                style={{
                  padding: '9px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#5a67d8',
                  background: '#eef2ff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                保存草稿
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={busy}
                style={{
                  padding: '9px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#fff',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.8 : 1,
                }}
              >
                {busy ? '处理中...' : '发布到精选模板'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
