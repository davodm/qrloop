import "./style.css";
import { Buffer } from "buffer";
import QRCode from "qrcode";
import { dataToFrames } from "qrloop";

(window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <main class="layout">
    <header>
      <h1>qrloop exporter</h1>
      <p>Encode text or a binary file into a looping QR stream.</p>
    </header>
    <section class="form" id="form">
      <label>
        Text
        <textarea id="text" rows="8" placeholder="Type text to export…"></textarea>
      </label>
      <label>
        Or choose a file
        <input id="file" type="file" />
      </label>
      <label>
        Bytes per frame
        <input id="dataSize" type="number" min="40" max="300" value="120" />
      </label>
      <label>
        Loops
        <input id="loops" type="number" min="1" max="10" value="4" />
      </label>
      <label>
        FPS
        <input id="fps" type="number" min="1" max="15" value="5" />
      </label>
      <button id="start" type="button">Start QR loop</button>
      <p class="meta" id="meta"></p>
    </section>
    <section class="player hidden" id="player">
      <canvas id="qr" width="480" height="480"></canvas>
      <p class="meta" id="status"></p>
      <button id="stop" type="button">Back</button>
    </section>
  </main>
`;

const textEl = document.querySelector<HTMLTextAreaElement>("#text")!;
const fileEl = document.querySelector<HTMLInputElement>("#file")!;
const dataSizeEl = document.querySelector<HTMLInputElement>("#dataSize")!;
const loopsEl = document.querySelector<HTMLInputElement>("#loops")!;
const fpsEl = document.querySelector<HTMLInputElement>("#fps")!;
const metaEl = document.querySelector<HTMLParagraphElement>("#meta")!;
const formEl = document.querySelector<HTMLElement>("#form")!;
const playerEl = document.querySelector<HTMLElement>("#player")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const canvas = document.querySelector<HTMLCanvasElement>("#qr")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start")!;
const stopBtn = document.querySelector<HTMLButtonElement>("#stop")!;

let fileBytes: Buffer | null = null;
let raf = 0;
let lastT = 0;
let frameIndex = 0;
let frames: string[] = [];
let fps = 5;

fileEl.addEventListener("change", async () => {
  const file = fileEl.files?.[0];
  if (!file) {
    fileBytes = null;
    metaEl.textContent = "";
    return;
  }
  const buf = Buffer.from(await file.arrayBuffer());
  fileBytes = buf;
  metaEl.textContent = `Loaded ${file.name} (${buf.length} bytes)`;
});

async function paint(data: string): Promise<void> {
  await QRCode.toCanvas(canvas, data, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
    color: { dark: "#111111", light: "#ffffff" },
  });
}

function tick(t: number): void {
  raf = requestAnimationFrame(tick);
  if (!lastT) lastT = t;
  if ((t - lastT) * fps < 1000) return;
  lastT = t;
  frameIndex = (frameIndex + 1) % frames.length;
  void paint(frames[frameIndex]);
  statusEl.textContent = `Frame ${frameIndex + 1} / ${frames.length}`;
}

function stop(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  lastT = 0;
  frameIndex = 0;
  frames = [];
  playerEl.classList.add("hidden");
  formEl.classList.remove("hidden");
}

startBtn.addEventListener("click", () => {
  const dataSize = Number(dataSizeEl.value) || 120;
  const loops = Number(loopsEl.value) || 4;
  fps = Number(fpsEl.value) || 5;

  const payload: Buffer | string = fileBytes ?? textEl.value;
  if (typeof payload === "string" && payload.length === 0) {
    metaEl.textContent = "Enter text or choose a file first.";
    return;
  }

  frames = dataToFrames(payload, dataSize, loops);
  const byteLen =
    typeof payload === "string" ? Buffer.byteLength(payload) : payload.length;
  statusEl.textContent = `${byteLen} bytes → ${frames.length} QR frames`;
  formEl.classList.add("hidden");
  playerEl.classList.remove("hidden");
  void paint(frames[0]).then(() => {
    raf = requestAnimationFrame(tick);
  });
});

stopBtn.addEventListener("click", stop);
