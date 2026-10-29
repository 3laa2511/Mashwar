import React, { useState, useRef } from 'react';

export interface PinchZoomPanProps {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  scale?: number;
  onScaleChange?: (nextScale: number) => void;
  pan?: { x: number; y: number };
  onPanChange?: (nextPan: { x: number; y: number }) => void;
  showControls?: boolean;
  isDarkMode?: boolean;
  className?: string;
  children: React.ReactNode;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getTouchDistance(touches: React.TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/**
 * Material 3 compatible Pinch-to-Zoom and Pan interactive surface
 * supporting two-finger pinch gestures, pointer/touch drag panning,
 * wheel zoom, double-tap zoom, and touch-optimized Slate/Cairo '+' and '-' overlay buttons.
 */
export function PinchZoomPan({
  minScale = 1,
  maxScale = 3.5,
  initialScale = 1,
  scale: controlledScale,
  onScaleChange,
  pan: controlledPan,
  onPanChange,
  showControls = true,
  isDarkMode = true,
  className = '',
  children,
}: PinchZoomPanProps) {
  const [internalScale, setInternalScale] = useState<number>(initialScale);
  const [internalPan, setInternalPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const scale = typeof controlledScale === 'number' ? controlledScale : internalScale;
  const pan = controlledPan ?? internalPan;

  const updatePan = (nextPan: { x: number; y: number }) => {
    setInternalPan(nextPan);
    if (onPanChange) {
      onPanChange(nextPan);
    }
  };

  const updateScale = (updater: number | ((prev: number) => number)) => {
    const nextRaw = typeof updater === 'function' ? updater(scale) : updater;
    const nextClamped = Number(clamp(nextRaw, minScale, maxScale).toFixed(2));
    setInternalScale(nextClamped);
    if (onScaleChange) {
      onScaleChange(nextClamped);
    }
    if (nextClamped <= 1) {
      updatePan({ x: 0, y: 0 });
    }
  };

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateScale((prev) => prev + 0.4);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateScale((prev) => prev - 0.4);
  };

  const handleResetZoomPan = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateScale(1);
    updatePan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    updateScale((prev) => prev + delta);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxOffset = Math.max(48, (scale - 1) * 90);
    updatePan({
      x: clamp(dragStartRef.current.panX + dx, -maxOffset, maxOffset),
      y: clamp(dragStartRef.current.panY + dy, -maxOffset, maxOffset),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      if (dist > 0) {
        pinchStartRef.current = { distance: dist, scale };
      }
    } else if (e.touches.length === 1) {
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      const currentDist = getTouchDistance(e.touches);
      if (currentDist > 0 && pinchStartRef.current.distance > 0) {
        const ratio = currentDist / pinchStartRef.current.distance;
        updateScale(pinchStartRef.current.scale * ratio);
      }
    } else if (e.touches.length === 1 && dragStartRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      const maxOffset = Math.max(48, (scale - 1) * 90);
      updatePan({
        x: clamp(dragStartRef.current.panX + dx, -maxOffset, maxOffset),
        y: clamp(dragStartRef.current.panY + dy, -maxOffset, maxOffset),
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStartRef.current = null;
    dragStartRef.current = null;
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      updateScale(1);
      updatePan({ x: 0, y: 0 });
    } else {
      updateScale(1.8);
    }
  };

  return (
    <div
      data-testid="pinch-zoom-pan-container"
      data-zoom-scale={scale.toFixed(2)}
      data-pan-x={Math.round(pan.x)}
      data-pan-y={Math.round(pan.y)}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden select-none touch-none font-['Cairo',sans-serif] ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
    >
      <div
        data-testid="pinch-zoom-pan-viewport"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className="w-full h-full transition-transform duration-150 ease-out"
      >
        {children}
      </div>

      {/* Touch-Optimized Material 3 '+' and '-' Overlay Controls (Slate/Cairo Design System) */}
      {showControls && (
        <div
          data-testid="map-pinch-zoom-controls"
          role="group"
          aria-label="Map Zoom Controls"
          className={`absolute top-1.5 left-1.5 z-20 flex items-center gap-1 rounded-xl p-1 border font-['Cairo',sans-serif] shadow-md backdrop-blur-xs ${
            isDarkMode
              ? 'bg-slate-950/95 border-slate-700/90 text-slate-100'
              : 'bg-slate-900/90 border-slate-700 text-slate-100'
          }`}
        >
          <button
            type="button"
            data-testid="map-zoom-in-btn"
            aria-label="Zoom In Map (+)"
            title="Zoom In (+) • تكبير الخريطة"
            disabled={scale >= maxScale}
            onClick={handleZoomIn}
            className="min-w-[32px] min-h-[32px] px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 hover:text-amber-400 disabled:opacity-40 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center shadow-xs transform hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
          >
            +
          </button>
          <span
            data-testid="map-zoom-scale-badge"
            className="text-[10px] font-mono font-bold text-amber-400 px-1 select-none"
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            data-testid="map-zoom-out-btn"
            aria-label="Zoom Out Map (-)"
            title="Zoom Out (-) • تصغير الخريطة"
            disabled={scale <= minScale}
            onClick={handleZoomOut}
            className="min-w-[32px] min-h-[32px] px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 hover:text-amber-400 disabled:opacity-40 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center shadow-xs transform hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
          >
            -
          </button>
          {(scale !== 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              type="button"
              data-testid="map-zoom-reset-btn"
              aria-label="Reset Map Zoom and Pan"
              title="Reset View • إعادة ضبط"
              onClick={handleResetZoomPan}
              className="min-h-[32px] px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold font-['Cairo',sans-serif] text-amber-400 hover:text-amber-300 transition-all cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
