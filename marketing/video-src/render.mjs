// [WIDTH=960] node render.mjs <out.mp4> [fps]  -> full video (WIDTH=960 gives 16:9), frames piped to ffmpeg
// node render.mjs --stills <dir> t1 t2 ...  -> one PNG per timestamp
import { chromium } from "/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";

const WIDTH = Number(process.env.WIDTH ?? 540);
const URL = `http://localhost:5288/video.html${WIDTH === 540 ? "" : "?wide"}`;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 540 }, deviceScaleFactor: 2 });
await page.goto(URL);
await page.evaluate(() => window.ready);

const [mode, target, ...rest] = process.argv.slice(2);
if (mode === "--stills") {
  for (const t of rest) {
    await page.evaluate((x) => window.render(x), Number(t));
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${target}/still-${t}.png` });
  }
} else {
  const fps = Number(target ?? 30);
  const duration = await page.evaluate(() => window.DURATION);
  const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mode], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(duration * fps);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.render(x), f / fps);
    const buf = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on("close", r));
}
await browser.close();
