import React, { useState, useRef } from 'react';

export interface PinchZoomPanProps {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
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
 * wheel zoom, double-tap zoom, and accessible M3 zoom controls.
 */
export function PinchZoomPan({
  minScale = 1,
  maxScale = 3.5,
  initialScale = 1,
  isDarkMode = true,
  className = '',
  children,
}: PinchZoomPanProps) {
  const [scale, setScale] = useState<number>(initialScale);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Number(clamp(prev + 0.4, minScale, maxScale).toFixed(2)));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => {
      const next = Number(clamp(prev - 0.4, minScale, maxScale).toFixed(2));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoomPan = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setScale((prev) => {
      const next = Number(clamp(prev + delta, minScale, maxScale).toFixed(2));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
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
    const maxOffset = Math.max(24, (scale - 1) * 90);
    setPan({
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
        const nextScale = Number(
          clamp(pinchStartRef.current.scale * ratio, minScale, maxScale).toFixed(2)
        );
        setScale(nextScale);
      }
    } else if (e.touches.length === 1 && dragStartRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      const maxOffset = Math.max(24, (scale - 1) * 90);
      setPan({
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
      setScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      setScale(1.8);
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
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
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

      {/* Material 3 Pinch-Zoom & Pan Controls Overlay */}
      <div
        data-testid="map-pinch-zoom-controls"
        className={`absolute top-1.5 left-1.5 z-20 flex items-center gap-1 rounded-lg px-1.5 py-0.5 border font-['Cairo',sans-serif] shadow-sm ${
          isDarkMode
            ? 'bg-slate-950/90 border-slate-700/80 text-slate-200'
            : 'bg-slate-100/95 border-slate-300 text-slate-800'
        }`}
      >
        <button
          type="button"
          data-testid="map-zoom-in-btn"
          aria-label="Zoom In Map"
          title="Zoom In • تكبير الخريطة"
          onClick={handleZoomIn}
          className="px-1.5 py-0.5 rounded text-[10px] font-black hover:text-amber-400 transition-colors cursor-pointer"
        >
          +
        </button>
        <span
          data-testid="map-zoom-scale-badge"
          className="text-[9px] font-mono font-bold text-amber-400 px-0.5"
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          data-testid="map-zoom-out-btn"
          aria-label="Zoom Out Map"
          title="Zoom Out • تصغير الخريطة"
          onClick={handleZoomOut}
          className="px-1.5 py-0.5 rounded text-[10px] font-black hover:text-amber-400 transition-colors cursor-pointer"
        >
          −
        </button>
        {(scale !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <button
            type="button"
            data-testid="map-zoom-reset-btn"
            aria-label="Reset Map Zoom and Pan"
            title="Reset View • إعادة ضبط"
            onClick={handleResetZoomPan}
            className="px-1 py-0.5 rounded text-[9px] font-bold text-amber-400 hover:underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
