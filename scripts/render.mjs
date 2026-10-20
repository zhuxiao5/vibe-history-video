import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const has = (key) => args.includes(key);
const opt = (key, fallback) => {
  const index = args.indexOf(key);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

if (has('--help')) {
  console.log(
    'Usage: node render.mjs --root <scene directory> --out <film.mp4> [--fps 24] [--frames 0,3,8] [--page index.html] [--gpu metal] [--crf 19] [--overwrite]\n' +
      'Requires scene.js or a native render(t)/CAPTURE page, Playwright Chromium, ffmpeg and ffprobe. No audio unless scene.js exports audioWav().\n' +
      'Existing MP4/PNG outputs are preserved unless --overwrite is provided.\n' +
      'Set MOTION_PLAYWRIGHT_MODULE and/or MOTION_CHROMIUM_EXECUTABLE to reuse local installations.\n' +
      '--crf 19 (default) = high quality; 23 trades some detail for smaller output; compare final frames.',
  );
  process.exit(0);
}

const root = await realpath(path.resolve(opt('--root', '.')));
const out = path.resolve(opt('--out', path.join(root, 'film.mp4')));
const fps = Number(opt('--fps', '24'));
const framesArg = opt('--frames', '');
const times = framesArg
  ? framesArg
      .split(',')
      .filter((value) => value.length > 0)
      .map(Number)
  : [];
const overwrite = has('--overwrite');
// CRF controls quality/size; moving texture can greatly increase bitrate.
const crf = Number(opt('--crf', '19'));
if (!Number.isFinite(crf) || crf < 0 || crf > 51) {
  throw Error('--crf must be 0..51');
}

if (!Number.isInteger(fps) || fps < 1 || fps > 60) {
  throw Error('fps must be 1..60');
}

const nativePage = opt('--page', '');
const gpu = opt('--gpu', 'default');
if (!['default', 'metal'].includes(gpu)) {
  throw Error('--gpu must be default or metal (macOS)');
}
if (nativePage && (path.isAbsolute(nativePage) || nativePage.split('/').includes('..'))) {
  throw Error('--page must stay inside the project');
}
for (const time of times) {
  if (!Number.isFinite(time) || time < 0) {
    throw Error('--frames values must be finite numbers >= 0');
  }
}

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromSkill = createRequire(path.join(skill, 'package.json'));

const resolvePlaywright = () => {
  const explicit =
    process.env.MOTION_PLAYWRIGHT_MODULE || process.env.VIBE_PLAYWRIGHT_MODULE;
  if (explicit) {
    try {
      return requireFromSkill.resolve(explicit);
    } catch {
      return path.resolve(explicit);
    }
  }

  for (const base of [skill, root]) {
    try {
      return createRequire(path.join(base, 'package.json')).resolve('playwright');
    } catch {
      // Try the next project-local installation.
    }
  }
  return null;
};

const exists = async (file) => {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

const stem = out.replace(/\.[^.]+$/, '');
const framePaths = times.map((time) => `${stem}-${time.toFixed(3)}.png`);
const protectedTargets = times.length ? framePaths : [out, `${stem}-poster.png`, `${stem}-render-report.json`, `${stem}-score.wav`];
if (!overwrite) {
  const existing = [];
  for (const target of protectedTargets) {
    if (await exists(target)) existing.push(target);
  }
  if (existing.length) {
    throw Error(
      `Refusing to overwrite existing ${times.length ? 'frame' : 'film'} output${
        existing.length === 1 ? '' : 's'
      }: ${existing.join(', ')}. Re-run with --overwrite to replace it.`,
    );
  }
}

const dependency = resolvePlaywright();
if (!dependency) {
  throw Error(
    'Playwright not installed. Set MOTION_PLAYWRIGHT_MODULE to a local Playwright entry point, or run npm ci in this Skill directory.',
  );
}

const playwright = await import(pathToFileURL(dependency).href);
const chromium = playwright.chromium || playwright.default?.chromium;
if (!chromium) {
  throw Error('Playwright chromium export unavailable');
}

const host = `<!doctype html><meta charset="utf-8"><canvas></canvas><script type="module">import * as s from '/scene.js'; await s.ready;await document.fonts.ready;const c=document.querySelector('canvas');c.width=s.width;c.height=s.height;const g=c.getContext('2d');window.film={width:s.width,height:s.height,duration:s.duration,async draw(t,type='image/jpeg'){g.reset();await s.render(g,t);return c.toDataURL(type,.94)},audio:async()=>{let a=await s.audioWav?.();if(!a)return null;if(typeof a==='string')return a;let x='';for(let i=0;i<a.length;i+=16000)x+=String.fromCharCode(...a.subarray(i,i+16000));return btoa(x)}};</script>`;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' && !nativePage) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(host);
      return;
    }
    const requested = url.pathname === '/' && nativePage ? `/${nativePage}` : url.pathname;
    const file = await realpath(path.resolve(root, `.${decodeURIComponent(requested)}`));
    if (!file.startsWith(`${root}${path.sep}`)) throw Error('outside root');
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const errors = [];
const blocked = [];
const chromiumExecutable =
  process.env.MOTION_CHROMIUM_EXECUTABLE || process.env.VIBE_CHROMIUM_EXECUTABLE;
let browser;
let encoder;

await mkdir(path.dirname(out), { recursive: true });

const writeFrame = async (target, data) => {
  await writeFile(target, data, overwrite ? undefined : { flag: 'wx' });
};

try {
  const launchOptions = {
    headless: true,
    args: gpu === 'metal' ? ['--use-angle=metal', '--enable-gpu'] : [],
  };
  if (chromiumExecutable) launchOptions.executablePath = path.resolve(chromiumExecutable);
  browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.route('**/*', (route) => {
    const requestUrl = route.request().url();
    if (
      requestUrl.startsWith(`${url}/`) ||
      requestUrl.startsWith('data:') ||
      requestUrl.startsWith('blob:')
    ) {
      return route.continue();
    }
    blocked.push(requestUrl);
    return route.abort();
  });
  await page.goto(url);

  if (nativePage) {
    await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
    await page.evaluate(() => {
      if (
        typeof window.render !== 'function' ||
        !(window.CAPTURE instanceof HTMLCanvasElement)
      ) {
        throw Error('Native page requires render(t), DUR, CAPTURE canvas, READY');
      }
      window.film = {
        width: window.CAPTURE.width,
        height: window.CAPTURE.height,
        duration: window.DUR,
        async draw(t, type = 'image/jpeg') {
          await window.render(t);
          return window.CAPTURE.toDataURL(type, 0.94);
        },
        audio: async () => {
          const audio = await window.audioWav?.();
          if (!audio) return null;
          if (typeof audio === 'string') return audio;
          let result = '';
          for (let index = 0; index < audio.length; index += 16000) {
            result += String.fromCharCode(...audio.subarray(index, index + 16000));
          }
          return btoa(result);
        },
      };
    });
  }

  await page.waitForFunction(() => window.film, null, { timeout: 30000 });
  const info = await page.evaluate(() => ({
    width: window.film.width,
    height: window.film.height,
    duration: window.film.duration,
  }));
  if (
    ![info.width, info.height].every(
      (value) => Number.isInteger(value) && value > 0 && value % 2 === 0,
    ) ||
    !Number.isFinite(info.duration) ||
    info.duration <= 0
  ) {
    throw Error('invalid dimensions/duration');
  }

  const grab = async (time, type = 'image/jpeg') =>
    Buffer.from(
      (
        await page.evaluate(
          async ({ time: drawTime, type: drawType }) => window.film.draw(drawTime, drawType),
          { time, type },
        )
      ).split(',')[1],
      'base64',
    );
  const checkAt = Math.min(2.371, info.duration * 0.31);
  const firstSeek = await grab(checkAt, 'image/png');
  await grab(info.duration * 0.81);
  const secondSeek = await grab(checkAt, 'image/png');
  if (!firstSeek.equals(secondSeek)) throw Error('non-deterministic seek');

  if (times.length) {
    for (let index = 0; index < times.length; index += 1) {
      const time = times[index];
      if (time >= info.duration) throw Error('frame outside duration');
      await writeFrame(framePaths[index], await grab(time, 'image/png'));
    }
    console.log(JSON.stringify({ frames: times, errors, blocked }));
  } else {
    const audio = await page.evaluate(() => window.film.audio());
    const params = [
      '-hide_banner',
      '-loglevel',
      'error',
      overwrite ? '-y' : '-n',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-framerate',
      String(fps),
      '-i',
      'pipe:0',
    ];
    if (audio) {
      const audioPath = `${stem}-score.wav`;
      await writeFile(audioPath, Buffer.from(audio, 'base64'));
      params.push('-i', audioPath, '-c:a', 'aac', '-b:a', '160k');
    }
    params.push(
      '-c:v',
      'libx264',
      '-threads',
      '2',
      '-preset',
      'fast',
      '-crf',
      String(crf),
      '-pix_fmt',
      'yuv420p',
      '-t',
      String(info.duration),
      '-movflags',
      '+faststart',
      out,
    );
    encoder = spawn('ffmpeg', params, { stdio: ['pipe', 'ignore', 'pipe'] });
    let log = '';
    encoder.stderr.on('data', (data) => {
      log += data;
    });
    encoder.stdin.on('error', () => {});
    const done = once(encoder, 'close');
    const frameCount = Math.ceil(info.duration * fps);
    const start = Date.now();
    for (let index = 0; index < frameCount; index += 1) {
      if (encoder.exitCode !== null) throw Error(log);
      if (!encoder.stdin.write(await grab(index / fps))) {
        await Promise.race([
          once(encoder.stdin, 'drain'),
          done.then(() => {
            throw Error(log || 'encoder stopped');
          }),
        ]);
      }
      if (index % (fps * 6) === 0) console.log(`${index}/${frameCount}`);
    }
    encoder.stdin.end();
    const [code] = await done;
    encoder = null;
    if (code !== 0) throw Error(log);

    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', out, '-f', 'null', '-'], {
      encoding: 'utf8',
    });
    if (decoded.status !== 0) throw Error(decoded.stderr);
    const probe = spawnSync(
      'ffprobe',
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', out],
      { encoding: 'utf8' },
    );
    if (probe.status !== 0) throw Error(probe.stderr);
    await writeFile(
      `${stem}-poster.png`,
      await grab(Math.min(3, info.duration * 0.2), 'image/png'),
    );
    await writeFile(
      `${stem}-render-report.json`,
      JSON.stringify(
        {
          ...info,
          fps,
          frames: frameCount,
          gpu,
          seconds: (Date.now() - start) / 1000,
          audio: Boolean(audio),
          decode: 'passed',
          seekRepeat: 'identical',
          seekSha256: createHash('sha256').update(firstSeek).digest('hex'),
          errors,
          blocked,
          probe: JSON.parse(probe.stdout),
        },
        null,
        2,
      ),
    );
    console.log(out);
  }

  if (errors.length || blocked.length) {
    throw Error(JSON.stringify({ errors, blocked }));
  }
} finally {
  encoder?.kill('SIGTERM');
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
