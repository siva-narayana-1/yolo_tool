import cv2
from ultralytics import SAM
import numpy as np

sam = SAM('sam2_b.pt')

img_path = '../dataset/images/img_00000010.png'

pixel_bbox = [100, 100, 300, 300]

# Test 1: Bbox only
res1 = sam(img_path, bboxes=[pixel_bbox], verbose=False)
mask1 = res1[0].masks.xy[0]

# Test 2: Bbox + positive point
res2 = sam(img_path, bboxes=[pixel_bbox], points=[[[200, 200]]], labels=[[1]], verbose=False)
mask2 = res2[0].masks.xy[0]

# Test 3: Bbox + negative point
res3 = sam(img_path, bboxes=[pixel_bbox], points=[[[200, 200]]], labels=[[0]], verbose=False)
mask3 = res3[0].masks.xy[0]

print("Mask 1 length:", len(mask1))
print("Mask 2 length:", len(mask2))
print("Mask 3 length:", len(mask3))
print("Mask 1 == Mask 2:", np.array_equal(mask1, mask2))
print("Mask 1 == Mask 3:", np.array_equal(mask1, mask3))
