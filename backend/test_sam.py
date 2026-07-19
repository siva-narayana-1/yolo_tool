import cv2
from ultralytics import SAM

sam = SAM("sam2_b.pt")

img_path = "dataset/images/img_00000010.png"
img = cv2.imread(img_path)
h, w = img.shape[:2]

bbox = [[100, 100, 300, 300]]
points = [[[200, 200]]]
labels = [[1]]

try:
    results = sam(img_path, bboxes=bbox, points=points, labels=labels)
    print("Success:", len(results))
except Exception as e:
    print("Error:", e)
