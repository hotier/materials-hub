/**
 * 媒体文件压缩工具
 * - 图片：Canvas API 缩放 + JPEG 重编码
 * - 音频：Web Audio API 解码 + lamejs 编码 MP3
 * - 视频：Canvas + MediaRecorder 降分辨率/码率
 */

// ====== 类型定义 ======

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
}

// ====== 图片压缩 ======

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
const IMAGE_SKIP_EXTS = ['gif', 'svg', 'ico'];

async function compressImage(
  file: File,
  maxDim = 1920,
  quality = 0.85,
): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 跳过不需要压缩的格式
  if (IMAGE_SKIP_EXTS.includes(ext)) return file;
  if (!IMAGE_EXTS.includes(ext) && !file.type.startsWith('image/')) return file;

  // 小文件跳过
  if (file.size < 300 * 1024) return file;

  // 加载图片
  const img = await loadImage(file);

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // 按最大边缩放
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 白色背景（处理 PNG 透明通道）
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // 转为 JPEG blob
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality);
  });

  // 只有压缩后更小才使用
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

// ====== 音频压缩 ======

const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a', 'aiff'];

async function compressAudio(file: File, bitrate = 128): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!AUDIO_EXTS.includes(ext) && !file.type.startsWith('audio/')) return file;

  // 小文件跳过
  if (file.size < 1024 * 1024) return file;

  // 动态导入 lamejs
  const lamejs = (await import('lamejs')).default ?? (await import('lamejs'));

  // 解码音频
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    // 浏览器无法解码此格式，跳过
    audioCtx.close();
    return file;
  }

  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;

  const left = floatToInt16(audioBuffer.getChannelData(0));
  const right = channels > 1 ? floatToInt16(audioBuffer.getChannelData(1)) : left;

  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
  const blockSize = 1152;
  const mp3Data: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = channels > 1 ? right.subarray(i, i + blockSize) : undefined;
    const mp3buf = rightChunk
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(new Uint8Array(end));

  audioCtx.close();

  // 合并 MP3 数据
  const totalLength = mp3Data.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  // 只有压缩后更小才使用
  if (result.length >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([result], `${baseName}.mp3`, { type: 'audio/mp3' });
}

function floatToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

// ====== 视频压缩 ======

const VIDEO_EXTS = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];

async function compressVideo(
  file: File,
  maxDim = 1280,
  bitrate = 2_000_000,
): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!VIDEO_EXTS.includes(ext) && !file.type.startsWith('video/')) return file;

  // 小文件跳过
  if (file.size < 5 * 1024 * 1024) return file;

  // 创建 video 元素加载文件
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  // 等待元数据加载
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
  });

  // 超过 5 分钟的视频跳过（实时处理太慢）
  if (video.duration > 300) {
    URL.revokeObjectURL(video.src);
    return file;
  }

  // 计算目标尺寸
  let width = video.videoWidth;
  let height = video.videoHeight;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 获取画布视频流
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // 尝试从 video 元素获取音频轨道
  let audioTracks: MediaStreamTrack[] = [];
  try {
    const videoStream =
      (video as any).captureStream?.() ?? (video as any).mozCaptureStream?.();
    audioTracks = videoStream?.getAudioTracks?.() ?? [];
  } catch {
    // 音频捕获不支持，继续无音频
  }

  // 合并视频和音频轨道
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ]);

  // 选择最佳编码格式
  const mimeType = pickVideoMimeType();
  if (!mimeType) {
    URL.revokeObjectURL(video.src);
    return file;
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  // 开始录制和播放
  recorder.start(100);
  video.play();

  // 逐帧绘制
  await new Promise<void>((resolve) => {
    function drawFrame() {
      if (video.ended) {
        recorder.stop();
        resolve();
        return;
      }
      ctx.drawImage(video, 0, 0, width, height);
      requestAnimationFrame(drawFrame);
    }
    drawFrame();
  });

  const blob = await done;
  URL.revokeObjectURL(video.src);

  // 只有压缩后更小才使用
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.webm`, { type: 'video/webm' });
}

function pickVideoMimeType(): string | null {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

// ====== 统一入口 ======

export async function compressMedia(file: File): Promise<CompressResult> {
  const originalSize = file.size;
  let result = file;

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const type = file.type;

    if (type.startsWith('image/') || IMAGE_EXTS.includes(ext)) {
      result = await compressImage(file);
    } else if (type.startsWith('audio/') || AUDIO_EXTS.includes(ext)) {
      result = await compressAudio(file);
    } else if (type.startsWith('video/') || VIDEO_EXTS.includes(ext)) {
      result = await compressVideo(file);
    }
  } catch (e) {
    console.warn('[compressMedia] compression failed, using original:', e);
    result = file;
  }

  return {
    file: result,
    originalSize,
    compressedSize: result.size,
    compressed: result !== file,
  };
}
