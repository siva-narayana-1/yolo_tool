# YOLO+SAM Semi-Automatic Segmentation Tool

A high-performance, semi-automatic segmentation annotation tool designed for local dataset creation, specifically tailored for waste management AI models. It natively supports **YOLO format** exports and integrates AI-assisted labeling.

## Tech Stack

### Frontend
- **React.js & Vite**: For lightning-fast module replacement and UI rendering.
- **React-Konva**: Hardware-accelerated HTML5 canvas for drawing thousands of polygon points without lag.
- **Lucide React**: For premium, scalable SVG icons.
- **Vanilla CSS**: Custom dark-mode styling with glassmorphism for a modern, sleek user experience.

### Backend
- **FastAPI**: Asynchronous Python web framework for serving APIs and static assets.
- **Ultralytics**: For running local YOLO segmentation models (`/inference/yolo`) and SAM2 models (`/inference/sam`).
- **PyTorch & SAM2**: Integrated natively via Ultralytics for executing Segment Anything Model 2 based on bounding box or point prompts.
- **OpenCV**: Used for polygon contour simplification (Douglas-Peucker algorithm) to optimize polygon point counts.
- **Uvicorn**: High-performance ASGI server for local hosting.

## Features & Workflow

1. **Local Dataset Explorer**: Reads directly from your local `dataset/images/` directory. Upload new images instantly through the UI.
2. **AI-Assisted Annotation**:
   - **Auto YOLO Seg**: Click one button to run a pre-trained YOLO model and automatically outline the detected object.
   - **SAM Refine Tool**: Draw bounding boxes or place points on an image. The backend SAM2 Large model (lazy-loaded for performance) will dynamically compute a tight mask around the object. Mask contours are automatically optimized using the Douglas-Peucker algorithm to reduce unnecessary points.
3. **Manual Override Tools**:
   - **Manual Rectangle**: Click and drag to create precise bounding boxes.
   - **Manual Polygon**: Click around the edges of an object and press `Enter` (or click near the starting point) to snap the shape closed.
   - **Freehand Tool**: Draw organically, and the tool will construct a polygon from the drawn path.
4. **Annotation Management**:
   - Pre-configured classes for waste management (Plastic, Paper, Glass, Metal, Organic).
   - Easily update object classes and boundaries on the fly.
   - Delete incorrectly drawn objects with real-time UI/backend synchronization via the `/save_all` endpoint.
   - Hotkey support for fast class switching (1-5) and navigation (A/D).
5. **Instant YOLO Formatter**: Press `S` or click Save to instantly normalize all coordinates and append them to a `.txt` file in `dataset/labels/` matching YOLO's strict formatting. 
6. **Dynamic Model Loading**: Upload and load your custom `.pt` model weights directly from the settings interface.

## Setup & Running

1. **Install Dependencies**:
   - *Backend*: `pip install -r backend/requirements.txt` (ensure `ultralytics` and `opencv-python` are installed)
   - *Frontend*: `cd frontend && npm install`
2. **Run the Application**:
   Simply execute `start_all.bat` from the root directory. This will simultaneously launch the FastAPI backend on port 8000 and the Vite frontend on port 5173.

## Project Architecture & Data Flow

```text
YOLO Segmentation Annotator
│
├── Frontend (React)
│   ├── Image Viewer & Polygon Editor
│   ├── Object Manager (Sidebar)
│   └── Dataset Explorer
│
├── Backend (FastAPI)
│   ├── Image/Label Loader
│   ├── YOLO Inference Engine
│   └── SAM Refinement Engine
│
├── Models
│   ├── yolo_model.pt
│   └── sam2_l.pt
│
└── Dataset
    ├── images/
    ├── labels/
    └── classes.txt
```

## Future Roadmap

- **Active Learning Hook**: After `N` manual annotations, automatically trigger a background process to fine-tune the local YOLO model.
- **Confidence Sorting**: Sort images in the sidebar based on how confident the AI model is at predicting them, prioritizing uncertain images for human review.
- **COCO Export**: Add a script to bundle the YOLO text labels into a single `_annotations.coco.json` file for standardized model ingestion.