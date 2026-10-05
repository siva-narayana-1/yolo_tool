# YOLO+SAM Semi-Automatic Segmentation Tool

A high-performance, semi-automatic segmentation annotation tool designed for local dataset creation, specifically tailored for computer vision and YOLO models. It natively supports **YOLO format** exports and integrates AI-assisted labeling.

## Tech Stack

### Frontend
- **React.js & Vite**: For lightning-fast module replacement and UI rendering.
- **React-Konva**: Hardware-accelerated HTML5 canvas for drawing polygon points and masks without lag.
- **Lucide React**: For premium, scalable SVG icons.
- **Vanilla CSS**: Custom dark-mode styling with glassmorphism for a modern, sleek user experience.

### Backend
- **FastAPI**: Asynchronous Python web framework for serving APIs and dynamic image streaming.
- **Ultralytics**: For running local YOLO segmentation models (`/inference/yolo`) and SAM2 models (`/inference/sam`).
- **PyTorch & SAM2**: Integrated natively via Ultralytics for executing Segment Anything Model 2 based on bounding box or point prompts.
- **OpenCV**: Used for polygon contour simplification (Douglas-Peucker algorithm) to optimize polygon point counts.
- **Uvicorn**: High-performance ASGI server for local hosting.

## Features & Workflow

1. **Attach Dataset Main Folder**:
   - Attach any dataset folder on your system directly by pasting the path or clicking **Browse Folder** (using Windows Explorer directory picker).
   - Automatically detects images in `images/` or root dataset directory.
   - Automatically synchronizes with `labels/` directory and `classes.txt`.

2. **Smart Class Management & Auto Colors**:
   - **Bulk Add ("All at a time")**: Paste or type multiple class names at once separated by commas or new lines (e.g. `Plastic, Paper, Glass, Metal, Organic` or `Car, Pedestrian, Bicycle`).
   - **Automatic Color Assignment**: Every class is instantly assigned a distinctive, vibrant color using a curated high-contrast palette and golden-ratio color distribution.
   - **Single Manual Add**: Quickly add individual classes on the fly.
   - **Auto-Sync**: Classes are saved directly to `classes.txt` in the attached dataset folder.
   - **Dynamic Hotkeys**: Fast class switching using keyboard keys `1` through `9` and `0`.

3. **AI-Assisted Annotation**:
   - **Auto YOLO Seg**: Click one button to run a pre-trained YOLO model and automatically outline the detected object.
   - **SAM Refine Tool**: Draw bounding boxes or place points on an image. The backend SAM2 Large model (lazy-loaded for performance) dynamically computes a tight mask around the object. Mask contours are automatically optimized using the Douglas-Peucker algorithm.

4. **Manual Override Tools**:
   - **Manual Rectangle**: Click and drag to create bounding boxes.
   - **Manual Polygon**: Click around the edges of an object and press `Enter` (or double-click/snap near start) to close.
   - **Freehand Tool**: Draw organically to construct polygons.

5. **Instant YOLO Formatter**: Press `S` or click Save to instantly normalize all coordinates and append them to a `.txt` file in `labels/` matching YOLO's strict formatting.

6. **Dynamic Model Loading**: Upload and load your custom `.pt` model weights directly from the settings interface.

## Setup & Running

1. **Run the Application**:
   Simply execute `start_all.bat` from the root directory:
   ```cmd
   .\start_all.bat
   ```
   This will launch the FastAPI backend on `http://127.0.0.1:8000` and the Vite frontend on `http://localhost:5173`.