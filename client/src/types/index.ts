export interface BoardElement {
  id: string;
  type: 'path' | 'rect' | 'circle' | 'text' | 'sticky-note' | 'line' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  points?: number[];
  rotation?: number;
  opacity?: number;
}

export interface Layer {
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  elements: BoardElement[];
}

export interface Board {
  _id: string;
  name: string;
  ownerId: string;
  collaborators: string[];
  layers: Layer[];
  width: number;
  height: number;
  backgroundColor: string;
  createdAt: string;
  updatedAt: string;
}

export type ViewType = 'dashboard' | 'board';

export interface CursorPosition {
  socketId: string;
  username: string;
  x: number;
  y: number;
}

export interface CanvasTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export type ToolType = 'select' | 'pen' | 'rect' | 'circle' | 'line' | 'text' | 'sticky-note' | 'eraser';

export interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  icon: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers?: Layer[];
}

export interface TemplateVersion {
  versionId: string;
  versionNumber: number;
  note: string;
  snapshot: {
    width: number;
    height: number;
    backgroundColor: string;
    layers: Layer[];
  };
  createdAt: string;
}

export interface TemplateDraft {
  _id: string;
  name: string;
  ownerId: string;
  sourceBoardId: string;
  status: 'draft' | 'published';
  scenario: string;
  icon: string;
  preview: string;
  category: string;
  versions: TemplateVersion[];
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishResult {
  template: Template;
  duplicated: boolean;
}
