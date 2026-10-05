import React, { useState } from 'react';
import axios from 'axios';
import { FolderOpen, HardDrive, CheckCircle2, AlertCircle, X, Search, RefreshCw, Folder } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

function DatasetAttachModal({ isOpen, onClose, currentDatasetPath, imagesCount, annotatedCount, classesCount, onDatasetAttached }) {
  const [folderPath, setFolderPath] = useState(currentDatasetPath || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleSetLocation = async (pathToSet) => {
    const target = pathToSet || folderPath;
    if (!target || !target.trim()) {
      setError("Please enter a valid folder path.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await axios.post(`${API_BASE}/dataset/set_location`, {
        dataset_path: target.trim()
      });

      setSuccessMsg(`Attached dataset with ${res.data.images.length} images!`);
      if (onDatasetAttached) {
        onDatasetAttached(res.data);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Failed to attach dataset folder";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseNative = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await axios.post(`${API_BASE}/dataset/browse`);
      if (res.data.status === 'success') {
        setFolderPath(res.data.dataset_path);
        setSuccessMsg(`Folder selected and attached (${res.data.images.length} images found)!`);
        if (onDatasetAttached) {
          onDatasetAttached(res.data);
        }
        setTimeout(() => {
          onClose();
        }, 1000);
      } else if (res.data.status === 'cancelled') {
        // user simply closed folder dialog
      }
    } catch (err) {
      setError("Failed to open system browse dialog. You can paste the folder path directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <FolderOpen size={20} color="var(--accent-blue)" />
            <span>Attach Dataset Main Folder</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          <p className="modal-subtitle">
            Specify the location of your dataset's main folder. Images will be automatically scanned from the folder or its <code>images/</code> subfolder.
          </p>

          {/* Current Path Info Box */}
          <div className="info-stat-card">
            <div className="info-stat-header">
              <HardDrive size={14} color="var(--text-muted)" />
              <span>Current Attached Dataset</span>
            </div>
            <div className="current-path-text" title={currentDatasetPath || 'Not configured'}>
              {currentDatasetPath || 'No folder attached yet'}
            </div>
            <div className="info-stat-badges">
              <span className="stat-pill">🖼️ {imagesCount || 0} Images</span>
              <span className="stat-pill success">✅ {annotatedCount || 0} Labeled</span>
              <span className="stat-pill">🏷️ {classesCount || 0} Classes</span>
            </div>
          </div>

          {/* Input & Browse Section */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Dataset Main Folder Path</label>
            <div className="input-with-button-group">
              <input
                type="text"
                className="form-input"
                placeholder="e.g. C:\Users\name\Desktop\seg_tool\dataset"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetLocation();
                }}
              />
              <button
                type="button"
                className="browse-folder-btn"
                onClick={handleBrowseNative}
                disabled={loading}
                title="Browse folder via Windows Explorer"
              >
                <Folder size={14} /> Browse...
              </button>
            </div>
          </div>

          {/* Error and Success Feedback */}
          {error && (
            <div className="modal-alert error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="modal-alert success">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Helper Tips */}
          <div className="modal-hints">
            <div className="hint-item">
              💡 <strong>Folder structure supported:</strong> Standard YOLO dataset folder with <code>images/</code> & <code>labels/</code>, or a flat folder with images.
            </div>
            <div className="hint-item">
              💡 <code>classes.txt</code> will be loaded automatically if present in the dataset folder.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => handleSetLocation()}
            disabled={loading || !folderPath.trim()}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="spin-icon" /> Attaching...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> Attach & Load Dataset
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default DatasetAttachModal;
