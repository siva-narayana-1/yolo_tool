import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Download, Upload, Save, BoxSelect, MousePointer2, Square, Hexagon, Trash2, PenTool, Database, Settings, ChevronLeft, ChevronRight, Hand } from 'lucide-react';
import AnnotatorCanvas from './components/AnnotatorCanvas';

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
  const [activeTool, setActiveTool] = useState('select'); // default to select
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  
  const [savedPolygons, setSavedPolygons] = useState([]);
  const [draftPolygon, setDraftPolygon] = useState(null);
  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null); // For editing
  
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  const modelInputRef = useRef(null);

  useEffect(() => {
    fetchDataset();
  }, []);

  const fetchDataset = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dataset`);
      setImages(res.data.images);
      setAnnotatedImages(res.data.annotated);
      
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
      if (e.key === 'a' || e.key === 'A') {
        setCurrentImageIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'd' || e.key === 'D') {
        setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1));
      } else if (e.key === 's' || e.key === 'S') {
        saveAnnotation();
      }
      
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        setSelectedClass(CLASSES[num - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    setSavedPolygons([]);
    setDraftPolygon(null);
    setSelectedShapeIndex(null);
    
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

  const handleImageUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
        formData.append("file", e.target.files[i]);
    }
    
    try {
      await axios.post(`${API_BASE}/upload_image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchDataset();
    } catch (err) {
      alert("Failed to upload image");
    }
  };

  const handleModelUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      await axios.post(`${API_BASE}/upload_model`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const type = file.name.toLowerCase().includes('sam') ? 'sam' : 'yolo';
      await axios.post(`${API_BASE}/load_model`, {
        model_type: type,
        model_name: file.name
      });
      alert(`Loaded ${type.toUpperCase()} model.`);
    } catch (err) {
      alert("Failed to upload model");
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

  const runSam = async (bbox) => {
    if (currentImageIndex < 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/inference/sam`, {
        image_name: images[currentImageIndex],
        bbox: bbox
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
    setDraftPolygon({
      points: newPolygon,
      classId: selectedClass.id
    });
  };

  const saveAnnotation = async () => {
    if (currentImageIndex < 0 || !draftPolygon) return;
    
    try {
      await axios.post(`${API_BASE}/save`, {
        image_name: images[currentImageIndex],
        class_id: draftPolygon.classId,
        polygon: draftPolygon.points
      });
      
      setSavedPolygons([...savedPolygons, draftPolygon]);
      setDraftPolygon(null);
      
      const imgName = images[currentImageIndex];
      if (!annotatedImages.includes(imgName)) {
        setAnnotatedImages([...annotatedImages, imgName]);
      }
    } catch (err) {
      alert(`Failed to save annotation: ${err.message}`);
    }
  };

  const handleDeleteShape = async (indexToDelete) => {
    if (currentImageIndex < 0) return;
    const isSaved = indexToDelete < savedPolygons.length;
    
    if (isSaved) {
        const newSavedPolygons = savedPolygons.filter((_, idx) => idx !== indexToDelete);
        try {
            await axios.post(`${API_BASE}/save_all`, {
                image_name: images[currentImageIndex],
                polygons: newSavedPolygons
            });
            setSavedPolygons(newSavedPolygons);
            if (selectedShapeIndex === indexToDelete) setSelectedShapeIndex(null);
            else if (selectedShapeIndex > indexToDelete) setSelectedShapeIndex(selectedShapeIndex - 1);
        } catch (err) {
            alert("Failed to delete shape.");
        }
    } else {
        setDraftPolygon(null);
    }
  };

  const updateShapeClass = async (index, newClassId) => {
    const newSaved = [...savedPolygons];
    newSaved[index].classId = newClassId;
    try {
        await axios.post(`${API_BASE}/save_all`, {
            image_name: images[currentImageIndex],
            polygons: newSaved
        });
        setSavedPolygons(newSaved);
    } catch (err) {
        alert("Failed to update class.");
    }
  };

  const updateShapePoints = async (index, newPoints) => {
    const newSaved = [...savedPolygons];
    newSaved[index].points = newPoints;
    try {
        await axios.post(`${API_BASE}/save_all`, {
            image_name: images[currentImageIndex],
            polygons: newSaved
        });
        setSavedPolygons(newSaved);
    } catch (err) {
        alert("Failed to update points.");
    }
  };

  const updateShapePointsLocal = (index, newPoints) => {
    const newSaved = [...savedPolygons];
    newSaved[index].points = newPoints;
    setSavedPolygons(newSaved);
  };

  const allPolygons = [...savedPolygons];
  if (draftPolygon) allPolygons.push(draftPolygon);

  return (
    <div className="cvat-app">
      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef} style={{display: 'none'}} multiple accept="image/png, image/jpeg, image/jpg" onChange={handleImageUpload} />
      <input type="file" ref={modelInputRef} style={{display: 'none'}} accept=".pt" onChange={handleModelUpload} />

      {/* TOP HEADER */}
      <header className="cvat-header">
        <div className="header-brand">
          <BoxSelect size={18} color="var(--accent-blue)" />
          Assimilate Vision
        </div>

        <div className="header-nav">
          <button className="nav-btn" onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))} disabled={currentImageIndex <= 0}>
            <ChevronLeft size={16} />
          </button>
          <div className="nav-info">
             {images.length > 0 ? `${images[currentImageIndex]} (${currentImageIndex + 1} / ${images.length})` : 'No images'}
          </div>
          <button className="nav-btn" onClick={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))} disabled={currentImageIndex >= images.length - 1}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="header-actions">
           <button className="secondary-btn" onClick={() => fileInputRef.current.click()} title="Upload Dataset Images">
              <Upload size={14} /> Upload
           </button>
           <button className="primary-btn" onClick={saveAnnotation} disabled={!draftPolygon}>
              <Save size={14} /> Save (S)
           </button>
        </div>
      </header>

      {/* LEFT TOOLBAR */}
      <aside className="cvat-toolbar">
         <button className={`tool-icon-btn ${activeTool === 'pan' ? 'active' : ''}`} onClick={() => setActiveTool('pan')} title="Pan (Drag canvas)">
           <Hand size={18} />
         </button>
         <button className={`tool-icon-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')} title="Pointer (Edit/Select)">
           <MousePointer2 size={18} />
         </button>
         <div className="toolbar-divider"></div>
         <button className={`tool-icon-btn ${activeTool === 'rect' ? 'active' : ''}`} onClick={() => setActiveTool('rect')} title="Draw Rectangle">
           <Square size={18} />
         </button>
         <button className={`tool-icon-btn ${activeTool === 'polygon' ? 'active' : ''}`} onClick={() => setActiveTool('polygon')} title="Draw Polygon">
           <Hexagon size={18} />
         </button>
         <button className={`tool-icon-btn ${activeTool === 'freehand' ? 'active' : ''}`} onClick={() => setActiveTool('freehand')} title="Draw Freehand">
           <PenTool size={18} />
         </button>
         <div className="toolbar-divider"></div>
         <button className={`tool-icon-btn ${activeTool === 'sam' ? 'active' : ''}`} onClick={() => setActiveTool('sam')} title="SAM Auto-Segment">
           <MousePointer2 size={18} color="#10b981" />
         </button>
         <button className={`tool-icon-btn ${activeTool === 'yolo' ? 'active' : ''}`} onClick={() => { setActiveTool('yolo'); runYolo(); }} title="YOLO Auto-Detect">
           <BoxSelect size={18} color="#eab308" />
         </button>
         
         <div style={{flex: 1}}></div>
         <button className="tool-icon-btn" onClick={() => modelInputRef.current.click()} title="Upload Model (.pt)">
           <Settings size={18} />
         </button>
      </aside>

      {/* CENTER CANVAS */}
      <main className="cvat-workspace">
        {images.length > 0 && currentImageIndex >= 0 ? (
          <AnnotatorCanvas 
            imageUrl={`http://127.0.0.1:8000/images/${encodeURIComponent(images[currentImageIndex])}`}
            polygons={allPolygons}
            activeTool={activeTool}
            onSamClick={(pts) => {
              if (activeTool === 'sam') runSam(pts);
            }}
            onManualDraw={handleManualDraw}
            onDeleteShape={handleDeleteShape}
            classes={CLASSES}
            selectedClassId={selectedClass.id}
            selectedShapeIndex={selectedShapeIndex}
            setSelectedShapeIndex={setSelectedShapeIndex}
            updateShapePoints={updateShapePoints}
            updateShapePointsLocal={updateShapePointsLocal}
          />
        ) : (
          <div style={{color: 'var(--text-muted)'}}>No images in dataset. Upload to begin.</div>
        )}

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <div>Processing...</div>
          </div>
        )}
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="cvat-sidebar">
        {/* Classes Section */}
        <div className="sidebar-section">
          <div className="section-header">Label Class (1-5)</div>
          <div className="section-content" style={{padding: '8px 16px'}}>
            <select 
              className="class-selector"
              value={selectedClass.id}
              onChange={(e) => {
                  const cls = CLASSES.find(c => c.id === parseInt(e.target.value));
                  if (cls) setSelectedClass(cls);
              }}
            >
              {CLASSES.map(cls => (
                  <option key={cls.id} value={cls.id}>
                      [{cls.hotkey}] {cls.name}
                  </option>
              ))}
            </select>
          </div>
        </div>

        {/* Objects Section */}
        <div className="sidebar-section flex-1" style={{maxHeight: '40%'}}>
          <div className="section-header">
            Objects <span>{savedPolygons.length}</span>
          </div>
          <div className="section-content">
              {savedPolygons.length === 0 && <div style={{color: 'var(--text-muted)', fontSize: '11px'}}>No objects.</div>}
              {savedPolygons.map((poly, idx) => (
                  <div 
                      key={idx} 
                      className={`anno-item ${selectedShapeIndex === idx ? 'selected' : ''}`} 
                      onClick={() => setSelectedShapeIndex(idx)}
                  >
                      <div className="anno-color-box" style={{backgroundColor: CLASSES.find(c => c.id === poly.classId)?.color || '#fff'}}></div>
                      <select 
                          value={poly.classId}
                          onChange={(e) => updateShapeClass(idx, parseInt(e.target.value))}
                          className="anno-select-sm"
                      >
                          {CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="anno-action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteShape(idx); }} title="Delete">
                          <Trash2 size={14} />
                      </button>
                  </div>
              ))}
          </div>
        </div>

        {/* Dataset Section */}
        <div className="sidebar-section flex-1">
          <div className="section-header">
            Files <span>{annotatedImages.length}/{images.length} Done</span>
          </div>
          <div className="section-content">
            {images.length === 0 && (
              <div style={{color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '20px'}}>
                <Database size={24} style={{opacity: 0.5, marginBottom: '8px'}} />
                <div>Dataset is empty</div>
              </div>
            )}
            {images.map((img, idx) => (
              <div 
                key={img} 
                className={`file-item ${currentImageIndex === idx ? 'active' : ''}`}
                onClick={() => setCurrentImageIndex(idx)}
              >
                <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={img}>
                  {img}
                </span>
                <div className={`status-dot ${annotatedImages.includes(img) ? 'done' : ''}`} title={annotatedImages.includes(img) ? 'Annotated' : 'Unannotated'}></div>
              </div>
            ))}
          </div>
        </div>
      </aside>

    </div>
  );
}

export default App;
