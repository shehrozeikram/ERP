import { useCallback, useEffect, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

/**
 * Zoom + pan state for image preview modals (same behavior as Utility Bill bill image viewer).
 * @param {unknown} resetKey - change to reset zoom/pan (e.g. image src or slide index)
 */
export function useZoomPanImage(resetKey) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState({ active: false, startX: 0, startY: 0 });

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragState({ active: false, startX: 0, startY: 0 });
  }, []);

  useEffect(() => {
    resetView();
  }, [resetKey, resetView]);

  const changeZoom = useCallback((delta) => {
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev + delta).toFixed(2))));
  }, []);

  const zoomIn = useCallback(() => changeZoom(ZOOM_STEP), [changeZoom]);
  const zoomOut = useCallback(() => changeZoom(-ZOOM_STEP), [changeZoom]);

  const startDrag = useCallback(
    (event) => {
      if (zoom <= 1) return;
      event.preventDefault();
      setDragState({
        active: true,
        startX: event.clientX - offset.x,
        startY: event.clientY - offset.y
      });
    },
    [zoom, offset.x, offset.y]
  );

  const onDrag = useCallback(
    (event) => {
      if (!dragState.active) return;
      setOffset({
        x: event.clientX - dragState.startX,
        y: event.clientY - dragState.startY
      });
    },
    [dragState.active, dragState.startX, dragState.startY]
  );

  const stopDrag = useCallback(() => {
    setDragState((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, []);

  const containerSx = {
    overflow: 'auto',
    cursor: zoom > 1 ? (dragState.active ? 'grabbing' : 'grab') : 'default'
  };

  const imageSx = {
    maxWidth: '100%',
    maxHeight: '70vh',
    objectFit: 'contain',
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
    transition: dragState.active ? 'none' : 'transform 0.15s ease',
    userSelect: 'none',
    display: 'block',
    margin: '0 auto'
  };

  return {
    zoom,
    changeZoom,
    zoomIn,
    zoomOut,
    resetView,
    startDrag,
    onDrag,
    stopDrag,
    containerSx,
    imageSx,
    containerHandlers: {
      onMouseMove: onDrag,
      onMouseUp: stopDrag,
      onMouseLeave: stopDrag
    }
  };
}
