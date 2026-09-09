import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadPromise = null;

export async function loadFaceApiModels() {
  if (modelsLoaded) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('Error loading FaceAPI models from /models:', err);
      // Fallback attempt from jsdelivr if local public folder fails in some runtime
      try {
        const CDN_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(CDN_URL)
        ]);
        modelsLoaded = true;
        return true;
      } catch (fallbackErr) {
        console.error('Fallback model load also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
  })();

  return loadPromise;
}

// Compute Euclidean distance between 2 2D points
function distance2D(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Calculate Eye Aspect Ratio (EAR) for blink detection
export function computeEyeAspectRatio(landmarks) {
  if (!landmarks || !landmarks.positions) return null;
  const pts = landmarks.positions;

  // Left Eye landmarks: 36, 37, 38, 39, 40, 41
  const leftEyeVertical1 = distance2D(pts[37], pts[41]);
  const leftEyeVertical2 = distance2D(pts[38], pts[40]);
  const leftEyeHorizontal = distance2D(pts[36], pts[39]);
  const leftEAR = (leftEyeVertical1 + leftEyeVertical2) / (2.0 * Math.max(leftEyeHorizontal, 0.001));

  // Right Eye landmarks: 42, 43, 44, 45, 46, 47
  const rightEyeVertical1 = distance2D(pts[43], pts[47]);
  const rightEyeVertical2 = distance2D(pts[44], pts[46]);
  const rightEyeHorizontal = distance2D(pts[42], pts[45]);
  const rightEAR = (rightEyeVertical1 + rightEyeVertical2) / (2.0 * Math.max(rightEyeHorizontal, 0.001));

  return (leftEAR + rightEAR) / 2.0;
}

// Analyze single frame from HTMLVideoElement
export async function analyzeFaceFrame(videoElement) {
  if (!modelsLoaded || !videoElement || videoElement.readyState < 2) {
    return { faceCount: 0, status: 'INITIALIZING' };
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5
  });

  // Detect all faces to ensure only 1 person is present (Anti-Proxy / High Security)
  const detections = await faceapi
    .detectAllFaces(videoElement, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptors();

  const faceCount = detections.length;

  if (faceCount === 0) {
    return { faceCount: 0, status: 'NO_FACE' };
  }

  if (faceCount > 1) {
    return { faceCount, status: 'MULTIPLE_FACES' };
  }

  const detection = detections[0];
  const box = detection.detection.box;
  const videoWidth = videoElement.videoWidth || 640;
  const videoHeight = videoElement.videoHeight || 480;

  // Check if face is centered and reasonably sized inside the frame
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const isCentered =
    centerX >= videoWidth * 0.25 &&
    centerX <= videoWidth * 0.75 &&
    centerY >= videoHeight * 0.2 &&
    centerY <= videoHeight * 0.8 &&
    box.width >= videoWidth * 0.22;

  const ear = computeEyeAspectRatio(detection.landmarks);

  return {
    faceCount: 1,
    status: isCentered ? 'ALIGNED' : 'NOT_CENTERED',
    detection: detection.detection,
    landmarks: detection.landmarks,
    descriptor: Array.from(detection.descriptor),
    expressions: detection.expressions,
    ear: ear,
    box: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    }
  };
}

// Compare live face descriptor with user's registered descriptor
export function compareWithRegisteredFace(liveDescriptor, registeredDescriptor) {
  if (!liveDescriptor || !registeredDescriptor || registeredDescriptor.length === 0) {
    return { isMatch: false, distance: 1.0, confidence: 0, reason: 'No registered face descriptor found' };
  }

  const distance = faceapi.euclideanDistance(liveDescriptor, registeredDescriptor);
  // Distance <= 0.55 is a solid match (0.6 is face-api default threshold)
  const isMatch = distance <= 0.55;
  // Calculate confidence percentage
  const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / 0.6) * 100)));

  return {
    isMatch,
    distance: parseFloat(distance.toFixed(3)),
    confidence
  };
}

export default faceapi;
