import cv2
from ultralytics import SAM
import sys

try:
    sam = SAM('../models/sam2_l.pt') # or sam2_b.pt if l is not there. Wait, the route says SAM("sam2_l.pt"). Let's use sam2_l.pt
except:
    sam = SAM('sam2_b.pt')

img_path = '../dataset/images/img_00000010.png'

# simulate bounding box and multiple points
pixel_bbox = [100, 100, 300, 300]
pixel_points = [[150, 150], [200, 200]]
point_labels = [1, 1]

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
