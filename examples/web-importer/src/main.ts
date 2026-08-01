import "./style.css";
import { Buffer } from "buffer";
import jsQR from "jsqr";
import {
  parseFramesReducer,
  areFramesComplete,
  framesToData,
  progressOfFrames,
  indexesOfFrames,
  missingIndexesOfFrames,
  currentNumberOfFrames,
  totalNumberOfFrames,
  type State,
} from "qrloop";

(window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

type BarcodeDetectorLike = {
  detect: (
    source: ImageBitmapSource
  ) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options: {
  formats: string[];
}) => BarcodeDetectorLike;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <main class="layout">
    <header>
      <h1>qrloop importer</h1>
      <p>Scan a looping QR stream with your camera and reassemble the payload.</p>
    </header>
    <section class="controls">
      <button id="start" type="button">Start camera</button>
      <button id="reset" type="button" class="ghost">Reset</button>
    </section>
    <section class="stage">
      <video id="video" playsinline muted></video>
      <canvas id="work" class="hidden"></canvas>
    </section>
    <section class="status">
      <p id="progress">Progress: 0%</p>
      <p id="detail">Waiting for camera…</p>
      <pre id="result" class="hidden"></pre>
      <a id="download" class="hidden" download="qrloop-payload.bin">Download binary</a>
    </section>
  </main>
`;

const startBtn = document.querySelector<HTMLButtonElement>("#start")!;
const resetBtn = document.querySelector<HTMLButtonElement>("#reset")!;
const video = document.querySelector<HTMLVideoElement>("#video")!;
const work = document.querySelector<HTMLCanvasElement>("#work")!;
const progressEl = document.querySelector<HTMLParagraphElement>("#progress")!;
const detailEl = document.querySelector<HTMLParagraphElement>("#detail")!;
const resultEl = document.querySelector<HTMLPreElement>("#result")!;
const downloadEl = document.querySelector<HTMLAnchorElement>("#download")!;

let state: State = null;
let stream: MediaStream | null = null;
let raf = 0;
let done = false;
let detector: BarcodeDetectorLike | null = null;

const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
  .BarcodeDetector;

function reset(): void {
  state = null;
  done = false;
  progressEl.textContent = "Progress: 0%";
  detailEl.textContent = stream ? "Scanning…" : "Waiting for camera…";
  resultEl.classList.add("hidden");
  resultEl.textContent = "";
  downloadEl.classList.add("hidden");
  downloadEl.removeAttribute("href");
}

function ingest(raw: string): void {
  if (done || !raw) return;
  try {
    state = parseFramesReducer(state, raw);
  } catch {
    return;
  }

  const progress = Math.round(progressOfFrames(state) * 100);
  const have = currentNumberOfFrames(state);
  const total = totalNumberOfFrames(state) ?? "?";
  const missing = missingIndexesOfFrames(state);
  progressEl.textContent = `Progress: ${progress}%`;
  detailEl.textContent = `Frames ${have}/${total}. Have [${indexesOfFrames(state).join(", ")}]${
    missing.length ? ` · missing [${missing.join(", ")}]` : ""
  }`;

  if (!areFramesComplete(state)) return;

  done = true;
  const data = framesToData(state);
  const asText = data.toString("utf8");
  const printable = /^[\x09\x0a\x0d\x20-\x7e]*$/.test(asText);

  if (printable) {
    resultEl.textContent = asText;
    resultEl.classList.remove("hidden");
    detailEl.textContent = `Complete (${data.length} bytes as text)`;
  } else {
    resultEl.textContent = `Binary payload (${data.length} bytes)\nsha-ish preview: ${data
      .subarray(0, 32)
      .toString("hex")}…`;
    resultEl.classList.remove("hidden");
    detailEl.textContent = `Complete (${data.length} bytes binary)`;
  }

  const blob = new Blob([Uint8Array.from(data)], {
    type: "application/octet-stream",
  });
  downloadEl.href = URL.createObjectURL(blob);
  downloadEl.classList.remove("hidden");
}

async function detectFromFrame(): Promise<string | null> {
  if (detector) {
    const codes = await detector.detect(video);
    return codes[0]?.rawValue ?? null;
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const code = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
  return code?.data ?? null;
}

async function loop(): Promise<void> {
  raf = requestAnimationFrame(() => {
    void loop();
  });
  if (done || video.readyState < 2) return;
  const value = await detectFromFrame();
  if (value) ingest(value);
}

async function startCamera(): Promise<void> {
  if (stream) return;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  });
  video.srcObject = stream;
  await video.play();

  if (typeof Detector === "function") {
    try {
      detector = new Detector({ formats: ["qr_code"] });
      detailEl.textContent = "Scanning with BarcodeDetector…";
    } catch {
      detector = null;
      detailEl.textContent = "Scanning with jsQR fallback…";
    }
  } else {
    detailEl.textContent = "Scanning with jsQR fallback…";
  }

  void loop();
}

startBtn.addEventListener("click", () => {
  void startCamera().catch((err: unknown) => {
    detailEl.textContent =
      err instanceof Error ? err.message : "Camera permission failed";
  });
});

resetBtn.addEventListener("click", reset);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
});
