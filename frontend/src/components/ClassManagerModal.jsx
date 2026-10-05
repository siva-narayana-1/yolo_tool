import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tag, Plus, Trash2, Sparkles, X, Check, RefreshCw, Palette, Layers, AlertCircle, FileText } from 'lucide-react';
import { getColorForIndex, getHotkeyForIndex, formatClassesFromNames } from '../utils/colors';

const API_BASE = 'http://127.0.0.1:8000/api';

function ClassManagerModal({ isOpen, onClose, currentClasses, onClassesUpdated }) {
  const [classesList, setClassesList] = useState([]);
  const [singleName, setSingleName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [parsedBulkPreview, setParsedBulkPreview] = useState([]);
  const [activeTab, setActiveTab] = useState('bulk'); // 'bulk' | 'single'
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (isOpen && currentClasses) {
      setClassesList([...currentClasses]);
      setBulkText('');
      setSingleName('');
      setStatusMsg(null);
    }
  }, [isOpen, currentClasses]);

  // Live parse bulk text
  useEffect(() => {
    if (!bulkText.trim()) {
      setParsedBulkPreview([]);
      return;
    }
    // Split by newlines, commas, or semicolons
    const rawNames = bulkText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Remove duplicates within the bulk input
    const unique = [];
    const seen = new Set();
    for (const name of rawNames) {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(name);
      }
    }

    // Determine preview colors starting from current classes count
    const startIdx = classesList.length;
    const preview = unique.map((name, i) => ({
      name,
      color: getColorForIndex(startIdx + i)
    }));
    setParsedBulkPreview(preview);
  }, [bulkText, classesList.length]);

  if (!isOpen) return null;

  // Persist updated classes to backend and notify parent
  const syncClassesToBackend = async (updatedList) => {
    setSaving(true);
    try {
      const payload = {
        classes: updatedList.map((c, idx) => ({
          id: idx,
          name: c.name,
          color: c.color
        }))
      };
      await axios.post(`${API_BASE}/classes`, payload);
      setClassesList(updatedList);
      if (onClassesUpdated) {
        onClassesUpdated(updatedList);
      }
      setStatusMsg("Classes saved and synchronized with classes.txt!");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("Failed to save classes:", err);
      setStatusMsg("Failed to save classes to backend.");
    } finally {
      setSaving(false);
    }
  };

  // Add single class with auto-assigned color
  const handleAddSingle = () => {
    const trimmed = singleName.trim();
    if (!trimmed) return;

    if (classesList.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setStatusMsg(`Class "${trimmed}" already exists.`);
      return;
    }

    const nextIdx = classesList.length;
    const newClass = {
      id: nextIdx,
      name: trimmed,
      color: getColorForIndex(nextIdx),
      hotkey: getHotkeyForIndex(nextIdx)
    };

    const updated = [...classesList, newClass];
    setSingleName('');
    syncClassesToBackend(updated);
  };

  // Bulk add classes ("all at a time")
  const handleAddBulk = (replace = false) => {
    if (parsedBulkPreview.length === 0) return;

    let updated = [];
    if (replace) {
      updated = parsedBulkPreview.map((item, idx) => ({
        id: idx,
        name: item.name,
        color: getColorForIndex(idx),
        hotkey: getHotkeyForIndex(idx)
      }));
    } else {
      // Append only non-existing classes
      const existingNames = new Set(classesList.map(c => c.name.toLowerCase()));
      const toAdd = parsedBulkPreview.filter(p => !existingNames.has(p.name.toLowerCase()));
      
      if (toAdd.length === 0) {
        setStatusMsg("All entered classes already exist in the list.");
        return;
      }

      const startIndex = classesList.length;
      const newItems = toAdd.map((item, idx) => ({
        id: startIndex + idx,
        name: item.name,
        color: getColorForIndex(startIndex + idx),
        hotkey: getHotkeyForIndex(startIndex + idx)
      }));

      updated = [...classesList, ...newItems];
    }

    setBulkText('');
    setParsedBulkPreview([]);
    syncClassesToBackend(updated);
  };

  // Delete a class
  const handleDeleteClass = (indexToDelete) => {
    const remaining = classesList.filter((_, idx) => idx !== indexToDelete);
    // Re-index remaining classes so IDs stay 0, 1, 2... and update hotkeys
    const reindexed = remaining.map((c, idx) => ({
      ...c,
      id: idx,
      hotkey: getHotkeyForIndex(idx)
    }));
    syncClassesToBackend(reindexed);
  };

  // Change class color manually if user wants
  const handleColorChange = (index, newColor) => {
    const updated = [...classesList];
    updated[index] = { ...updated[index], color: newColor };
    syncClassesToBackend(updated);
  };

  // Edit class name
  const handleNameChange = (index, newName) => {
    const updated = [...classesList];
    updated[index] = { ...updated[index], name: newName };
    syncClassesToBackend(updated);
  };

  // Re-assign distinct auto colors to all classes
  const handleAutoReassignColors = () => {
    const updated = classesList.map((c, idx) => ({
      ...c,
      color: getColorForIndex(idx)
    }));
    syncClassesToBackend(updated);
  };

  // Clear all classes
  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to remove all classes?")) {
      syncClassesToBackend([]);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container class-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Tag size={20} color="var(--accent-blue)" />
            <span>Manage Annotation Classes</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          
          {/* Status Message */}
          {statusMsg && (
            <div className="modal-alert success" style={{ marginBottom: '14px' }}>
              <Check size={16} />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Add Method Tabs */}
          <div className="class-tabs-bar">
            <button
              className={`class-tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              <Sparkles size={15} /> Bulk Add (All at Once)
            </button>
            <button
              className={`class-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
              onClick={() => setActiveTab('single')}
            >
              <Plus size={15} /> Quick Add Single Class
            </button>
          </div>

          {/* TAB 1: BULK ADD */}
          {activeTab === 'bulk' && (
            <div className="bulk-add-section">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Type or Paste Multiple Class Names:</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Separated by commas or new lines</span>
              </label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder={"Example:\nPlastic, Paper, Glass, Metal, Organic\n\nor:\nCar\nPedestrian\nBicycle\nMotorcycle"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />

              {/* Live Preview Chips with auto-assigned colors */}
              {parsedBulkPreview.length > 0 && (
                <div className="bulk-preview-box">
                  <div className="preview-label">
                    <Sparkles size={13} color="var(--accent-blue)" /> Auto-assigned Color Preview ({parsedBulkPreview.length} classes):
                  </div>
                  <div className="preview-chips-list">
                    {parsedBulkPreview.map((item, idx) => (
                      <span
                        key={idx}
                        className="preview-chip"
                        style={{
                          borderColor: item.color,
                          backgroundColor: `${item.color}22`
                        }}
                      >
                        <span className="chip-dot" style={{ backgroundColor: item.color }}></span>
                        <span className="chip-name">{item.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bulk-actions-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => handleAddBulk(false)}
                  disabled={parsedBulkPreview.length === 0 || saving}
                >
                  <Sparkles size={14} /> Add All {parsedBulkPreview.length > 0 ? `(${parsedBulkPreview.length})` : ''} Classes
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => handleAddBulk(true)}
                  disabled={parsedBulkPreview.length === 0 || saving}
                  title="Replace all existing classes with these new ones"
                >
                  <RefreshCw size={13} /> Replace All
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SINGLE ADD */}
          {activeTab === 'single' && (
            <div className="single-add-section">
              <label className="form-label">Single Class Name</label>
              <div className="input-with-button-group">
                <div className="single-input-wrapper">
                  <span
                    className="auto-color-indicator"
                    style={{ backgroundColor: getColorForIndex(classesList.length) }}
                    title="Auto-assigned color"
                  ></span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Cardboard, Helmet, Pedestrian"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSingle();
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleAddSingle}
                  disabled={!singleName.trim() || saving}
                >
                  <Plus size={15} /> Add Class
                </button>
              </div>
            </div>
          )}

          {/* EXISTING CLASSES LIST */}
          <div className="existing-classes-container" style={{ marginTop: '20px' }}>
            <div className="classes-list-header">
              <div className="header-left">
                <Layers size={14} />
                <span>Active Classes ({classesList.length})</span>
              </div>
              <div className="header-right">
                <button
                  type="button"
                  className="subtle-btn"
                  onClick={handleAutoReassignColors}
                  title="Re-assign auto colors to all classes"
                  disabled={classesList.length === 0}
                >
                  <Palette size={13} /> Auto Colors
                </button>
                <button
                  type="button"
                  className="subtle-btn danger"
                  onClick={handleClearAll}
                  disabled={classesList.length === 0}
                >
                  <Trash2 size={13} /> Clear All
                </button>
              </div>
            </div>

            {classesList.length === 0 ? (
              <div className="empty-classes-box">
                <Tag size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <div>No classes configured yet.</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Use the Bulk Add box above to type or paste class names at once.
                </div>
              </div>
            ) : (
              <div className="classes-grid">
                {classesList.map((cls, idx) => (
                  <div key={idx} className="class-card-item">
                    <div className="class-id-badge" title={`YOLO Class ID: ${idx}`}>
                      #{idx}
                    </div>

                    {/* Color Picker Swatch */}
                    <div className="color-swatch-wrapper" title="Click to customize color (auto-assigned)">
                      <input
                        type="color"
                        className="color-input-hidden"
                        value={cls.color.startsWith('#') ? cls.color : '#3b82f6'}
                        onChange={(e) => handleColorChange(idx, e.target.value)}
                      />
                      <div className="color-swatch-box" style={{ backgroundColor: cls.color }}></div>
                    </div>

                    {/* Class Name Input */}
                    <input
                      type="text"
                      className="class-name-input"
                      value={cls.name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      placeholder="Class name"
                    />

                    {/* Hotkey Tag */}
                    {cls.hotkey && (
                      <span className="hotkey-pill" title={`Press '${cls.hotkey}' on keyboard to select`}>
                        Key [{cls.hotkey}]
                      </span>
                    )}

                    {/* Delete Action */}
                    <button
                      type="button"
                      className="class-del-btn"
                      onClick={() => handleDeleteClass(idx)}
                      title="Remove class"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="classes-sync-note">
            <FileText size={13} />
            <span>Classes are automatically saved and synced with <code>classes.txt</code> in your dataset folder.</span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="primary-btn" onClick={onClose}>
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

export default ClassManagerModal;
