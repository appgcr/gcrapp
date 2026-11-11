import sys, os
sys.path.insert(0, r'd:\gcr\gcrapp\ValuationBackend')
import cv2, numpy as np, json
sharp = np.ones((600, 600, 3), dtype=np.uint8) * 255
cv2.putText(sharp, 'REGISTERED SALE DEED 8859/2018', (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,0), 2)
cv2.imwrite('temp_test_sharp.jpg', sharp)

blurry = cv2.GaussianBlur(sharp, (31, 31), 0)
cv2.imwrite('temp_test_blurry.jpg', blurry)

from ocr_service.ocr_engine import run_ocr
res_sharp = run_ocr('temp_test_sharp.jpg')
res_blurry = run_ocr('temp_test_blurry.jpg')

if os.path.exists('temp_test_sharp.jpg'): os.remove('temp_test_sharp.jpg')
if os.path.exists('temp_test_blurry.jpg'): os.remove('temp_test_blurry.jpg')

print(json.dumps({'sharp': res_sharp, 'blurry': res_blurry}))
