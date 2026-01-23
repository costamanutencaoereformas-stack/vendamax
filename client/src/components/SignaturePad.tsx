import React, { useEffect, useRef, useState } from "react";

export interface SignaturePadProps {
  width?: number;
  height?: number;
  className?: string;
  lineWidth?: number;
  strokeStyle?: string;
  backgroundColor?: string;
  onChange?: (dataUrl: string | null) => void;
}

export default function SignaturePad({
  width = 420,
  height = 160,
  className,
  lineWidth = 2,
  strokeStyle = "#111827",
  backgroundColor = "#ffffff",
  onChange,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // init background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [backgroundColor]);

  function getPos(e: MouseEvent | TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if (e instanceof TouchEvent) {
      clientX = e.touches[0]?.clientX ?? 0;
      clientY = e.touches[0]?.clientY ?? 0;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const pos = getPos((e.nativeEvent as unknown) as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos((e.nativeEvent as unknown) as MouseEvent | TouchEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStroke(true);
  }

  function end(e?: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current!;
    if (onChange) {
      onChange(hasStroke ? canvas.toDataURL("image/png") : null);
    }
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    if (onChange) onChange(null);
  }

  return (
    <div className={"inline-flex flex-col gap-2 " + (className || "") }>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ border: "1px solid #e5e7eb", borderRadius: 8, touchAction: "none", background: backgroundColor }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="px-3 py-1.5 border rounded text-sm">Limpar</button>
      </div>
    </div>
  );
}
