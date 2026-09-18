import { Board, Template, TemplateDraftGroup, TemplateDraftSummary } from '../types';

const API_BASE_URL = '/api/boards';
const TEMPLATE_API_URL = '/api/templates';

export class TemplatePublishError extends Error {
  status: number;
  reason?: string;
  missingFields?: Array<{ field: string; label: string }>;
  existingVersion?: number;

  constructor(
    message: string,
    details: {
      status: number;
      reason?: string;
      missingFields?: Array<{ field: string; label: string }>;
      existingVersion?: number;
    }
  ) {
    super(message);
    this.name = 'TemplatePublishError';
    this.status = details.status;
    this.reason = details.reason;
    this.missingFields = details.missingFields;
    this.existingVersion = details.existingVersion;
  }
}

const parseErrorBody = async (
  response: Response
): Promise<{
  error?: string;
  reason?: string;
  missingFields?: Array<{ field: string; label: string }>;
  existingVersion?: number;
}> => response.json().catch(() => ({}));


export const boardApi = {
  async getBoards(userId: string): Promise<Board[]> {
    const response = await fetch(`${API_BASE_URL}?userId=${userId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch boards');
    }
    return response.json();
  },

  async getBoard(boardId: string): Promise<Board | null> {
    const response = await fetch(`${API_BASE_URL}/${boardId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch board');
    }
    return response.json();
  },

  async createBoard(data: { name: string; ownerId: string; width?: number; height?: number }): Promise<Board | null> {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create board');
    }
    return response.json();
  },

  async deleteBoard(boardId: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/${boardId}`, { method: 'DELETE' });
    return response.ok;
  },

  getMockBoards(): Board[] {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString();
    const lastWeek = new Date(Date.now() - 86400000 * 7).toISOString();

    return [
      {
        _id: 'board-1',
        name: '产品需求评审',
        ownerId: 'user-1',
        collaborators: ['user-2', 'user-3'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#f5f5f5',
        createdAt: lastWeek,
        updatedAt: now,
      },
      {
        _id: 'board-2',
        name: '架构设计讨论',
        ownerId: 'user-1',
        collaborators: ['user-4'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#ffffff',
        createdAt: lastWeek,
        updatedAt: yesterday,
      },
      {
        _id: 'board-3',
        name: '用户旅程地图',
        ownerId: 'user-2',
        collaborators: ['user-1', 'user-5'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#f0f8ff',
        createdAt: lastWeek,
        updatedAt: twoDaysAgo,
      },
      {
        _id: 'board-4',
        name: '团队脑暴会',
        ownerId: 'user-3',
        collaborators: ['user-1'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#fff8e1',
        createdAt: lastWeek,
        updatedAt: lastWeek,
      },
    ];
  },

  createMockBoard(data: { name: string; ownerId: string }): Board {
    const now = new Date().toISOString();
    return {
      _id: `board-${Date.now()}`,
      name: data.name,
      ownerId: data.ownerId,
      collaborators: [],
      layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
      width: 3000,
      height: 2000,
      backgroundColor: '#ffffff',
      createdAt: now,
      updatedAt: now,
    };
  },
};

export const mockTemplates: Template[] = [
  {
    _id: 'template-meeting',
    name: '会议纪要',
    description: '快速记录会议要点、待办事项和决议',
    category: 'meeting',
    thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    icon: '📝',
    width: 3000,
    height: 2000,
    backgroundColor: '#f8f9fa',
  },
  {
    _id: 'template-workflow',
    name: '流程梳理',
    description: '可视化梳理业务流程、工作流和决策路径',
    category: 'workflow',
    thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    icon: '🔄',
    width: 3500,
    height: 2200,
    backgroundColor: '#f0f9ff',
  },
  {
    _id: 'template-weekly',
    name: '周计划',
    description: '规划一周工作，跟踪每日任务和重要事项',
    category: 'productivity',
    thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    icon: '📅',
    width: 3200,
    height: 2000,
    backgroundColor: '#f0fdf4',
  },
];

export const createMockBoardFromTemplate = (
  template: Template,
  data: { name: string; ownerId: string }
): Board => {
  const now = new Date().toISOString();
  return {
    _id: `board-${Date.now()}`,
    name: data.name || template.name,
    ownerId: data.ownerId,
    collaborators: [],
    layers: template.layers || [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
    width: template.width,
    height: template.height,
    backgroundColor: template.backgroundColor,
    createdAt: now,
    updatedAt: now,
  };
};

export const templateApi = {
  async getTemplates(): Promise<Template[]> {
    const response = await fetch(TEMPLATE_API_URL);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch templates');
    }
    return response.json();
  },

  async getTemplate(templateId: string): Promise<Template | null> {
    const response = await fetch(`${TEMPLATE_API_URL}/${templateId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch template');
    }
    return response.json();
  },

  async createBoardFromTemplate(
    templateId: string,
    data: { name: string; ownerId: string }
  ): Promise<Board | null> {
    const response = await fetch(`${TEMPLATE_API_URL}/${templateId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await parseErrorBody(response);
      throw new Error(errorData.error || 'Failed to create board from template');
    }
    return response.json();
  },

  async getDrafts(ownerId: string): Promise<TemplateDraftSummary[]> {
    const response = await fetch(`${TEMPLATE_API_URL}/drafts?ownerId=${encodeURIComponent(ownerId)}`);
    if (!response.ok) {
      const errorData = await parseErrorBody(response);
      throw new Error(errorData.error || 'Failed to fetch template drafts');
    }
    return response.json();
  },

  async getDraft(groupId: string, ownerId: string): Promise<TemplateDraftGroup | null> {
    const response = await fetch(
      `${TEMPLATE_API_URL}/drafts/${groupId}?ownerId=${encodeURIComponent(ownerId)}`
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await parseErrorBody(response);
      throw new Error(errorData.error || 'Failed to fetch template draft');
    }
    return response.json();
  },

  async createDraft(data: {
    ownerId: string;
    boardId?: string;
    name?: string;
    content: {
      width: number;
      height: number;
      backgroundColor: string;
      layers: Template['layers'];
    };
  }): Promise<TemplateDraftGroup> {
    const response = await fetch(`${TEMPLATE_API_URL}/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await parseErrorBody(response);
      throw new Error(errorData.error || 'Failed to create template draft');
    }
    return response.json();
  },

  async saveDraft(
    groupId: string,
    version: number,
    data: {
      ownerId: string;
      name: string;
      description: string;
      category: string;
      useCases: string[];
      icon: string;
      thumbnail: string;
    }
  ): Promise<TemplateDraftGroup> {
    const response = await fetch(
      `${TEMPLATE_API_URL}/drafts/${groupId}/versions/${version}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const errorData = await parseErrorBody(response);
      throw new Error(errorData.error || 'Failed to save template draft');
    }
    return response.json();
  },

  async addDraftVersion(
    groupId: string,
    data: { ownerId: string; fromVersion?: number }
  ): Promise<{ group: TemplateDraftGroup; version: TemplateDraftGroup['versions'][number] }> {
    const response = await fetch(`${TEMPLATE_API_URL}/drafts/${groupId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await parseErrorBody(response);
      throw new Error(errorData.error || 'Failed to create template version');
    }
    return response.json();
  },

  async publishDraft(
    groupId: string,
    version: number,
    data: {
      ownerId: string;
      name: string;
      description: string;
      category: string;
      useCases: string[];
      icon: string;
      thumbnail: string;
    }
  ): Promise<{ templateId: string; group: TemplateDraftGroup }> {
    const response = await fetch(
      `${TEMPLATE_API_URL}/drafts/${groupId}/versions/${version}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const errorData = await parseErrorBody(response);
      throw new TemplatePublishError(errorData.error || 'Failed to publish template', {
        status: response.status,
        reason: errorData.reason,
        missingFields: errorData.missingFields,
        existingVersion: errorData.existingVersion,
      });
    }
    return response.json();
  },

  async deleteDraft(groupId: string, ownerId: string): Promise<boolean> {
    const response = await fetch(
      `${TEMPLATE_API_URL}/drafts/${groupId}?ownerId=${encodeURIComponent(ownerId)}`,
      { method: 'DELETE' }
    );
    return response.ok;
  },
};
