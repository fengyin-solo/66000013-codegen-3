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
  useCases?: string[];
  thumbnail: string;
  icon: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers?: Layer[];
  custom?: boolean;
  version?: number;
}

export type TemplateVersionStatus = 'draft' | 'published';

export interface TemplateContent {
  width: number;
  height: number;
  backgroundColor: string;
  layers: Layer[];
}

export interface TemplateVersion {
  version: number;
  status: TemplateVersionStatus;
  name: string;
  description: string;
  category: string;
  useCases: string[];
  icon: string;
  thumbnail: string;
  content?: TemplateContent;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface TemplateDraftGroup {
  _id: string;
  ownerId?: string;
  sourceBoardId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: TemplateVersion[];
}

export interface TemplateDraftSummary {
  _id: string;
  name: string;
  sourceBoardId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: Array<{
    version: number;
    status: TemplateVersionStatus;
    name: string;
    updatedAt: string;
    publishedAt: string | null;
  }>;
}

export interface MissingTemplateField {
  field: string;
  label: string;
}
