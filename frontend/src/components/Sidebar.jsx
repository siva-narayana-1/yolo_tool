import React, { useRef } from 'react';
import axios from 'axios';
import { Upload, Database, Settings } from 'lucide-react';

function Sidebar({ images, annotatedImages, currentIndex, onSelect, onDatasetRefresh }) {
  const fileInputRef = useRef(null);
  const modelInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
        formData.append("file", e.target.files[i]);
    }
    
    try {
      await axios.post('http://127.0.0.1:8000/api/upload_image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onDatasetRefresh(); // Refresh the list of images
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert("Failed to upload image");
    }
  };

  const handleModelUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      await axios.post('http://127.0.0.1:8000/api/upload_model', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`Successfully uploaded model: ${file.name}`);
      
      // Optionally tell backend to load it right away
      const type = file.name.toLowerCase().includes('sam') ? 'sam' : 'yolo';
      await axios.post('http://127.0.0.1:8000/api/load_model', {
        model_type: type,
        model_name: file.name
      });
      alert(`Loaded ${type.toUpperCase()} model.`);
      
    } catch (err) {
      console.error("Failed to upload model:", err);
      alert("Failed to upload model");
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
            <h2>Assimilate Vision</h2>
            <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px'}}>
            {annotatedImages.length} / {images.length} Annotated
            </div>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
            {/* Hidden file inputs */}
            <input type="file" ref={fileInputRef} style={{display: 'none'}} multiple accept="image/png, image/jpeg, image/jpg" onChange={handleImageUpload} />
            <input type="file" ref={modelInputRef} style={{display: 'none'}} accept=".pt" onChange={handleModelUpload} />
            
            <button className="tool-btn" style={{padding: '6px'}} title="Upload Image" onClick={() => fileInputRef.current.click()}>
                <Upload size={16} />
            </button>
            <button className="tool-btn" style={{padding: '6px'}} title="Upload YOLO/SAM Model (.pt)" onClick={() => modelInputRef.current.click()}>
                <Settings size={16} />
            </button>
        </div>
      </div>
      
      <div className="sidebar-content">
        <div className="image-list">
          {images.map((img, idx) => (
            <div 
              key={img} 
              className={`image-item ${currentIndex === idx ? 'active' : ''}`}
              onClick={() => onSelect(idx)}
            >
              <span className="image-name" title={img}>{img}</span>
              <div 
                className={`status-badge ${annotatedImages.includes(img) ? 'annotated' : ''}`}
                title={annotatedImages.includes(img) ? 'Annotated' : 'Unannotated'}
              ></div>
            </div>
          ))}
          {images.length === 0 && (
            <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'}}>
              <Database size={24} style={{opacity: 0.5}} />
              No images found.
              <br/>
              Click the upload icon above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
