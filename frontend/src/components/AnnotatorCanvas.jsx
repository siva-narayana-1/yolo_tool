import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect } from 'react-konva';
import useImage from 'use-image';

function perpendicularDistance(point, lineStart, lineEnd) {
    let dx = lineEnd.x - lineStart.x;
    let dy = lineEnd.y - lineStart.y;
    if (dx === 0 && dy === 0) {
        dx = point.x - lineStart.x;
        dy = point.y - lineStart.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    if (t < 0) {
        dx = point.x - lineStart.x;
        dy = point.y - lineStart.y;
    } else if (t > 1) {
        dx = point.x - lineEnd.x;
        dy = point.y - lineEnd.y;
    } else {
        const closestPointX = lineStart.x + t * dx;
        const closestPointY = lineStart.y + t * dy;
        dx = point.x - closestPointX;
        dy = point.y - closestPointY;
    }
    return Math.sqrt(dx * dx + dy * dy);
}

function rdp(points, epsilon) {
    if (points.length < 3) return points;
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;
    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }
    if (dmax > epsilon) {
        const recResults1 = rdp(points.slice(0, index + 1), epsilon);
        const recResults2 = rdp(points.slice(index), epsilon);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [points[0], points[end]];
    }
}

function AnnotatorCanvas({ imageUrl, polygons, activeTool, samSession, onSamBox, onSamPoint, onManualDraw, onDeleteShape, classes, selectedClassId, selectedShapeIndex, setSelectedShapeIndex, updateShapePoints, updateShapePointsLocal }) {
  const [image] = useImage(imageUrl);
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  
  // Manual Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftRect, setDraftRect] = useState(null); // {startX, startY, endX, endY}
  const [draftPolygon, setDraftPolygon] = useState([]); // array of {x, y}

  useEffect(() => {
    // Reset temporary states when image changes
    setDraftRect(null);
    setDraftPolygon([]);
    setIsDrawing(false);
    setStagePos({ x: 0, y: 0 });
    setStageScale(1);
  }, [imageUrl]);

  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    }
  }, []);

  const handleResize = () => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Keyboard shortcuts for drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTool === 'polygon') {
        if (e.key === 'Enter') {
            console.log("Enter pressed. draftPolygon length:", draftPolygon.length);
            if (draftPolygon.length >= 3) {
                const pointsArray = draftPolygon.map(p => [p.x, p.y]);
                console.log("Finishing polygon via Enter with points:", pointsArray);
                onManualDraw(pointsArray);
                setDraftPolygon([]);
            } else {
                console.log("Not enough points to finish polygon.");
            }
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'z') {
            // Undo last point
            setDraftPolygon(prev => {
                if (prev.length === 0) return prev;
                return prev.slice(0, -1);
            });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, draftPolygon, onManualDraw]);

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (image) {
    const scaleX = dimensions.width / image.width;
    const scaleY = dimensions.height / image.height;
    scale = Math.min(scaleX, scaleY) * 0.9;
    offsetX = (dimensions.width - image.width * scale) / 2;
    offsetY = (dimensions.height - image.height * scale) / 2;
  }

  const getRelativePointerPosition = () => {
    const stage = stageRef.current;
    if (!stage || !image) return null;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    const stagePos = transform.point(pos);
    const x = (stagePos.x - offsetX) / (image.width * scale);
    const y = (stagePos.y - offsetY) / (image.height * scale);
    return { x, y };
  };

  const isWithinImage = (pos) => {
    return pos && pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1;
  };

  // -------------------------
  // MOUSE EVENTS
  // -------------------------

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    if (newScale < 0.1 || newScale > 20) return;

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleMouseDown = (e) => {
    if (e.evt.button === 2 && activeTool !== 'sam') return; // Ignore right click unless SAM
    const pos = getRelativePointerPosition();
    if (!isWithinImage(pos)) return;

    if (activeTool === 'rect' || (activeTool === 'sam' && !samSession)) {
      if (e.evt.button === 2) return; // Only left click for drawing boxes
      setIsDrawing(true);
      setDraftRect({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
    } else if (activeTool === 'freehand') {
      setIsDrawing(true);
      setDraftPolygon([pos]);
    }
  };

  const handleMouseMove = (e) => {
    const pos = getRelativePointerPosition();
    if (!pos) return;

    // Clamp coordinates so you can't draw outside image
    const cx = Math.max(0, Math.min(1, pos.x));
    const cy = Math.max(0, Math.min(1, pos.y));

    if ((activeTool === 'rect' || (activeTool === 'sam' && !samSession)) && isDrawing) {
      setDraftRect(prev => ({ ...prev, endX: cx, endY: cy }));
    } else if (activeTool === 'freehand' && isDrawing) {
      setDraftPolygon(prev => {
        if (prev.length === 0) return [pos];
        const last = prev[prev.length - 1];
        // Only record point if the mouse has moved enough (0.5% distance) to prevent enormous arrays
        const dist = Math.sqrt(Math.pow(pos.x - last.x, 2) + Math.pow(pos.y - last.y, 2));
        if (dist > 0.002) {
          return [...prev, pos];
        }
        return prev;
      });
    }
  };

  const handleMouseUp = (e) => {
    const pos = getRelativePointerPosition();
    if (!pos) return;
    const cx = Math.max(0, Math.min(1, pos.x));
    const cy = Math.max(0, Math.min(1, pos.y));

    if ((activeTool === 'rect' || (activeTool === 'sam' && !samSession)) && isDrawing && draftRect) {
      setIsDrawing(false);
      
      // Calculate 4 points of the rectangle
      const x1 = Math.min(draftRect.startX, draftRect.endX);
      const y1 = Math.min(draftRect.startY, draftRect.endY);
      const x2 = Math.max(draftRect.startX, draftRect.endX);
      const y2 = Math.max(draftRect.startY, draftRect.endY);

      console.log("Box mouse up. Box dimensions:", Math.abs(x2 - x1), Math.abs(y2 - y1));

      // Avoid extremely tiny accidental clicks
      if (Math.abs(x2 - x1) > 0.001 && Math.abs(y2 - y1) > 0.001) {
        if (activeTool === 'sam') {
            console.log("Sending bbox to SAM:", [x1, y1, x2, y2]);
            onSamBox([x1, y1, x2, y2]);
        } else {
            console.log("Box is large enough, calling onManualDraw");
            onManualDraw([
              [x1, y1],
              [x2, y1],
              [x2, y2],
              [x1, y2]
            ]);
        }
      } else {
        console.log("Box too small, ignoring.");
      }
      setDraftRect(null);
    } else if (activeTool === 'sam' && samSession && isWithinImage(pos)) {
        // Intercept click to add positive/negative point prompts
        const label = e.evt.button === 2 ? 0 : 1; // 0 = negative, 1 = positive
        onSamPoint({ x: cx, y: cy, label });
    } else if (activeTool === 'freehand' && isDrawing) {
      setIsDrawing(false);
      if (draftPolygon.length >= 3) {
        console.log("Finishing freehand polygon");
        // Simplify the polygon using RDP to heavily reduce the number of anchor points
        const simplified = rdp(draftPolygon, 0.002); 
        const pointsArray = simplified.map(p => [p.x, p.y]);
        console.log(`Simplified from ${draftPolygon.length} to ${simplified.length} points`);
        onManualDraw(pointsArray);
      }
      setDraftPolygon([]); // Reset
    }
  };

  const handleClick = (e) => {
    const pos = getRelativePointerPosition();
    if (!isWithinImage(pos)) return;

    if (activeTool === 'polygon') {
      if (draftPolygon.length >= 3) {
        const firstPoint = draftPolygon[0];
        const dx = pos.x - firstPoint.x;
        const dy = pos.y - firstPoint.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // If they click within 3% of the first point, close the polygon
        if (dist < 0.03) {
            console.log("Clicked near first point. Closing polygon...");
            const pointsArray = draftPolygon.map(p => [p.x, p.y]);
            onManualDraw(pointsArray);
            setDraftPolygon([]); // Reset
            return;
        }
      }
      console.log("Adding polygon point:", pos);
      setDraftPolygon(prev => [...prev, pos]);
    }
  };

  const handleDblClick = (e) => {
    console.log("Double click detected. activeTool:", activeTool, "draftPolygon length:", draftPolygon.length);
    if (activeTool === 'polygon' && draftPolygon.length >= 3) {
      // Close polygon
      const pointsArray = draftPolygon.map(p => [p.x, p.y]);
      console.log("Finishing polygon via Double Click with points:", pointsArray);
      onManualDraw(pointsArray);
      setDraftPolygon([]); // Reset
    }
  };

  const handleContextMenu = (e) => {
    e.evt.preventDefault();
  };

  const getClassColor = (classId) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.color : '#ffffff';
  };

  // Convert normalized [0..1] coordinates to screen pixels
  const toScreenXY = (x, y) => {
    return [
      offsetX + x * (image?.width || 1) * scale,
      offsetY + y * (image?.height || 1) * scale
    ];
  };

  let cursorStyle = 'default';
  if (activeTool === 'pan') cursorStyle = 'grab';
  if (activeTool === 'sam') cursorStyle = 'crosshair';
  if (activeTool === 'rect' || activeTool === 'polygon' || activeTool === 'freehand') cursorStyle = 'crosshair';

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <Stage 
        width={dimensions.width} 
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        ref={stageRef}
        onWheel={handleWheel}
        draggable={activeTool === 'pan'}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onContextMenu={handleContextMenu}
        style={{ cursor: cursorStyle }}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              x={offsetX}
              y={offsetY}
              width={image.width * scale}
              height={image.height * scale}
            />
          )}

          {/* Existing Finished Polygons */}
          {polygons.map((poly, idx) => {
            const flatPoints = poly.points.reduce((acc, pt) => {
              const [sx, sy] = toScreenXY(pt[0], pt[1]);
              acc.push(sx, sy);
              return acc;
            }, []);

            return (
              <React.Fragment key={idx}>
              <Line
                points={flatPoints}
                closed={true}
                stroke={getClassColor(poly.classId)}
                strokeWidth={3}
                fill={`${getClassColor(poly.classId)}80`}
                onContextMenu={(e) => {
                    e.cancelBubble = true; 
                    e.evt.preventDefault();
                    if (onDeleteShape) {
                        onDeleteShape(idx);
                    }
                }}
                onClick={(e) => {
                    if (activeTool === 'select' && setSelectedShapeIndex) {
                        e.cancelBubble = true;
                        setSelectedShapeIndex(idx);
                    }
                }}
              />
              
              {/* Draggable Anchors for Selected Shape */}
              {selectedShapeIndex === idx && poly.points.map((pt, ptIdx) => {
                const [sx, sy] = toScreenXY(pt[0], pt[1]);
                return (
                    <Circle
                        key={`anchor-${idx}-${ptIdx}`}
                        x={sx}
                        y={sy}
                        radius={5}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth={1}
                        draggable={true}
                        onMouseDown={(e) => { e.cancelBubble = true; }}
                        onMouseUp={(e) => { e.cancelBubble = true; }}
                        onClick={(e) => { e.cancelBubble = true; }}
                        onDragMove={(e) => {
                            if (!updateShapePointsLocal) return;
                            const pos = getRelativePointerPosition();
                            if (!pos) return;
                            const nx = Math.max(0, Math.min(1, pos.x));
                            const ny = Math.max(0, Math.min(1, pos.y));
                            const newPoints = [...poly.points];
                            newPoints[ptIdx] = [nx, ny];
                            updateShapePointsLocal(idx, newPoints);
                        }}
                        onDragEnd={(e) => {
                            e.cancelBubble = true;
                            if (!updateShapePoints) return;
                            const pos = getRelativePointerPosition();
                            if (!pos) return;
                            const nx = Math.max(0, Math.min(1, pos.x));
                            const ny = Math.max(0, Math.min(1, pos.y));
                            const newPoints = [...poly.points];
                            newPoints[ptIdx] = [nx, ny];
                            updateShapePoints(idx, newPoints);
                        }}
                    />
                );
              })}
            </React.Fragment>
            );
          })}

          {/* Draft Rectangle */}
          {draftRect && (
            <Rect 
              x={toScreenXY(Math.min(draftRect.startX, draftRect.endX), 0)[0]}
              y={toScreenXY(0, Math.min(draftRect.startY, draftRect.endY))[1]}
              width={Math.abs(draftRect.endX - draftRect.startX) * image.width * scale}
              height={Math.abs(draftRect.endY - draftRect.startY) * image.height * scale}
              stroke={getClassColor(selectedClassId)}
              fill={`${getClassColor(selectedClassId)}80`}
              strokeWidth={2}
              dash={[5, 5]}
            />
          )}

          {/* SAM Session Box & Points & Mask */}
          {samSession && (
            <>
              {samSession.currentMask && (
                <Line
                    points={samSession.currentMask.reduce((acc, pt) => {
                      const [sx, sy] = toScreenXY(pt[0], pt[1]);
                      acc.push(sx, sy);
                      return acc;
                    }, [])}
                    closed={true}
                    fill="rgba(255, 255, 255, 0.5)"
                    stroke="#fff"
                    strokeWidth={2}
                    listening={false}
                />
              )}
              <Rect 
                x={toScreenXY(samSession.bbox[0], 0)[0]}
                y={toScreenXY(0, samSession.bbox[1])[1]}
                width={(samSession.bbox[2] - samSession.bbox[0]) * image.width * scale}
                height={(samSession.bbox[3] - samSession.bbox[1]) * image.height * scale}
                stroke="#10b981"
                strokeWidth={1}
                dash={[5, 5]}
              />
              {samSession.points.map((pt, idx) => {
                 const [sx, sy] = toScreenXY(pt.x, pt.y);
                 return (
                  <Circle
                    key={`sam-pt-${idx}`}
                    x={sx}
                    y={sy}
                    radius={4}
                    fill={pt.label === 1 ? '#10b981' : '#ef4444'}
                    stroke="#fff"
                    strokeWidth={1}
                    onMouseDown={(e) => { e.cancelBubble = true; }}
                    onMouseUp={(e) => { e.cancelBubble = true; }}
                    onClick={(e) => { e.cancelBubble = true; }}
                  />
                 )
              })}
            </>
          )}

          {/* Draft Polygon */}
          {draftPolygon.length > 0 && (
            <>
              <Line
                points={draftPolygon.reduce((acc, pt) => {
                  const [sx, sy] = toScreenXY(pt.x, pt.y);
                  acc.push(sx, sy);
                  return acc;
                }, [])}
                closed={activeTool === 'freehand' || draftPolygon.length >= 3}
                stroke={getClassColor(selectedClassId)}
                fill={`${getClassColor(selectedClassId)}80`}
                strokeWidth={2}
                dash={activeTool === 'freehand' ? [] : [5, 5]}
              />
              {activeTool === 'polygon' && draftPolygon.map((pt, idx) => {
                 const [sx, sy] = toScreenXY(pt.x, pt.y);
                 return (
                  <Circle
                    key={`p-${idx}`}
                    x={sx}
                    y={sy}
                    radius={3}
                    fill={getClassColor(selectedClassId)}
                  />
                 )
              })}
            </>
          )}

        </Layer>
      </Stage>
    </div>
  );
}

export default AnnotatorCanvas;
