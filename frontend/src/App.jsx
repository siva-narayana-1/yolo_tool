import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FolderOpen, 
  Save, 
  BoxSelect, 
  MousePointer2, 
  Square, 
  Hexagon, 
  Trash2, 
  PenTool, 
  Database, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Hand,
  Tag,
  Plus,
  Sparkles,
  Settings2,
  HardDrive
} from 'lucide-react';
import AnnotatorCanvas from './components/AnnotatorCanvas';
import DatasetAttachModal from './components/DatasetAttachModal';
import ClassManagerModal from './components/ClassManagerModal';
import { getColorForIndex, getHotkeyForIndex, formatClassesFromNames } from './utils/colors';

const API_BASE = 'http://127.0.0.1:8000/api';

const DEFAULT_FALLBACK_CLASSES = [
  { id: 0, name: 'Plastic', color: '#ef4444', hotkey: '1' },
  { id: 1, name: 'Paper', color: '#3b82f6', hotkey: '2' },
  { id: 2, name: 'Glass', color: '#10b981', hotkey: '3' },
  { id: 3, name: 'Metal', color: '#f59e0b', hotkey: '4' },
  { id: 4, name: 'Organic', color: '#8b5cf6', hotkey: '5' }
];

function getFolderBasename(pathStr) {
  if (!pathStr) return 'Dataset Folder';
  const parts = pathStr.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : pathStr;
}

function App() {
  const [images, setImages] = useState([]);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(-1);
  const [activeTool, setActiveTool] = useState('select');
  
  // Classes state (dynamic, auto-colored)
  const [classes, setClasses] = useState(DEFAULT_FALLBACK_CLASSES);
  const [selectedClass, setSelectedClass] = useState(DEFAULT_FALLBACK_CLASSES[0]);
  
  // Dataset location state
  const [datasetPath, setDatasetPath] = useState('');
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  const [savedPolygons, setSavedPolygons] = useState([]);
  const [draftPolygon, setDraftPolygon] = useState(null);
  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);
  const [samSession, setSamSession] = useState(null);
  
  const [loading, setLoading] = useState(false);

  const modelInputRef = useRef(null);

  useEffect(() => {
    fetchDataset();
  }, []);

  const fetchDataset = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dataset`);
      setImages(res.data.images || []);
      setAnnotatedImages(res.data.annotated || []);
      setDatasetPath(res.data.dataset_path || '');
      
      // Load classes if returned by backend (from classes.txt)
      if (res.data.classes && res.data.classes.length > 0) {
        const formatted = formatClassesFromNames(res.data.classes, classes);
        setClasses(formatted);
        setSelectedClass(prev => {
          if (!prev) return formatted[0];
          const found = formatted.find(c => c.name.toLowerCase() === prev.name.toLowerCase());
          return found || formatted[0];
        });
      }

      setCurrentImageIndex((prev) => {
        if (prev < 0 && res.data.images && res.data.images.length > 0) return 0;
        if (prev >= res.data.images?.length && res.data.images?.length > 0) return res.data.images.length - 1;
        return prev;
      });
    } catch (err) {
      console.error("Failed to fetch dataset:", err);
    }
  };

  const handleDatasetAttached = (data) => {
    setDatasetPath(data.dataset_path || '');
    setImages(data.images || []);
    setAnnotatedImages(data.annotated || []);
    
    if (data.classes && data.classes.length > 0) {
      const formatted = formatClassesFromNames(data.classes, classes);
      setClasses(formatted);
      setSelectedClass(formatted[0]);
    }
    
    setCurrentImageIndex(data.images && data.images.length > 0 ? 0 : -1);
    setSavedPolygons([]);
    setDraftPolygon(null);
    setSamSession(null);
    setSelectedShapeIndex(null);
  };

  const handleClassesUpdated = (newClasses) => {
    setClasses(newClasses);
    if (newClasses.length > 0) {
      setSelectedClass(prev => {
        if (!prev) return newClasses[0];
        const exists = newClasses.find(c => c.id === prev.id || c.name.toLowerCase() === prev.name.toLowerCase());
        return exists || newClasses[0];
      });
    } else {
      setSelectedClass(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore global hotkeys when user is typing in form inputs or modals
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        setCurrentImageIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'd' || e.key === 'D') {
        setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1));
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        saveAnnotation();
      }
      
      // Dynamic Hotkeys (1-9, 0)
      const matchingClass = classes.find(c => c.hotkey === e.key);
      if (matchingClass) {
        setSelectedClass(matchingClass);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [classes, images.length, draftPolygon, samSession, savedPolygons, currentImageIndex]);

  useEffect(() => {
    setSavedPolygons([]);
    setDraftPolygon(null);
    setSelectedShapeIndex(null);
    setSamSession(null);
    
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
    if (currentImageIndex < 0 || !selectedClass) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/inference/yolo`, {
        image_name: images[currentImageIndex]
      });
      setDraftPolygon({
        points: res.data.polygon,
        classId: selectedClass.id
      });
      setSelectedShapeIndex(savedPolygons.length);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const runSam = async (bbox, points = []) => {
    if (currentImageIndex < 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/inference/sam`, {
        image_name: images[currentImageIndex],
        bbox: bbox,
        points: points
      });
      
      setSamSession(prev => {
          if (!prev) return null;
          return { ...prev, currentMask: res.data.polygon };
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSamBox = (bbox) => {
    setSamSession({ bbox, points: [] });
    runSam(bbox, []);
  };

  const handleSamPoint = (pt) => {
    if (!samSession) return;
    const newPoints = [...samSession.points, pt];
    setSamSession({ ...samSession, points: newPoints });
    runSam(samSession.bbox, newPoints);
  };

  const handleManualDraw = (newPolygon) => {
    if (!selectedClass) return;
    setDraftPolygon({
      points: newPolygon,
      classId: selectedClass.id
    });
    setSelectedShapeIndex(savedPolygons.length);
  };

  const saveAnnotation = async () => {
    if (!selectedClass) {
      alert("Please select or add a class first.");
      return;
    }
    let polygonToSave = null;
    if (samSession && samSession.currentMask) {
        polygonToSave = {
            points: samSession.currentMask,
            classId: selectedClass.id
        };
    } else if (draftPolygon) {
        polygonToSave = draftPolygon;
    }

    if (currentImageIndex < 0 || !polygonToSave) return;
    
    try {
      const updatedPolygons = [...savedPolygons, polygonToSave];
      await axios.post(`${API_BASE}/save_all`, {
        image_name: images[currentImageIndex],
        polygons: updatedPolygons
      });
      
      setSavedPolygons(updatedPolygons);
      setDraftPolygon(null);
      setSamSession(null);
      setSelectedShapeIndex(updatedPolygons.length - 1);
      
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
    if (index === savedPolygons.length && draftPolygon) {
        setDraftPolygon({ ...draftPolygon, classId: newClassId });
    } else {
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
    }
  };

  const updateShapePoints = async (index, newPoints) => {
    if (index === savedPolygons.length && draftPolygon) {
        setDraftPolygon({ ...draftPolygon, points: newPoints });
    } else {
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
    }
  };

  const updateShapePointsLocal = (index, newPoints) => {
    if (index === savedPolygons.length && draftPolygon) {
        setDraftPolygon({ ...draftPolygon, points: newPoints });
    } else {
        const newSaved = [...savedPolygons];
        newSaved[index].points = newPoints;
        setSavedPolygons(newSaved);
    }
  };

  const allPolygons = [...savedPolygons];
  if (draftPolygon) allPolygons.push(draftPolygon);

  return (
    <div className="cvat-app">
      {/* Hidden model upload input */}
      <input type="file" ref={modelInputRef} style={{display: 'none'}} accept=".pt" onChange={handleModelUpload} />

      {/* MODALS */}
      <DatasetAttachModal
        isOpen={showDatasetModal}
        onClose={() => setShowDatasetModal(false)}
        currentDatasetPath={datasetPath}
        imagesCount={images.length}
        annotatedCount={annotatedImages.length}
        classesCount={classes.length}
        onDatasetAttached={handleDatasetAttached}
      />

      <ClassManagerModal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        currentClasses={classes}
        onClassesUpdated={handleClassesUpdated}
      />

      {/* TOP HEADER */}
      <header className="cvat-header">
        <div className="header-brand">
          <BoxSelect size={18} color="var(--accent-blue)" />
          <span>Assimilate Vision</span>
        </div>

        <div className="header-nav">
          <button className="nav-btn" onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))} disabled={currentImageIndex <= 0}>
            <ChevronLeft size={16} />
          </button>
          <div className="nav-info">
             {images.length > 0 && currentImageIndex >= 0 ? `${images[currentImageIndex]} (${currentImageIndex + 1} / ${images.length})` : 'No images'}
          </div>
          <button className="nav-btn" onClick={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))} disabled={currentImageIndex >= images.length - 1 || images.length === 0}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="header-actions">
           {/* Dataset Main Folder Location Button (Replacing generic upload) */}
           <button 
             type="button" 
             className="dataset-location-btn" 
             onClick={() => setShowDatasetModal(true)} 
             title="Attach Dataset Main Folder Location"
           >
              <FolderOpen size={15} color="var(--accent-blue)" />
              <div className="dataset-btn-content">
                <span className="dataset-btn-label">Dataset</span>
                <span className="dataset-btn-path" title={datasetPath || 'Click to attach dataset folder'}>
                  {datasetPath ? getFolderBasename(datasetPath) : 'Attach Folder'}
                </span>
              </div>
              <span className="dataset-btn-badge" title={`${images.length} images loaded`}>
                {images.length}
              </span>
           </button>

           {/* Quick Classes Modal Trigger */}
           <button 
             type="button" 
             className="classes-manage-trigger-btn" 
             onClick={() => setShowClassModal(true)}
             title="Manage Annotation Classes & Auto Colors"
           >
              <Tag size={14} color="#10b981" />
              <span>Classes ({classes.length})</span>
           </button>

           {/* Save Annotation */}
           <button 
             type="button" 
             className="primary-btn" 
             onClick={saveAnnotation} 
             disabled={!draftPolygon && !(samSession && samSession.currentMask)}
           >
              <Save size={15} /> Save (S)
           </button>
        </div>
      </header>

      {/* LEFT TOOLBAR */}
      <aside className="cvat-toolbar">
         <button type="button" className={`tool-icon-btn ${activeTool === 'pan' ? 'active' : ''}`} onClick={() => setActiveTool('pan')} title="Pan (Drag canvas)">
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
            samSession={samSession}
            onSamBox={handleSamBox}
            onSamPoint={handleSamPoint}
            onManualDraw={handleManualDraw}
            onDeleteShape={handleDeleteShape}
            classes={classes}
            selectedClassId={selectedClass ? selectedClass.id : 0}
            selectedShapeIndex={selectedShapeIndex}
            setSelectedShapeIndex={setSelectedShapeIndex}
            updateShapePoints={updateShapePoints}
            updateShapePointsLocal={updateShapePointsLocal}
          />
        ) : (
          <div className="empty-workspace-placeholder">
            <FolderOpen size={48} style={{ opacity: 0.35, marginBottom: '16px', color: 'var(--accent-blue)' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-active)', marginBottom: '6px' }}>
              No images loaded
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Attach your dataset main folder location to begin annotating.
            </div>
            <button type="button" className="primary-btn" onClick={() => setShowDatasetModal(true)}>
              <FolderOpen size={15} /> Attach Dataset Folder
            </button>
          </div>
        )}

        {loading && (
          <div style={{ position: 'absolute', top: 16, right: 16, backgroundColor: '#1e1e1e', padding: '8px 16px', borderRadius: '8px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #383838', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }}>
            <div className="loading-spinner" style={{ width: 16, height: 16, marginBottom: 0, borderWidth: 2 }}></div>
            <span style={{ fontSize: '12px', fontWeight: 500 }}>Processing...</span>
          </div>
        )}
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="cvat-sidebar">
        
        {/* Classes Section */}
        <div className="sidebar-section">
          <div className="section-header">
            <span>Label Class {classes.length > 0 ? `(1-${Math.min(9, classes.length)})` : ''}</span>
            <button 
              type="button" 
              className="section-header-action-btn"
              onClick={() => setShowClassModal(true)}
              title="Add or Manage Classes & Colors"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          
          <div className="section-content" style={{padding: '10px 14px', gap: '10px'}}>
            {classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>No classes defined</div>
                <button type="button" className="secondary-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowClassModal(true)}>
                  <Plus size={13} /> Add Classes
                </button>
              </div>
            ) : (
              <>
                {/* Active Class Dropdown */}
                <div className="class-select-wrapper">
                  <div 
                    className="selected-class-color-indicator" 
                    style={{ backgroundColor: selectedClass?.color || '#fff' }}
                  ></div>
                  <select 
                    className="class-selector"
                    value={selectedClass ? selectedClass.id : ''}
                    onChange={(e) => {
                        const cls = classes.find(c => c.id === parseInt(e.target.value));
                        if (cls) setSelectedClass(cls);
                    }}
                  >
                    {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>
                            {cls.hotkey ? `[${cls.hotkey}] ` : ''}{cls.name}
                        </option>
                    ))}
                  </select>
                </div>

                {/* Quick Class Chips with auto-assigned colors */}
                <div className="quick-classes-pills">
                  {classes.slice(0, 10).map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      className={`quick-class-pill ${selectedClass?.id === cls.id ? 'active' : ''}`}
                      onClick={() => setSelectedClass(cls)}
                      style={{
                        borderColor: selectedClass?.id === cls.id ? cls.color : 'var(--border-color)',
                        backgroundColor: selectedClass?.id === cls.id ? `${cls.color}25` : 'transparent'
                      }}
                      title={`Select ${cls.name} (Key: ${cls.hotkey || cls.id})`}
                    >
                      <span className="pill-dot" style={{ backgroundColor: cls.color }}></span>
                      <span className="pill-name">{cls.name}</span>
                      {cls.hotkey && <span className="pill-key">{cls.hotkey}</span>}
                    </button>
                  ))}
                  {classes.length > 10 && (
                    <button
                      type="button"
                      className="quick-class-pill more"
                      onClick={() => setShowClassModal(true)}
                    >
                      +{classes.length - 10} more
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Objects Section */}
        <div className="sidebar-section flex-1" style={{maxHeight: '40%'}}>
          <div className="section-header">
            <span>Objects</span>
            <span className="count-badge">{allPolygons.length}</span>
          </div>
          <div className="section-content">
              {allPolygons.length === 0 && <div style={{color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '12px 0'}}>No objects annotated on this image.</div>}
              {allPolygons.map((poly, idx) => {
                const shapeClass = classes.find(c => c.id === poly.classId);
                const shapeColor = shapeClass ? shapeClass.color : '#ffffff';
                return (
                  <div 
                      key={idx} 
                      className={`anno-item ${selectedShapeIndex === idx ? 'selected' : ''} ${idx === savedPolygons.length ? 'draft' : ''}`} 
                      onClick={() => setSelectedShapeIndex(idx)}
                  >
                      <div className="anno-color-box" style={{backgroundColor: shapeColor}}></div>
                      <select 
                          value={poly.classId}
                          onChange={(e) => updateShapeClass(idx, parseInt(e.target.value))}
                          className="anno-select-sm"
                      >
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="anno-action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteShape(idx); }} title="Delete shape">
                          <Trash2 size={13} />
                      </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Dataset Section */}
        <div className="sidebar-section flex-1">
          <div className="section-header">
            <span>Dataset Files</span>
            <span className="count-badge">{annotatedImages.length}/{images.length} Done</span>
          </div>
          <div className="section-content">
            {images.length === 0 && (
              <div style={{color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '20px'}}>
                <Database size={24} style={{opacity: 0.5, marginBottom: '8px'}} />
                <div>Dataset is empty</div>
                <button 
                  type="button" 
                  className="subtle-btn" 
                  style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowDatasetModal(true)}
                >
                  <FolderOpen size={13} /> Attach Folder
                </button>
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
