from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Union
import os
import shutil
import glob
import cv2
import numpy as np
import asyncio

try:
    from ultralytics import SAM
    # Lazily initialized
    sam_model = None
except ImportError:
    sam_model = None
    print("Warning: ultralytics not installed. SAM inference will fail.")

router = APIRouter()

# Default base directory is the parent directory of backend/
DEFAULT_BASE_DIR = os.path.abspath(os.path.join(os.getcwd(), ".."))

class DatasetManager:
    def __init__(self, base_dir: str):
        self.base_dir = os.path.abspath(base_dir)
        self.dataset_dir = os.path.join(self.base_dir, "dataset")
        self.images_dir = os.path.join(self.dataset_dir, "images")
        self.labels_dir = os.path.join(self.dataset_dir, "labels")
        self.models_dir = os.path.join(self.base_dir, "models")
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.dataset_dir, exist_ok=True)
        os.makedirs(self.images_dir, exist_ok=True)
        os.makedirs(self.labels_dir, exist_ok=True)
        os.makedirs(self.models_dir, exist_ok=True)

    def set_location(self, new_path: str):
        if not new_path or not new_path.strip():
            raise ValueError("Dataset path cannot be empty.")
        
        target_dir = os.path.abspath(os.path.normpath(new_path.strip()))
        if not os.path.exists(target_dir):
            raise ValueError(f"Directory '{target_dir}' does not exist.")
        if not os.path.isdir(target_dir):
            raise ValueError(f"'{target_dir}' is not a directory.")

        self.dataset_dir = target_dir

        # Check if there is an images/ subfolder or if images are in the root of dataset_dir
        sub_images = os.path.join(target_dir, "images")
        sub_labels = os.path.join(target_dir, "labels")

        # Count images in sub_images vs root target_dir
        def count_images_in(path):
            if not os.path.isdir(path):
                return 0
            cnt = 0
            for f in os.listdir(path):
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp')):
                    cnt += 1
            return cnt

        if os.path.isdir(sub_images) and (count_images_in(sub_images) > 0 or not count_images_in(target_dir)):
            self.images_dir = sub_images
        else:
            # If images are in the folder directly
            self.images_dir = target_dir

        if os.path.isdir(sub_labels):
            self.labels_dir = sub_labels
        else:
            # Create labels directory inside target_dir
            labels_path = os.path.join(target_dir, "labels")
            os.makedirs(labels_path, exist_ok=True)
            self.labels_dir = labels_path

    def get_classes_file(self) -> str:
        # Check if classes.txt exists in dataset_dir or in labels_dir or in parent
        candidates = [
            os.path.join(self.dataset_dir, "classes.txt"),
            os.path.join(self.labels_dir, "classes.txt"),
            os.path.join(self.dataset_dir, "notes.json")
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return os.path.join(self.dataset_dir, "classes.txt")

    def read_classes(self) -> List[str]:
        classes_file = self.get_classes_file()
        if os.path.exists(classes_file):
            try:
                with open(classes_file, "r", encoding="utf-8") as f:
                    lines = [line.strip() for line in f.readlines() if line.strip()]
                    return lines
            except Exception as e:
                print(f"Failed to read classes.txt: {e}")
        return []

    def save_classes(self, class_names: List[str]):
        classes_file = os.path.join(self.dataset_dir, "classes.txt")
        try:
            with open(classes_file, "w", encoding="utf-8") as f:
                for name in class_names:
                    cleaned = name.strip()
                    if cleaned:
                        f.write(f"{cleaned}\n")
        except Exception as e:
            raise RuntimeError(f"Failed to save classes.txt: {e}")

    def list_images(self):
        images = []
        if os.path.exists(self.images_dir):
            for f in os.listdir(self.images_dir):
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp')):
                    images.append(f)
        
        # Sort naturally or alphabetically
        images.sort()

        annotated = []
        for img in images:
            label_file = os.path.splitext(img)[0] + ".txt"
            if os.path.exists(os.path.join(self.labels_dir, label_file)):
                annotated.append(img)

        return images, annotated

dataset_manager = DatasetManager(DEFAULT_BASE_DIR)

# Pydantic models
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

class SaveAllLabelsRequest(BaseModel):
    image_name: str
    polygons: List[dict] # List of {"classId": int, "points": [[x,y],...]}

class LoadModelRequest(BaseModel):
    model_type: str # 'yolo' or 'sam'
    model_name: str

class SetLocationRequest(BaseModel):
    dataset_path: str

class SaveClassesRequest(BaseModel):
    classes: Optional[List[dict]] = None # [{"id": 0, "name": "Plastic", ...}]
    names: Optional[List[str]] = None    # ["Plastic", "Paper", ...]


@router.get("/dataset")
async def get_dataset():
    try:
        images, annotated = dataset_manager.list_images()
        class_names = dataset_manager.read_classes()
        
        return {
            "dataset_path": dataset_manager.dataset_dir,
            "images_path": dataset_manager.images_dir,
            "labels_path": dataset_manager.labels_dir,
            "images": images,
            "annotated": annotated,
            "classes": class_names
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dataset/set_location")
async def set_dataset_location(req: SetLocationRequest):
    try:
        dataset_manager.set_location(req.dataset_path)
        images, annotated = dataset_manager.list_images()
        class_names = dataset_manager.read_classes()
        return {
            "status": "success",
            "message": f"Dataset attached successfully from {dataset_manager.dataset_dir}",
            "dataset_path": dataset_manager.dataset_dir,
            "images_path": dataset_manager.images_dir,
            "labels_path": dataset_manager.labels_dir,
            "images": images,
            "annotated": annotated,
            "classes": class_names
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _run_tkinter_browse(initial_dir: str):
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected_dir = filedialog.askdirectory(
            initialdir=initial_dir if os.path.exists(initial_dir) else os.getcwd(),
            title="Select Dataset Main Folder"
        )
        root.destroy()
        return selected_dir
    except Exception as e:
        print(f"Tkinter browse error: {e}")
        return None

@router.post("/dataset/browse")
async def browse_dataset_folder():
    try:
        initial = dataset_manager.dataset_dir
        selected = await asyncio.to_thread(_run_tkinter_browse, initial)
        if selected:
            dataset_manager.set_location(selected)
            images, annotated = dataset_manager.list_images()
            class_names = dataset_manager.read_classes()
            return {
                "status": "success",
                "dataset_path": dataset_manager.dataset_dir,
                "images_path": dataset_manager.images_dir,
                "labels_path": dataset_manager.labels_dir,
                "images": images,
                "annotated": annotated,
                "classes": class_names
            }
        else:
            return {"status": "cancelled", "dataset_path": dataset_manager.dataset_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/classes")
async def get_classes():
    try:
        class_names = dataset_manager.read_classes()
        return {
            "names": class_names,
            "classes": [{"id": idx, "name": name} for idx, name in enumerate(class_names)]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/classes")
async def save_classes(req: SaveClassesRequest):
    try:
        names_to_save = []
        if req.names is not None:
            names_to_save = [n for n in req.names if n and n.strip()]
        elif req.classes is not None:
            # Sort by id or maintain order
            sorted_classes = sorted(req.classes, key=lambda x: x.get('id', 0))
            names_to_save = [c.get('name', '').strip() for c in sorted_classes if c.get('name', '').strip()]
        
        dataset_manager.save_classes(names_to_save)
        return {
            "status": "success",
            "names": names_to_save,
            "classes": [{"id": idx, "name": name} for idx, name in enumerate(names_to_save)]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_image")
async def upload_image(file: UploadFile = File(...)):
    try:
        file_location = os.path.join(dataset_manager.images_dir, file.filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_model")
async def upload_model(file: UploadFile = File(...)):
    try:
        file_location = os.path.join(dataset_manager.models_dir, file.filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
async def get_models():
    try:
        models = []
        if os.path.exists(dataset_manager.models_dir):
            for f in os.listdir(dataset_manager.models_dir):
                if f.lower().endswith('.pt'):
                    models.append(f)
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load_model")
async def load_model(req: LoadModelRequest):
    model_path = os.path.join(dataset_manager.models_dir, req.model_name)
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found")
    
    return {"status": "success", "message": f"{req.model_type.upper()} model loaded successfully"}

@router.post("/inference/yolo")
async def run_yolo(req: InferenceRequestYOLO):
    image_path = os.path.join(dataset_manager.images_dir, req.image_name)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Mock response for now: returning a square polygon
    return {"polygon": [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]], "confidence": 0.95, "class_id": 0}

@router.post("/inference/sam")
async def run_sam(req: InferenceRequestSAM):
    global sam_model
    if sam_model is None:
        try:
            from ultralytics import SAM
            print("Lazy loading SAM2 Large model...")
            # Look for sam model in backend or models folder
            sam_candidates = [
                os.path.join(os.getcwd(), "sam2_l.pt"),
                os.path.join(os.getcwd(), "sam2_b.pt"),
                os.path.join(dataset_manager.models_dir, "sam2_l.pt"),
                "sam2_l.pt"
            ]
            chosen_sam = "sam2_l.pt"
            for c in sam_candidates:
                if os.path.exists(c):
                    chosen_sam = c
                    break
            sam_model = SAM(chosen_sam)
        except ImportError:
            raise HTTPException(status_code=500, detail="SAM model not loaded. Please install ultralytics.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load SAM: {e}")
            
    image_path = os.path.join(dataset_manager.images_dir, req.image_name)
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
    label_path = os.path.join(dataset_manager.labels_dir, label_file)
    
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
    label_path = os.path.join(dataset_manager.labels_dir, label_file)
    
    try:
        with open(label_path, "a") as f:
            # YOLO format: class_id x1 y1 x2 y2 ...
            coords_str = " ".join([f"{pt[0]:.6f} {pt[1]:.6f}" for pt in req.polygon])
            f.write(f"{req.class_id} {coords_str}\n")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save_all")
async def save_all_labels(req: SaveAllLabelsRequest):
    label_file = os.path.splitext(req.image_name)[0] + ".txt"
    label_path = os.path.join(dataset_manager.labels_dir, label_file)
    
    try:
        # If the polygons list is empty, delete the file to keep directory clean
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
