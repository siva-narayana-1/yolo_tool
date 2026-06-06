import React from 'react';

function ClassManager({ classes, selected, onSelect }) {
  return (
    <div className="class-panel">
      <h3>Annotation Classes</h3>
      <div className="class-list">
        {classes.map(cls => (
          <div 
            key={cls.id}
            className={`class-item ${selected.id === cls.id ? 'active' : ''}`}
            onClick={() => onSelect(cls)}
            style={{ borderColor: selected.id === cls.id ? cls.color : 'transparent' }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <div 
                className="class-color-indicator" 
                style={{ backgroundColor: cls.color }}
              ></div>
              <span style={{fontSize: '0.9rem'}}>{cls.name}</span>
            </div>
            <div className="hotkey">{cls.hotkey}</div>
          </div>
        ))}
      </div>
      
      <div style={{marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)'}}>
        <div style={{marginBottom: '5px'}}><strong>A / D</strong> : Prev / Next Image</div>
        <div style={{marginBottom: '5px'}}><strong>S</strong> : Save Annotation</div>
        <div style={{marginBottom: '5px'}}><strong>Left Click</strong> : Add SAM point</div>
        <div><strong>Right Click</strong> : Remove SAM point</div>
      </div>
    </div>
  );
}

export default ClassManager;
