import { parseQrCode } from './state.js';

export const QR_CAMERA_STATES = Object.freeze([
  'idle',
  'requesting',
  'active',
  'paused',
  'denied',
  'unavailable',
  'busy',
  'error'
]);

export const QR_IMAGE_MESSAGES = Object.freeze({
  decode: 'この画像形式を読み取れませんでした。JPEG、PNG、WebPの画像を使用してください。',
  notFound: 'QRコードを確認できませんでした。QR全体が写っている、明るい画像でもう一度お試しください。'
});

let cameraStream = null;
let animationFrame = null;
let scanBusy = false;
let detector = null;
let cameraRequest = null;
let cameraContext = null;
let cameraState = 'idle';
let cameraGeneration = 0;
let lastScan = { code: '', at: 0 };

const detailedVideoConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1280 },
  height: { ideal: 720 }
};

const fallbackVideoConstraints = { facingMode: 'environment' };

const decodeCanvas = (canvas) => {
  if (typeof globalThis.jsQR !== 'function') return '';
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return globalThis.jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data || '';
};

const emitCode = (raw, onCode) => {
  const code = parseQrCode(raw, location.origin);
  if (!code) return false;
  const now = Date.now();
  if (lastScan.code === code && now - lastScan.at < 1800) return true;
  lastScan = { code, at: now };
  onCode(code);
  if (navigator.vibrate) navigator.vibrate(35);
  return true;
};

export function cameraErrorPresentation(error) {
  const name = String(error?.name || '');
  if (name === 'NotAllowedError') {
    return {
      state: 'denied',
      message: 'カメラへのアクセスが許可されていません。端末またはブラウザの設定で、SETAEのカメラ利用を許可してください。'
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { state: 'unavailable', message: '利用できるカメラが見つかりません。' };
  }
  if (name === 'NotReadableError') {
    return {
      state: 'busy',
      message: 'カメラを開始できませんでした。ほかのアプリがカメラを使用していないか確認してください。'
    };
  }
  if (name === 'SecurityError') {
    return { state: 'unavailable', message: 'カメラはHTTPS接続でのみ利用できます。' };
  }
  return { state: 'error', message: 'カメラを開始できませんでした。画像からの読み取りも利用できます。' };
}

const setCameraState = (state, message = '', tone = '') => {
  cameraState = QR_CAMERA_STATES.includes(state) ? state : 'error';
  cameraContext?.onState?.(cameraState, message, tone);
};

const stopScanLoop = () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  scanBusy = false;
};

const releaseStream = () => {
  stopScanLoop();
  const stream = cameraStream;
  cameraStream = null;
  if (cameraContext?.video) {
    cameraContext.video.pause?.();
    cameraContext.video.srcObject = null;
  }
  stream?.getTracks?.().forEach((track) => track.stop());
};

const scanFrame = async () => {
  const context = cameraContext;
  if (!cameraStream || !context || cameraState !== 'active') return;
  animationFrame = requestAnimationFrame(scanFrame);
  const { video, canvas, onCode } = context;
  if (scanBusy || video.readyState < 2 || !video.videoWidth) return;
  const scale = Math.min(1, (detector ? 900 : 640) / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, canvas.width, canvas.height);
  scanBusy = true;
  try {
    if (detector) {
      const results = await detector.detect(canvas);
      if (results?.[0]?.rawValue) emitCode(results[0].rawValue, onCode);
    } else {
      const raw = decodeCanvas(canvas);
      if (raw) emitCode(raw, onCode);
    }
  } catch {
    detector = null;
  } finally {
    setTimeout(() => { scanBusy = false; }, detector ? 90 : 160);
  }
};

const startScanLoop = () => {
  stopScanLoop();
  if (cameraStream && cameraState === 'active') animationFrame = requestAnimationFrame(scanFrame);
};

const handleVisibility = async () => {
  if (!cameraStream || !cameraContext) return;
  if (document.visibilityState === 'hidden') {
    stopScanLoop();
    cameraContext.video.pause?.();
    setCameraState('paused', 'カメラを一時停止しています。');
    return;
  }

  const tracks = cameraStream.getVideoTracks?.() || cameraStream.getTracks?.() || [];
  if (!tracks.length || tracks.some((track) => track.readyState === 'ended')) {
    releaseStream();
    setCameraState('paused', 'カメラの接続が終了しました。カメラを開始し直してください。', 'error');
    return;
  }
  try {
    await cameraContext.video.play();
    setCameraState('active', 'QRを枠の中央に入れてください。続けて読み取れます。');
    startScanLoop();
  } catch {
    setCameraState('paused', 'カメラを再開できませんでした。カメラを開始し直してください。', 'error');
  }
};

const handleTrackEnded = () => {
  if (!cameraStream) return;
  releaseStream();
  setCameraState('paused', 'カメラの接続が終了しました。カメラを開始し直してください。', 'error');
};

export function qrCameraActive() {
  return Boolean(cameraStream);
}

export function qrCameraState() {
  return cameraState;
}

export async function startQrCamera({ video, canvas, onCode, onStatus, onState }) {
  if (cameraRequest) return cameraRequest;
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = typeof DOMException === 'function'
      ? new DOMException('Camera unavailable', 'NotFoundError')
      : Object.assign(new Error('Camera unavailable'), { name: 'NotFoundError' });
    throw error;
  }

  releaseStream();
  cameraContext = { video, canvas, onCode, onStatus, onState };
  document.removeEventListener('visibilitychange', handleVisibility);
  document.addEventListener('visibilitychange', handleVisibility);
  setCameraState('requesting', 'カメラを準備しています…');
  const generation = ++cameraGeneration;

  cameraRequest = (async () => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: detailedVideoConstraints });
      } catch (error) {
        if (error?.name !== 'OverconstrainedError') throw error;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: fallbackVideoConstraints });
      }
      if (generation !== cameraGeneration) {
        stream?.getTracks?.().forEach((track) => track.stop());
        return null;
      }
      cameraStream = stream;
      cameraStream.getVideoTracks?.().forEach((track) => track.addEventListener?.('ended', handleTrackEnded, { once: true }));
      video.srcObject = cameraStream;
      await video.play();
      detector = null;
      if ('BarcodeDetector' in globalThis) {
        try { detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] }); }
        catch { detector = null; }
      }
      setCameraState('active', 'QRを枠の中央に入れてください。続けて読み取れます。');
      onStatus?.('QRを枠の中央に入れてください。続けて読み取れます。', '');
      startScanLoop();
      return cameraStream;
    } catch (error) {
      releaseStream();
      const presentation = cameraErrorPresentation(error);
      error.cameraPresentation = presentation;
      setCameraState(presentation.state, presentation.message, 'error');
      throw error;
    } finally {
      if (generation === cameraGeneration) cameraRequest = null;
    }
  })();
  return cameraRequest;
}

export function stopQrCamera() {
  const notify = cameraContext?.onState;
  cameraGeneration += 1;
  releaseStream();
  document.removeEventListener('visibilitychange', handleVisibility);
  cameraRequest = null;
  cameraContext = null;
  cameraState = 'idle';
  notify?.('idle', '', '');
}

const drawImageFile = async (file, canvas) => {
  let source = null;
  let objectUrl = '';
  try {
    if (typeof globalThis.createImageBitmap === 'function') {
      try { source = await globalThis.createImageBitmap(file); }
      catch { source = null; }
    }
    if (!source) {
      if (typeof Image !== 'function' || !globalThis.URL?.createObjectURL) throw new Error(QR_IMAGE_MESSAGES.decode);
      objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = 'async';
      image.src = objectUrl;
      if (typeof image.decode === 'function') await image.decode();
      else await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      source = image;
    }

    const width = Number(source.width || source.naturalWidth) || 0;
    const height = Number(source.height || source.naturalHeight) || 0;
    if (!width || !height) throw new Error(QR_IMAGE_MESSAGES.decode);
    const scale = Math.min(1, 1400 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height);
  } catch (error) {
    if (error?.message === QR_IMAGE_MESSAGES.decode) throw error;
    throw new Error(QR_IMAGE_MESSAGES.decode);
  } finally {
    source?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};

export async function decodeQrImage(file, canvas) {
  const isFile = typeof File === 'undefined' ? Boolean(file?.size) : file instanceof File;
  if (!isFile || !file.size) throw new Error('画像を選択してください。');
  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (file.type && !supportedTypes.has(String(file.type).toLowerCase())) throw new Error(QR_IMAGE_MESSAGES.decode);
  await drawImageFile(file, canvas);

  if ('BarcodeDetector' in globalThis) {
    try {
      const imageDetector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
      const result = await imageDetector.detect(canvas);
      const code = parseQrCode(result?.[0]?.rawValue || '', location.origin);
      if (code) return code;
    } catch {}
  }
  const code = parseQrCode(decodeCanvas(canvas), location.origin);
  if (!code) throw new Error(QR_IMAGE_MESSAGES.notFound);
  return code;
}
