from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.routes import router as api_router
import os

app = FastAPI(title="YOLO & SAM2 Annotation Tool Backend")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use absolute paths relative to backend directory
BASE_DIR = os.path.abspath(os.path.join(os.getcwd(), ".."))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
IMAGES_DIR = os.path.join(DATASET_DIR, "images")

os.makedirs(IMAGES_DIR, exist_ok=True)

# Mount static files for images so the frontend can display them
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Include API router
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
