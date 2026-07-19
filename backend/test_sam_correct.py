import cv2
from ultralytics import SAM
import sys

# Load the model from the local backend folder
sam = SAM('sam2_b.pt')

img_path = '../dataset/images/img_00000010.png'

pixel_bbox = [100, 100, 300, 300]
pixel_points = [[150, 150]]
point_labels = [1]

try:
    results = sam(img_path, bboxes=[pixel_bbox], points=[pixel_points], labels=[point_labels], verbose=False)
    print("Success:", len(results))
    if results and len(results[0].masks) > 0:
        print("Got mask!")
    else:
        print("No mask generated")
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()
