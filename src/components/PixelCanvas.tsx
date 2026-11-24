"use client";

import { useEffect, useRef, useState } from "react";
import {
  floodFill,
  renderDocumentToCanvas,
  TRANSPARENT,
} from "@/lib/render";
import { loadImage, nearestPaletteIndex } from "@/lib/slice";
import { type Point, type Tool } from "@/lib/types";
import { useStudio } from "@/store/studio";

type Draft = {
  partId: string;
  pixels: number[];
  last: Point;
};

type Selection = {
  mode: "rect" | "lasso";
  start: Point;
  current: Point;
  points: Point[];
};

const TOOL_HINTS: Record<Tool, string> = {
  select: "Select a part from the panel",
  pencil: "Draw on the selected part",
  eraser: "Erase pixels on the selected part",
  fill: "Flood-fill the selected part",
  eyedropper: "Pick a palette color",
  "slice-rect": "Drag over the reference to slice a part",
  "slice-lasso": "Draw around the reference to slice a part",
};

function setPixel(
  pixels: number[],
  width: number,
  height: number,
  x: number,
  y: number,
  value: number,
  brush: number,
) {
  const radius = Math.floor(brush / 2);
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const px = x + offsetX;
      const py = y + offsetY;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      pixels[py * width + px] = value;
    }
  }
}

function paintLine(
  pixels: number[],
  width: number,
  height: number,
  from: Point,
  to: Point,
  value: number,
  brush: number,
) {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    setPixel(pixels, width, height, x, y, value, brush);
    if (x === to.x && y === to.y) break;
    const e2 = 2 * error;
    if (e2 > -dy) {
      error -= dy;
      x += sx;
    }
    if (e2 < dx) {
      error += dx;
      y += sy;
    }
  }
}

export default function PixelCanvas({
  onSlice,
}: {
  onSlice?: (points: Point[]) => void;
}) {
  const doc = useStudio((state) => state.doc);
  const selectedPartId = useStudio((state) => state.selectedPartId);
  const tool = useStudio((state) => state.tool);
  const colorIndex = useStudio((state) => state.colorIndex);
  const brushSize = useStudio((state) => state.brushSize);
  const frameIndex = useStudio((state) => state.frameIndex);
  const playing = useStudio((state) => state.playing);
  const onionSkin = useStudio((state) => state.onionSkin);
  const framePaint = useStudio((state) => state.framePaint);
  const showReference = useStudio((state) => state.showReference);
  const setPartPixels = useStudio((state) => state.setPartPixels);
  const setFramePartPixels = useStudio((state) => state.setFramePartPixels);
  const setColorIndex = useStudio((state) => state.setColorIndex);
  const setFrameIndex = useStudio((state) => state.setFrameIndex);
  const setPlaying = useStudio((state) => state.setPlaying);
  const setShowReference = useStudio((state) => state.setShowReference);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const referenceRef = useRef<HTMLImageElement | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [referenceReady, setReferenceReady] = useState(0);

  const animation =
    doc?.animations.find((entry) => entry.id === doc.currentAnimationId) ??
    doc?.animations[0] ??
    null;
  const frame = animation?.frames[frameIndex] ?? null;
  const previousFrame = animation?.frames[frameIndex - 1] ?? null;
  const paintingFrame = Boolean(framePaint && frame);
  const commitPixels = (partId: string, pixels: number[]) => {
    if (paintingFrame) setFramePartPixels(partId, pixels);
    else setPartPixels(partId, pixels);
  };

  useEffect(() => {
    let cancelled = false;
    if (!doc?.reference?.dataUrl) {
      referenceRef.current = null;
      return () => {
        cancelled = true;
      };
    }
    void loadImage(doc.reference.dataUrl).then((image) => {
      if (cancelled) return;
      referenceRef.current = image;
      setReferenceReady((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [doc?.reference?.dataUrl]);

  useEffect(() => {
    if (!playing || !animation) return;
    const timer = window.setInterval(() => {
      const next = frameIndex + 1;
      if (next >= animation.frames.length) {
        if (animation.loop) setFrameIndex(0);
        else setPlaying(false);
      } else {
        setFrameIndex(next);
      }
    }, Math.max(60, 1000 / Math.max(1, animation.fps)));
    return () => window.clearInterval(timer);
  }, [playing, animation, frameIndex, setFrameIndex, setPlaying]);

  function drawSelection(context: CanvasRenderingContext2D) {
    const selection = selectionRef.current;
    if (!selection) return;
    context.save();
    context.strokeStyle = "#c7f36b";
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    context.beginPath();
    if (selection.mode === "rect") {
      const minX = Math.min(selection.start.x, selection.current.x);
      const minY = Math.min(selection.start.y, selection.current.y);
      const maxX = Math.max(selection.start.x, selection.current.x);
      const maxY = Math.max(selection.start.y, selection.current.y);
      context.rect(minX, minY, maxX - minX, maxY - minY);
    } else {
      selection.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
    }
    context.stroke();
    context.restore();
  }

  function drawNow() {
    if (!doc || !canvasRef.current) return;
    const draftPixels = draftRef.current
      ? { [draftRef.current.partId]: draftRef.current.pixels }
      : undefined;
    renderDocumentToCanvas(doc, frame, canvasRef.current, {
      referenceImage: referenceRef.current,
      showReference,
      draftPixels,
      onionFrame: onionSkin ? previousFrame : null,
    });

    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    if (showGrid) {
      context.save();
      context.strokeStyle = "rgba(255,255,255,0.09)";
      context.lineWidth = 1;
      const step = Math.max(4, Math.round(doc.width / 8));
      for (let x = step; x < doc.width; x += step) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, doc.height);
        context.stroke();
      }
      for (let y = step; y < doc.height; y += step) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(doc.width, y);
        context.stroke();
      }
      context.restore();
    }
    drawSelection(context);
  }

  useEffect(() => {
    drawNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doc,
    frame,
    frameIndex,
    referenceReady,
    showReference,
    onionSkin,
    showGrid,
  ]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          doc.width - 1,
          Math.floor(((event.clientX - rect.left) / rect.width) * doc.width),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          doc.height - 1,
          Math.floor(((event.clientY - rect.top) / rect.height) * doc.height),
        ),
      ),
    };
  }

  function beginDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!doc) return;
    const point = pointFromEvent(event);
    const part = doc.parts.find((entry) => entry.id === selectedPartId);

    if (tool === "eyedropper") {
      const context = canvasRef.current?.getContext("2d");
      if (!context) return;
      const pixel = context.getImageData(point.x, point.y, 1, 1).data;
      if (pixel[3] < 8) return;
      setColorIndex(
        nearestPaletteIndex(pixel[0], pixel[1], pixel[2], doc.spec.palette),
      );
      return;
    }

    if (tool === "fill") {
      if (!part) return;
      const basePixels = paintingFrame
        ? frame?.pixels?.[part.id] ?? part.pixels
        : part.pixels;
      commitPixels(
        part.id,
        floodFill(basePixels, doc.width, doc.height, point.x, point.y, colorIndex),
      );
      return;
    }

    if (tool === "slice-rect" || tool === "slice-lasso") {
      if (!doc.reference) return;
      selectionRef.current =
        tool === "slice-rect"
          ? {
              mode: "rect",
              start: point,
              current: point,
              points: [],
            }
          : {
              mode: "lasso",
              start: point,
              current: point,
              points: [point],
            };
      event.currentTarget.setPointerCapture(event.pointerId);
      drawNow();
      return;
    }

    if (tool !== "pencil" && tool !== "eraser") return;
    if (!part) return;
    draftRef.current = {
      partId: part.id,
      pixels: [
        ...(paintingFrame ? frame?.pixels?.[part.id] ?? part.pixels : part.pixels),
      ],
      last: point,
    };
    paintLine(
      draftRef.current.pixels,
      doc.width,
      doc.height,
      point,
      point,
      tool === "eraser" ? TRANSPARENT : colorIndex,
      brushSize,
    );
    event.currentTarget.setPointerCapture(event.pointerId);
    drawNow();
  }

  function continueDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!doc) return;
    const point = pointFromEvent(event);

    if (selectionRef.current) {
      selectionRef.current.current = point;
      if (selectionRef.current.mode === "lasso") {
        const last =
          selectionRef.current.points[selectionRef.current.points.length - 1];
        if (!last || last.x !== point.x || last.y !== point.y) {
          selectionRef.current.points.push(point);
        }
      }
      drawNow();
      return;
    }

    const draft = draftRef.current;
    if (!draft) return;
    paintLine(
      draft.pixels,
      doc.width,
      doc.height,
      draft.last,
      point,
      tool === "eraser" ? TRANSPARENT : colorIndex,
      brushSize,
    );
    draft.last = point;
    drawNow();
  }

  function endDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (selectionRef.current) {
      const selection = selectionRef.current;
      const points =
        selection.mode === "rect"
          ? [
              selection.start,
              { x: selection.current.x, y: selection.start.y },
              selection.current,
              { x: selection.start.x, y: selection.current.y },
            ]
          : selection.points;
      selectionRef.current = null;
      const duplicate =
        points.length > 1 &&
        points.every(
          (point) => point.x === points[0].x && point.y === points[0].y,
        );
      if (!duplicate && points.length >= 3) onSlice?.(points);
      drawNow();
      return;
    }

    const draft = draftRef.current;
    if (!draft) return;
    draftRef.current = null;
    commitPixels(draft.partId, draft.pixels);
    event.currentTarget.releasePointerCapture(event.pointerId);
    requestAnimationFrame(drawNow);
  }

  if (!doc) return null;

  const displayWidth = Math.min(
    760,
    Math.max(320, doc.width * 8),
  );
  const displayHeight = (displayWidth * doc.height) / doc.width;

  return (
    <div className="canvas-panel">
      <div className="canvas-meta">
        <div className="canvas-badge">
          {doc.width} × {doc.height}
        </div>
        <div className="canvas-meta-note">{TOOL_HINTS[tool]}</div>
        <div className="canvas-meta-actions">
          <button
            type="button"
            className={`mini-toggle${showGrid ? " active" : ""}`}
            onClick={() => setShowGrid((value) => !value)}
          >
            Grid
          </button>
          {doc.reference ? (
            <button
              type="button"
              className={`mini-toggle${showReference ? " active" : ""}`}
              onClick={() => setShowReference(!showReference)}
            >
              Reference
            </button>
          ) : null}
        </div>
      </div>

      <div className="canvas-frame">
        <div
          className="canvas-checker"
          style={{ width: displayWidth, height: displayHeight }}
        >
          <canvas
            ref={canvasRef}
            className={`pixel-canvas tool-${tool}`}
            style={{ width: displayWidth, height: displayHeight }}
            onPointerDown={beginDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={endDrawing}
            onPointerCancel={endDrawing}
            onContextMenu={(event) => event.preventDefault()}
          />
        </div>
      </div>

      <div className="canvas-footer">
        <span>
          {selectedPartId
            ? doc.parts.find((part) => part.id === selectedPartId)?.name
            : "No part selected"}
        </span>
        <span>
          {animation
            ? `${animation.name} · frame ${frameIndex + 1}/${animation.frames.length}`
            : "Static base · generate an animation below"}
        </span>
      </div>
    </div>
  );
}
