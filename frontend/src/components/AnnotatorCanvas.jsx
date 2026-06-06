import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect } from 'react-konva';
import useImage from 'use-image';

function AnnotatorCanvas({ imageUrl, polygons, activeTool, onSamClick, onManualDraw, classes, selectedClassId }) {
  const [image] = useImage(imageUrl);
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [samPoints, setSamPoints] = useState([]);
  
  // Manual Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftRect, setDraftRect] = useState(null); // {startX, startY, endX, endY}
  const [draftPolygon, setDraftPolygon] = useState([]); // array of {x, y}

  useEffect(() => {
    // Reset temporary states when image changes
    setSamPoints([]);
    setDraftRect(null);
    setDraftPolygon([]);
    setIsDrawing(false);
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

  // Handle Enter key for polygon
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && activeTool === 'polygon') {
        console.log("Enter pressed. draftPolygon length:", draftPolygon.length);
        if (draftPolygon.length >= 3) {
            const pointsArray = draftPolygon.map(p => [p.x, p.y]);
            console.log("Finishing polygon via Enter with points:", pointsArray);
            onManualDraw(pointsArray);
            setDraftPolygon([]);
        } else {
            console.log("Not enough points to finish polygon.");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
    const pos = stage.getPointerPosition();
    const x = (pos.x - offsetX) / (image.width * scale);
    const y = (pos.y - offsetY) / (image.height * scale);
    return { x, y };
  };

  const isWithinImage = (pos) => {
    return pos && pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1;
  };

  // -------------------------
  // MOUSE EVENTS
  // -------------------------

  const handleMouseDown = (e) => {
    if (e.evt.button === 2) return; // Ignore right click for drawing start
    const pos = getRelativePointerPosition();
    if (!isWithinImage(pos)) return;

    if (activeTool === 'rect') {
      setIsDrawing(true);
      setDraftRect({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
    }
  };

  const handleMouseMove = (e) => {
    const pos = getRelativePointerPosition();
    if (!pos) return;

    // Clamp coordinates so you can't draw outside image
    const cx = Math.max(0, Math.min(1, pos.x));
    const cy = Math.max(0, Math.min(1, pos.y));

    if (activeTool === 'rect' && isDrawing) {
      setDraftRect(prev => ({ ...prev, endX: cx, endY: cy }));
    }
  };

  const handleMouseUp = (e) => {
    if (activeTool === 'rect' && isDrawing && draftRect) {
      setIsDrawing(false);
      
      // Calculate 4 points of the rectangle
      const x1 = Math.min(draftRect.startX, draftRect.endX);
      const y1 = Math.min(draftRect.startY, draftRect.endY);
      const x2 = Math.max(draftRect.startX, draftRect.endX);
      const y2 = Math.max(draftRect.startY, draftRect.endY);

      console.log("Rect mouse up. Box dimensions:", Math.abs(x2 - x1), Math.abs(y2 - y1));

      // Avoid extremely tiny accidental clicks
      if (Math.abs(x2 - x1) > 0.001 && Math.abs(y2 - y1) > 0.001) {
        console.log("Box is large enough, calling onManualDraw");
        onManualDraw([
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2]
        ]);
      } else {
        console.log("Box too small, ignoring.");
      }
      setDraftRect(null);
    }
  };

  const handleClick = (e) => {
    const pos = getRelativePointerPosition();
    if (!isWithinImage(pos)) return;

    if (activeTool === 'sam') {
      if (e.evt.button === 2) e.evt.preventDefault();
      const label = e.evt.button === 2 ? 0 : 1; 
      const newPts = [...samPoints, { x: pos.x, y: pos.y, label }];
      setSamPoints(newPts);
      onSamClick(newPts);
    } 
    else if (activeTool === 'polygon') {
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
  if (activeTool === 'sam') cursorStyle = 'crosshair';
  if (activeTool === 'rect' || activeTool === 'polygon') cursorStyle = 'crosshair';

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <Stage 
        width={dimensions.width} 
        height={dimensions.height}
        ref={stageRef}
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
              <Line
                key={idx}
                points={flatPoints}
                closed={true}
                stroke={getClassColor(poly.classId)}
                strokeWidth={3}
                fill={`${getClassColor(poly.classId)}40`}
              />
            );
          })}

          {/* SAM Points Feedback */}
          {samPoints.map((pt, idx) => {
             const [sx, sy] = toScreenXY(pt.x, pt.y);
             return (
              <Circle
                key={idx}
                x={sx}
                y={sy}
                radius={4}
                fill={pt.label === 1 ? '#10b981' : '#ef4444'} 
                stroke="#ffffff"
                strokeWidth={1}
              />
            )
          })}

          {/* Draft Rectangle */}
          {draftRect && (
            <Rect 
              x={toScreenXY(Math.min(draftRect.startX, draftRect.endX), 0)[0]}
              y={toScreenXY(0, Math.min(draftRect.startY, draftRect.endY))[1]}
              width={Math.abs(draftRect.endX - draftRect.startX) * image.width * scale}
              height={Math.abs(draftRect.endY - draftRect.startY) * image.height * scale}
              stroke={getClassColor(selectedClassId)}
              strokeWidth={2}
              dash={[5, 5]}
            />
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
                closed={false}
                stroke={getClassColor(selectedClassId)}
                strokeWidth={2}
                dash={[5, 5]}
              />
              {draftPolygon.map((pt, idx) => {
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
