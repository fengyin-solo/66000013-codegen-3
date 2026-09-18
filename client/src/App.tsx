import React, { useState, useEffect } from 'react';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { CursorOverlay } from './components/CursorOverlay';
import { Dashboard } from './components/Dashboard';
import { TemplateDraftEditor } from './components/TemplateDraftEditor';
import { useWhiteboardStore } from './store/whiteboard';
import { socketService } from './services/socket';
import { templateApi } from './services/api';
import { Board, BoardElement, CursorPosition, Layer, CanvasTransform, ViewType, TemplateDraftGroup } from './types';

const CURRENT_USER_ID = 'user-1';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [draftGroup, setDraftGroup] = useState<TemplateDraftGroup | null>(null);
  const [draftEditorOpen, setDraftEditorOpen] = useState(false);
  // Bumped when template drafts/featured templates change so views can refresh.
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const {
    setBoard, updateCursor, removeCursor, setCursors, username
  } = useWhiteboardStore();

  useEffect(() => {
    if (currentView === 'board' && activeBoard) {
      setBoard(activeBoard);

      socketService.connect();
      socketService.joinBoard(activeBoard._id, username);

      socketService.onUserJoined((data) => {
        console.log(`${data.username} 加入了白板`);
      });
      socketService.onUserLeft((data) => {
        removeCursor(data.socketId);
      });
      socketService.onActiveUsers((users) => {
        setCursors(users);
      });
      socketService.onCursorUpdate((data: CursorPosition) => {
        updateCursor(data);
      });
      socketService.onElementAdded((data: { element: BoardElement; layerIndex: number }) => {
        const { board: currentBoard } = useWhiteboardStore.getState();
        if (currentBoard) {
          const layers = [...currentBoard.layers];
          layers[data.layerIndex] = {
            ...layers[data.layerIndex],
            elements: [...layers[data.layerIndex].elements, data.element]
          };
          setBoard({ ...currentBoard, layers });
        }
      });
      socketService.onLayersUpdated((data: { layers: Layer[] }) => {
        const { board: currentBoard } = useWhiteboardStore.getState();
        if (currentBoard) {
          setBoard({ ...currentBoard, layers: data.layers });
        }
      });
      socketService.onCanvasTransformed((data: { transform: CanvasTransform }) => {
        useWhiteboardStore.getState().setCanvasTransform(data.transform);
      });

      return () => {
        socketService.disconnect();
      };
    }
  }, [currentView, activeBoard]);

  const handleBoardSelect = (boardItem: Board) => {
    setActiveBoard(boardItem);
    setCurrentView('board');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveBoard(null);
  };

  const openDraftEditor = (group: TemplateDraftGroup) => {
    setDraftGroup(group);
    setDraftEditorOpen(true);
  };

  // Organize the current board into a reusable template draft, then open the
  // editor so use cases / icon / preview can be completed before publishing.
  const handleSaveBoardAsTemplate = async () => {
    const { board } = useWhiteboardStore.getState();
    if (!board || savingTemplate) return;

    try {
      setSavingTemplate(true);
      const group = await templateApi.createDraft({
        ownerId: CURRENT_USER_ID,
        boardId: board._id,
        name: board.name,
        content: {
          width: board.width,
          height: board.height,
          backgroundColor: board.backgroundColor,
          layers: board.layers,
        },
      });
      openDraftEditor(group);
    } catch (error) {
      console.error('Failed to create template draft:', error);
      window.alert('保存为模板草稿失败，请重试');
    } finally {
      setSavingTemplate(false);
    }
  };

  if (currentView === 'dashboard') {
    return (
      <>
        <Dashboard
          onBoardSelect={handleBoardSelect}
          onEditDraft={openDraftEditor}
          templatesRefreshKey={templatesRefreshKey}
        />
        <TemplateDraftEditor
          isOpen={draftEditorOpen}
          group={draftGroup}
          onClose={() => setDraftEditorOpen(false)}
          onGroupChanged={(group) => {
            setDraftGroup(group);
            setTemplatesRefreshKey((key) => key + 1);
          }}
          onPublished={(group) => {
            setDraftGroup(group);
            setTemplatesRefreshKey((key) => key + 1);
          }}
        />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <div style={{
        height: '48px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '12px',
      }}>
        <button
          onClick={handleBackToDashboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#374151',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回工作台
        </button>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#1a1a1a',
        }}>
          {activeBoard?.name}
        </div>
        <button
          onClick={handleSaveBoardAsTemplate}
          disabled={savingTemplate}
          title="把当前白板内容整理为可复用模板（先存草稿，完善信息后发布）"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: 'auto',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#5a67d8',
            background: '#eef2ff',
            border: 'none',
            borderRadius: '6px',
            cursor: savingTemplate ? 'not-allowed' : 'pointer',
            opacity: savingTemplate ? 0.6 : 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {savingTemplate ? '保存中...' : '存为模板'}
        </button>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Toolbar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <WhiteboardCanvas />
          <CursorOverlay />
        </div>
        <LayerPanel />
      </div>
      <TemplateDraftEditor
        isOpen={draftEditorOpen}
        group={draftGroup}
        onClose={() => setDraftEditorOpen(false)}
        onGroupChanged={(group) => {
          setDraftGroup(group);
          setTemplatesRefreshKey((key) => key + 1);
        }}
        onPublished={(group) => {
          setDraftGroup(group);
          setTemplatesRefreshKey((key) => key + 1);
        }}
      />
    </div>
  );
};

export default App;
