import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Upload, ZoomIn, ZoomOut, Save, BoxSelect, MousePointer2, Square, Hexagon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AnnotatorCanvas from './components/AnnotatorCanvas';
import ClassManager from './components/ClassManager';

const API_BASE = 'http://127.0.0.1:8000/api';

const CLASSES = [
  { id: 0, name: 'Plastic', color: '#ef4444', hotkey: '1' },
  { id: 1, name: 'Paper', color: '#eab308', hotkey: '2' },
  { id: 2, name: 'Glass', color: '#10b981', hotkey: '3' },
  { id: 3, name: 'Metal', color: '#8b5cf6', hotkey: '4' },
  { id: 4, name: 'Organic', color: '#f97316', hotkey: '5' }
];

function App() {
  const [images, setImages] = useState([]);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(-1);
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [activeTool, setActiveTool] = useState('sam'); // 'sam', 'yolo', 'rect', 'polygon'
  
  const [savedPolygons, setSavedPolygons] = useState([]);
  const [draftPolygon, setDraftPolygon] = useState(null);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDataset();
  }, []);

  const fetchDataset = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dataset`);
      setImages(res.data.images);
      setAnnotatedImages(res.data.annotated);
      
      // If we have images but no selection yet, select first
      setCurrentImageIndex((prev) => {
        if (prev < 0 && res.data.images.length > 0) return 0;
        if (prev >= res.data.images.length && res.data.images.length > 0) return res.data.images.length - 1;
        return prev;
      });
    } catch (err) {
      console.error("Failed to fetch dataset:", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Navigation
      if (e.key === 'a' || e.key === 'A') {
        setCurrentImageIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'd' || e.key === 'D') {
        setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1));
      } else if (e.key === 's' || e.key === 'S') {
        saveAnnotation();
      }
      
      // Classes
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        setSelectedClass(CLASSES[num - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }); // Run on every render to ensure no stale closures

  // Fetch labels when image changes
  useEffect(() => {
    setSavedPolygons([]);
    setDraftPolygon(null);
    
    if (currentImageIndex >= 0 && images[currentImageIndex]) {
        fetchLabels(images[currentImageIndex]);
    }
  }, [currentImageIndex]);

  const fetchLabels = async (imageName) => {
    try {
      const res = await axios.get(`${API_BASE}/labels/${imageName}`);
      if (res.data.labels) {
          setSavedPolygons(res.data.labels);
      }
    } catch (err) {
      console.error("Failed to fetch labels:", err);
    }
  };

  const runYolo = async () => {
    if (currentImageIndex < 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/inference/yolo`, {
        image_name: images[currentImageIndex]
      });
      setDraftPolygon({
        points: res.data.polygon,
        classId: selectedClass.id
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const runSam = async (points) => {
    if (currentImageIndex < 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/inference/sam`, {
        image_name: images[currentImageIndex],
        points: points
      });
      
      setDraftPolygon({
        points: res.data.polygon,
        classId: selectedClass.id
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleManualDraw = (newPolygon) => {
    console.log("handleManualDraw called with points:", newPolygon);
    setDraftPolygon({
      points: newPolygon,
      classId: selectedClass.id
    });
    // Visual feedback so the user knows the shape is ready to save
    alert("Shape drawn! You can now click the 'Save' button.");
  };

  const saveAnnotation = async () => {
    console.log("saveAnnotation triggered! currentImageIndex:", currentImageIndex, "draftPolygon:", draftPolygon);
    if (currentImageIndex < 0) {
        console.log("Saving failed: currentImageIndex is < 0");
        return;
    }
    if (!draftPolygon) {
        console.log("Saving failed: draftPolygon is null or undefined");
        return;
    }
    
    try {
      console.log("Posting to backend...");
      await axios.post(`${API_BASE}/save`, {
        image_name: images[currentImageIndex],
        class_id: draftPolygon.classId,
        polygon: draftPolygon.points
      });
      
      console.log("Post successful. Updating states...");
      // Move draft to saved
      setSavedPolygons([...savedPolygons, draftPolygon]);
      setDraftPolygon(null);
      
      const imgName = images[currentImageIndex];
      if (!annotatedImages.includes(imgName)) {
        setAnnotatedImages([...annotatedImages, imgName]);
      }
      console.log("Saved successfully on frontend.");
    } catch (err) {
      console.error("Failed to save backend request:", err);
      alert(`Failed to save annotation: ${err.message}`);
    }
  };

  // Combine saved and draft polygons for the canvas
  const allPolygons = [...savedPolygons];
  if (draftPolygon) {
      allPolygons.push(draftPolygon);
  }

  return (
    <div className="app-container">
      <Sidebar 
        images={images} 
        annotatedImages={annotatedImages} 
        currentIndex={currentImageIndex} 
        onSelect={setCurrentImageIndex} 
        onDatasetRefresh={fetchDataset}
      />
      
      <div className="main-area">
        <div className="toolbar">
          <button 
            className={`tool-btn ${activeTool === 'yolo' ? 'active' : ''}`}
            onClick={() => { setActiveTool('yolo'); runYolo(); }}
            title="Auto detect using YOLO"
          >
            <BoxSelect size={18} />
            Auto YOLO Seg
          </button>
          
          <button 
            className={`tool-btn ${activeTool === 'sam' ? 'active' : ''}`}
            onClick={() => setActiveTool('sam')}
            title="Refine mask by clicking points using SAM"
          >
            <MousePointer2 size={18} />
            SAM Refine Tool
          </button>

          <div style={{width: '1px', height: '30px', backgroundColor: 'var(--border-color)', margin: '0 10px'}}></div>

          <button 
            className={`tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
            onClick={() => setActiveTool('rect')}
            title="Draw bounding box manually"
          >
            <Square size={18} />
            Manual Rectangle
          </button>

          <button 
            className={`tool-btn ${activeTool === 'polygon' ? 'active' : ''}`}
            onClick={() => setActiveTool('polygon')}
            title="Draw polygon manually"
          >
            <Hexagon size={18} />
            Manual Polygon
          </button>

          <div style={{flex: 1}}></div>

          <button className="tool-btn" onClick={saveAnnotation} disabled={!draftPolygon}>
            <Save size={18} />
            Save (S)
          </button>
        </div>

        <div className="canvas-container">
          {images.length > 0 && currentImageIndex >= 0 ? (
            <AnnotatorCanvas 
              imageUrl={`http://127.0.0.1:8000/images/${images[currentImageIndex]}`}
              polygons={allPolygons}
              activeTool={activeTool}
              onSamClick={(pts) => {
                if (activeTool === 'sam') runSam(pts);
              }}
              onManualDraw={handleManualDraw}
              classes={CLASSES}
              selectedClassId={selectedClass.id}
            />
          ) : (
            <div style={{color: 'var(--text-muted)'}}>No images in dataset.</div>
          )}
        </div>

        <ClassManager 
          classes={CLASSES} 
          selected={selectedClass} 
          onSelect={setSelectedClass} 
        />

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <div>Running Model Inference...</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
