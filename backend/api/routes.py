from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import glob
import cv2
import numpy as np

try:
    from ultralytics import SAM
    # We will initialize this lazily so it doesn't block server startup
    sam_model = None
except ImportError:
    sam_model = None
    print("Warning: ultralytics not installed. SAM inference will fail.")

router = APIRouter()

# Use absolute paths relative to the current working directory (which is expected to be backend/)
BASE_DIR = os.path.abspath(os.path.join(os.getcwd(), ".."))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
IMAGES_DIR = os.path.join(DATASET_DIR, "images")
LABELS_DIR = os.path.join(DATASET_DIR, "labels")
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Ensure directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(LABELS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

class Point(BaseModel):
    x: float
    y: float
    label: int # 1 for foreground, 0 for background

class InferenceRequestYOLO(BaseModel):
    image_name: str

class InferenceRequestSAM(BaseModel):
    image_name: str
    points: Optional[List[Point]] = None
    bbox: Optional[List[float]] = None # [xmin, ymin, xmax, ymax]

class SaveLabelRequest(BaseModel):
    image_name: str
    class_id: int
    polygon: List[List[float]] # List of [x, y] coordinates (normalized 0 to 1)

class LoadModelRequest(BaseModel):
    model_type: str # 'yolo' or 'sam'
    model_name: str

@router.get("/dataset")
async def get_dataset():
    # Return list of images
    try:
        images = []
        # Support case-insensitive extensions on Windows/Linux by checking manually
        for f in os.listdir(IMAGES_DIR):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                images.append(f)
        
        # Determine which images are annotated
        annotated = []
        for img in images:
            label_file = os.path.splitext(img)[0] + ".txt"
            if os.path.exists(os.path.join(LABELS_DIR, label_file)):
                annotated.append(img)
                
        return {"images": images, "annotated": annotated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_image")
async def upload_image(file: UploadFile = File(...)):
    try:
        file_location = os.path.join(IMAGES_DIR, file.filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_model")
async def upload_model(file: UploadFile = File(...)):
    try:
        file_location = os.path.join(MODELS_DIR, file.filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
async def get_models():
    try:
        models = []
        for f in os.listdir(MODELS_DIR):
            if f.lower().endswith('.pt'):
                models.append(f)
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load_model")
async def load_model(req: LoadModelRequest):
    model_path = os.path.join(MODELS_DIR, req.model_name)
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found")
    
    # TODO: Initialize your Ultralytics YOLO or Meta SAM2 model here using `model_path`
    # E.g., `global yolo_model; yolo_model = YOLO(model_path)`
    
    return {"status": "success", "message": f"{req.model_type.upper()} model loaded successfully"}

@router.post("/inference/yolo")
async def run_yolo(req: InferenceRequestYOLO):
    image_path = os.path.join(IMAGES_DIR, req.image_name)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # TODO: Connect to actual YOLO model inference
    # Mock response for now: returning a square polygon
    return {"polygon": [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]], "confidence": 0.95, "class_id": 0}

@router.post("/inference/sam")
async def run_sam(req: InferenceRequestSAM):
    global sam_model
    if sam_model is None:
        try:
            from ultralytics import SAM
            print("Lazy loading SAM2 Large model...")
            sam_model = SAM("sam2_l.pt")
        except ImportError:
            raise HTTPException(status_code=500, detail="SAM model not loaded. Please install ultralytics.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load SAM: {e}")
            
    image_path = os.path.join(IMAGES_DIR, req.image_name)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
        
    if not req.points and not req.bbox:
        raise HTTPException(status_code=400, detail="No points or bbox provided")
        
    try:
        # Read image to get dimensions
        img = cv2.imread(image_path)
        if img is None:
            raise HTTPException(status_code=500, detail="Failed to read image")
            
        h, w = img.shape[:2]
        
        # Run inference
        pixel_bbox = None
        if req.bbox:
            pixel_bbox = [
                req.bbox[0] * w,
                req.bbox[1] * h,
                req.bbox[2] * w,
                req.bbox[3] * h
            ]
            
        pixel_points = None
        point_labels = None
        if req.points and len(req.points) > 0:
            pixel_points = [[p.x * w, p.y * h] for p in req.points]
            point_labels = [p.label for p in req.points]

        if pixel_bbox and pixel_points:
            results = sam_model(image_path, bboxes=[pixel_bbox], points=[pixel_points], labels=[point_labels], verbose=False)
        elif pixel_bbox:
            results = sam_model(image_path, bboxes=[pixel_bbox], verbose=False)
        elif pixel_points:
            results = sam_model(image_path, points=[pixel_points], labels=[point_labels], verbose=False)
        else:
            raise HTTPException(status_code=400, detail="No valid prompt provided")
            
        if not results or not results[0].masks:
            raise HTTPException(status_code=500, detail="SAM failed to generate a mask")
            
        # Get the highest confidence mask boundary (usually index 0)
        polygon_pixels = results[0].masks.xy[0]
        
        # Simplify polygon using Douglas-Peucker to reduce points
        epsilon = 0.001 * max(w, h)
        simplified = cv2.approxPolyDP(np.array(polygon_pixels), epsilon, True)
        if simplified is not None and len(simplified) >= 3:
            simplified = simplified.reshape(-1, 2)
        else:
            simplified = polygon_pixels # Fallback
            
        # Convert back to normalized coordinates [0, 1]
        normalized_poly = [[float(pt[0]/w), float(pt[1]/h)] for pt in simplified]
        
        return {"polygon": normalized_poly}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/labels/{image_name}")
async def get_labels(image_name: str):
    label_file = os.path.splitext(image_name)[0] + ".txt"
    label_path = os.path.join(LABELS_DIR, label_file)
    
    if not os.path.exists(label_path):
        return {"labels": []}
        
    try:
        labels = []
        with open(label_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if not parts:
                    continue
                class_id = int(parts[0])
                coords = [float(x) for x in parts[1:]]
                
                # Convert flat list [x1, y1, x2, y2...] to nested list [[x1, y1], [x2, y2]...]
                points = []
                for i in range(0, len(coords), 2):
                    if i+1 < len(coords):
                        points.append([coords[i], coords[i+1]])
                
                labels.append({
                    "classId": class_id,
                    "points": points
                })
        return {"labels": labels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def save_label(req: SaveLabelRequest):
    label_file = os.path.splitext(req.image_name)[0] + ".txt"
    label_path = os.path.join(LABELS_DIR, label_file)
    
    try:
        with open(label_path, "a") as f:
            # YOLO format: class_id x1 y1 x2 y2 ...
            coords_str = " ".join([f"{pt[0]:.6f} {pt[1]:.6f}" for pt in req.polygon])
            f.write(f"{req.class_id} {coords_str}\n")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SaveAllLabelsRequest(BaseModel):
    image_name: str
    polygons: List[dict] # List of {"classId": int, "points": [[x,y],...]}

@router.post("/save_all")
async def save_all_labels(req: SaveAllLabelsRequest):
    label_file = os.path.splitext(req.image_name)[0] + ".txt"
    label_path = os.path.join(LABELS_DIR, label_file)
    
    try:
        # If the polygons list is empty, we just delete the file to keep the directory clean
        if not req.polygons:
            if os.path.exists(label_path):
                os.remove(label_path)
            return {"status": "success"}

        with open(label_path, "w") as f:
            for poly in req.polygons:
                coords_str = " ".join([f"{pt[0]:.6f} {pt[1]:.6f}" for pt in poly["points"]])
                f.write(f"{poly['classId']} {coords_str}\n")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
