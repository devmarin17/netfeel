// Reaction Lab — prototype app (see SPEC.md).
// Pairs with signals.js (calibrate, features) and algorithm.js (summarize, updateProfile, recommend),
// written to the data contract in SPEC.md. No frameworks, no build step.

import { calibrate, features } from './signals.js';
import { summarize, updateProfile, recommend } from './algorithm.js';

// ---------------------------------------------------------------- constants

const FEELINGS = {
  laugh:  { label: 'Laugh',  emoji: '😄', color: '#ffd166' },
  thrill: { label: 'Thrill', emoji: '😱', color: '#ff5252' },
  calm:   { label: 'Calm',   emoji: '😌', color: '#4dd0c4' },
  moved:  { label: 'Moved',  emoji: '🥲', color: '#b18cff' },
};
const FEELING_KEYS = Object.keys(FEELINGS);

const METER_KEYS = ['joy', 'surprise', 'tension', 'drowsy', 'attention', 'leanIn'];
const METER_COLORS = {
  joy: '#ffd166', surprise: '#ff5252', tension: '#b18cff',
  drowsy: '#4dd0c4', attention: '#5aa2ff', leanIn: '#3ddc84',
};

const TASKS_VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = './models/face_landmarker.task';
const YT_API_URL = 'https://www.youtube.com/iframe_api';
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 }; // YT.PlayerState values

const PROFILE_KEY = 'reaction-lab-profile';
const SAMPLE_MS = 100;      // ~10 fps face readings
const CALIB_SECONDS = 3;    // baseline = first 3 s of a clip
const RAD = 180 / Math.PI;

// ---------------------------------------------------------------- dom

const $ = (id) => document.getElementById(id);
const video = $('video');
const camPreview = $('cam-preview');
const els = {
  stageEmpty: $('stage-empty'),
  playerStage: $('player-stage'),
  nowTitle: $('now-playing-title'),
  nowTag: $('now-playing-tag'),
  clock: $('player-clock'),
  btnSkip: $('btn-skip'),
  btnExport: $('btn-export'),
  btnCamera: $('btn-camera'),
  camState: $('cam-state'),
  camRow: $('cam-row'),
  faceChip: $('face-chip'),
  fileInput: $('file-input'),
  btnYouTube: $('btn-youtube'),
  ytForm: $('yt-form'),
  ytUrl: $('yt-url'),
  ytIntended: $('yt-intended'),
  ytCancel: $('yt-cancel'),
  clipList: $('clip-list'),
  libraryEmpty: $('library-empty'),
  meters: $('meters'),
  baselineNote: $('baseline-note'),
  receipt: $('receipt'),
  receiptEmpty: $('receipt-empty'),
  wantButtons: $('want-buttons'),
  recs: $('recs'),
  recsEmpty: $('recs-empty'),
  toasts: $('toasts'),
};

// ---------------------------------------------------------------- state

let clipSeq = 0;
const state = {
  clips: [],            // { id, name, intended, duration, url, seen, lastHit }
  current: null,        // clip object loaded into the player
  session: null,        // { frames: [], events: [], baseline, baselineTriedAt, played }
  sessions: [],         // finished: { clip, frames, events, receipt }
  cameraOn: false,
  stream: null,
  landmarker: null,
  landmarkerPromise: null,
  wanted: null,
  profile: loadProfile(),
  lastFeatures: null,
  sampleTimer: null,
  lastDetectTs: 0,
};

// YouTube IFrame Player (one reusable player; see the YouTube section below)
let ytPlayer = null;
let ytPlayerReady = false;
let ytState = -1;        // last YT onStateChange value
let ytTicker = null;     // ~10fps poll while a YouTube clip is loaded
let ytLastTime = null;   // previous getCurrentTime(), for seek detection
let ytLastWall = null;   // performance.now() of the previous poll, to know the expected delta
let ytLastSeekAt = 0;

// ---------------------------------------------------------------- utils

function fmt(t) {
  t = Math.max(0, Math.floor(t || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' toast-error' : '');
  el.textContent = msg;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), 4600);
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) ?? null; }
  catch { return null; }
}

function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile)); return true; }
  catch { return false; }
}

function cleanClip(c) {
  const out = { id: c.id, name: c.name, intended: c.intended, duration: c.duration };
  if (c.source) out.source = c.source;
  if (c.youtubeId) out.youtubeId = c.youtubeId;
  return out;
}

// ---------------------------------------------------------------- library

function addFiles(fileList) {
  for (const file of Array.from(fileList)) {
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) continue;
    const clip = {
      id: `c${++clipSeq}-${Date.now().toString(36)}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      intended: 'laugh',
      duration: 0,
      url: URL.createObjectURL(file),
      seen: false,
      lastHit: null,
    };
    state.clips.push(clip);
    probeDuration(clip);
  }
  renderLibrary();
}

function probeDuration(clip) {
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.src = clip.url;
  v.onloadedmetadata = () => {
    clip.duration = v.duration;
    v.src = '';
    renderLibrary();
    if (state.current === clip) updateNowPlaying();
  };
}

function renderLibrary() {
  els.libraryEmpty.hidden = state.clips.length > 0;
  els.clipList.textContent = '';
  for (const clip of state.clips) {
    const li = document.createElement('li');
    li.className = 'clip-row' + (clip === state.current ? ' active' : '');

    const play = document.createElement('button');
    play.className = 'clip-play';
    play.type = 'button';
    play.title = `Play “${clip.name}”`;
    play.textContent = '▶';
    play.addEventListener('click', () => startSession(clip));

    const name = document.createElement('span');
    name.className = 'clip-name';
    name.textContent = clip.name;
    name.title = clip.name;

    const select = document.createElement('select');
    select.className = 'clip-select';
    select.title = 'The feeling this clip is meant to give';
    for (const key of FEELING_KEYS) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${FEELINGS[key].emoji} ${FEELINGS[key].label}`;
      if (clip.intended === key) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      clip.intended = select.value;
      if (clip === state.current) updateNowPlaying();
      if (state.wanted) runRecommend(); // tags changed → re-rank
    });

    const dur = document.createElement('span');
    dur.className = 'clip-dur';
    dur.textContent = clip.duration ? fmt(clip.duration) : '…';

    const badges = document.createElement('span');
    badges.className = 'clip-badges';
    if (clip.seen) {
      const b = document.createElement('span');
      b.className = 'chip ' + (clip.lastHit === true ? 'badge-hit' : clip.lastHit === false ? 'badge-miss' : 'badge-seen');
      b.textContent = clip.lastHit === true ? 'hit' : clip.lastHit === false ? 'miss' : 'seen';
      badges.appendChild(b);
    }

    li.append(play, name, select, dur, badges);
    els.clipList.appendChild(li);
  }
}

// ---------------------------------------------------------------- session / player

// Media time + playing state regardless of source (file <video> or YouTube iframe).
function currentMediaTime() {
  if (state.current?.source === 'youtube') {
    try { return +(ytPlayer?.getCurrentTime() ?? 0).toFixed(2); } catch { return 0; }
  }
  return +video.currentTime.toFixed(2);
}

function recordEvent(type, extra) {
  if (!state.session) return;
  state.session.events.push({ t: currentMediaTime(), type, ...(extra || {}) });
}

function isMediaPlaying() {
  if (!state.session) return false;
  if (state.current?.source === 'youtube') return ytState === YT_STATE.PLAYING;
  return !video.paused && !video.ended;
}

function pauseActivePlayer() {
  if (state.current?.source === 'youtube') { try { ytPlayer?.pauseVideo(); } catch { /* ignore */ } }
  else video.pause();
}

function startSession(clip) {
  if (state.session) finalizeSession('skip', { silent: !state.session.played });
  pauseActivePlayer(); // stop whatever was loaded before
  state.current = clip;
  state.session = { frames: [], events: [], baseline: null, baselineTriedAt: 0, played: false };
  ytLastTime = null;
  ytLastWall = null;
  ytLastSeekAt = 0;
  if (ytTicker) { clearInterval(ytTicker); ytTicker = null; }
  if (clip.source === 'youtube') {
    els.playerStage.classList.add('yt-mode'); // CSS swaps the <video> for the iframe
    ensureYtPlayer()
      .then(() => { if (state.current === clip && state.session) ytPlayer.loadVideoById(clip.youtubeId); })
      .catch((err) => { console.error(err); toast('YouTube player failed to load — are you online?', true); });
    ytTicker = setInterval(ytTick, SAMPLE_MS);
  } else {
    els.playerStage.classList.remove('yt-mode');
    video.src = clip.url;
    video.load();
  }
  updateNowPlaying();
  renderLibrary();
  setBaselineNote();
  els.btnSkip.disabled = false;
  // No synthetic play event here: the real 'play' / PLAYING events record
  // themselves once playback actually starts (keeps the event log honest).
}

function updateNowPlaying() {
  const clip = state.current;
  if (!clip) {
    els.nowTitle.textContent = 'No clip loaded';
    els.nowTag.hidden = true;
    return;
  }
  els.nowTitle.textContent = clip.name;
  els.nowTag.hidden = false;
  const f = FEELINGS[clip.intended];
  els.nowTag.textContent = `intended: ${f.emoji} ${f.label}`;
  els.nowTag.style.color = f.color;
}

// video element events → contract events
video.addEventListener('play', () => {
  els.stageEmpty.classList.add('hidden');
  if (state.session) state.session.played = true;
  recordEvent('play');
});
video.addEventListener('pause', () => { if (!video.ended) recordEvent('pause'); });
video.addEventListener('seeking', () => { if (state.session && state.session.played) recordEvent('seek'); });
video.addEventListener('timeupdate', () => {
  els.clock.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration || 0)}`;
});
video.addEventListener('ended', () => finalizeSession('end'));
video.addEventListener('error', () => {
  if (video.src) toast('This file could not be played by the browser.', true);
});

els.btnSkip.addEventListener('click', () => {
  if (!state.session) return;
  pauseActivePlayer();
  finalizeSession('skip');
});

// Finalize: build the Feeling Receipt, update the profile, refresh recommendations.
// reason: 'end' | 'skip'. options.silent → discard if nothing was ever played (clip switch).
function finalizeSession(reason, options = {}) {
  const session = state.session;
  const clip = state.current;
  if (!session || !clip) return;
  state.session = null;
  if (ytTicker) { clearInterval(ytTicker); ytTicker = null; }
  els.btnSkip.disabled = true;

  if (options.silent && !session.played && session.frames.length === 0) return; // switched away untouched

  session.events.push({ t: currentMediaTime(), type: reason });

  let receipt = null;
  try {
    receipt = summarize(session.frames, session.events, cleanClip(clip));
  } catch (err) {
    console.error('summarize failed:', err);
    toast(`summarize() failed: ${err.message}`, true);
  }
  if (!receipt) return;

  if (receipt.clipId == null) receipt.clipId = clip.id;
  if (receipt.intended == null) receipt.intended = clip.intended;

  clip.seen = true;
  clip.lastHit = receipt.stateHit === true ? true : receipt.stateHit === false ? false : null;

  state.sessions.push({ clip: cleanClip(clip), frames: session.frames, events: session.events, receipt });
  renderReceipt(receipt, clip);

  try {
    state.profile = updateProfile(state.profile ?? {}, receipt);
  } catch (err) {
    try { state.profile = updateProfile({}, receipt); }
    catch (err2) { console.error('updateProfile failed:', err2); toast(`updateProfile() failed: ${err2.message}`, true); }
  }
  saveProfile();

  if (state.wanted) runRecommend();
}

// ---------------------------------------------------------------- YouTube (IFrame Player API)

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!loadYouTubeApi.promise) {
    loadYouTubeApi.promise = new Promise((resolve, reject) => {
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (why) => { if (!settled) { settled = true; loadYouTubeApi.promise = null; reject(new Error(why)); } };
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch { /* ignore */ } ok(); };
      const s = document.createElement('script');
      s.src = YT_API_URL;
      s.onerror = () => fail('YouTube IFrame API script failed to load (offline or blocked?)');
      setTimeout(() => { if (!window.YT?.Player) fail('YouTube IFrame API timed out'); }, 10000);
      document.head.appendChild(s);
    });
  }
  return loadYouTubeApi.promise;
}

function ensureYtPlayer() {
  if (ytPlayerReady) return Promise.resolve(ytPlayer);
  return loadYouTubeApi().then(() => new Promise((resolve, reject) => {
    if (ytPlayer) return resolve(ytPlayer);
    try {
      ytPlayer = new YT.Player('yt-player', {
        width: '100%',
        height: '100%',
        playerVars: { controls: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => { ytPlayerReady = true; resolve(ytPlayer); },
          onStateChange: onYtStateChange,
          onError: (e) => toast(`YouTube refused to embed this video (error ${e.data}).`, true),
        },
      });
    } catch (err) { reject(err); }
  }));
}

function onYtStateChange(e) {
  ytState = e.data;
  if (!state.session || state.current?.source !== 'youtube') return;
  if (ytState === YT_STATE.PLAYING) {
    els.stageEmpty.classList.add('hidden');
    state.session.played = true;
    recordEvent('play');
  } else if (ytState === YT_STATE.PAUSED) {
    recordEvent('pause');
  } else if (ytState === YT_STATE.ENDED) {
    finalizeSession('end');
  }
}

// ~10fps poll while a YouTube clip is loaded: seek detection, clock, duration + title.
// (The IFrame API has no events for those, so we watch getCurrentTime().)
function ytTick() {
  if (!state.session || state.current?.source !== 'youtube' || !ytPlayerReady) return;
  const clip = state.current;
  let t;
  try { t = ytPlayer.getCurrentTime() || 0; } catch { return; }

  // A real seek jumps further than playback could have moved since the last
  // poll (wall-clock delta × rate + tolerance), so buffering stalls and
  // background-tab timer throttling don't get logged as seeks.
  const nowMs = performance.now();
  if (ytLastTime != null && ytLastWall != null && state.session.played) {
    const expected = (nowMs - ytLastWall) / 1000;
    if (Math.abs(t - ytLastTime) > expected * 1.5 + 1.2) {
      if (nowMs - ytLastSeekAt > 600) recordEvent('seek', { back: t < ytLastTime }); // debounce flapping
      ytLastSeekAt = nowMs;
    }
  }
  ytLastTime = t;
  ytLastWall = nowMs;

  try {
    if (!clip.duration) {
      const d = ytPlayer.getDuration();
      if (d > 0) { clip.duration = d; renderLibrary(); }
    }
    if (clip.name.startsWith('YouTube · ')) {
      const data = ytPlayer.getVideoData?.();
      if (data?.title) {
        clip.name = data.title;
        renderLibrary();
        if (state.current === clip) updateNowPlaying();
      }
    }
  } catch { /* player not ready for these yet */ }

  els.clock.textContent = `${fmt(t)} / ${fmt(clip.duration || 0)}`;
}

function parseYouTubeId(raw) {
  const s = String(raw ?? '').trim();
  if (/^[\w-]{11}$/.test(s)) return s; // bare video id
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function addYouTubeClip() {
  const id = parseYouTubeId(els.ytUrl.value);
  if (!id) { toast('That does not look like a YouTube link or video ID.', true); return; }
  if (state.clips.some((c) => c.youtubeId === id)) { toast('That video is already in the library.'); return; }
  state.clips.push({
    id: `y${++clipSeq}-${Date.now().toString(36)}`,
    name: `YouTube · ${id}`, // replaced by the real title once the player reports it
    intended: els.ytIntended.value,
    duration: 0, // filled in by ytTick once the player reports it
    url: `https://www.youtube.com/watch?v=${id}`,
    source: 'youtube',
    youtubeId: id,
    seen: false,
    lastHit: null,
  });
  els.ytUrl.value = '';
  els.ytForm.hidden = true;
  renderLibrary();
  toast('YouTube clip added to the library.');
}

els.btnYouTube.addEventListener('click', () => {
  els.ytForm.hidden = !els.ytForm.hidden;
  if (!els.ytForm.hidden) els.ytUrl.focus();
});
els.ytCancel.addEventListener('click', () => { els.ytForm.hidden = true; });
els.ytForm.addEventListener('submit', (e) => { e.preventDefault(); addYouTubeClip(); });

for (const key of FEELING_KEYS) { // feeling options for the Add-YouTube form
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = `${FEELINGS[key].emoji} ${FEELINGS[key].label}`;
  els.ytIntended.appendChild(opt);
}

// ---------------------------------------------------------------- Feeling Receipt UI

function bar(width, color) {
  return `<div class="meter-track"><div class="meter-fill" style="width:${Math.round(
    Math.min(1, Math.max(0, width)) * 100
  )}%;background:${color}"></div></div>`;
}

function renderReceipt(r, clip) {
  els.receiptEmpty.hidden = true;
  els.receipt.hidden = false;

  const felt = FEELINGS[r.felt] ?? { label: r.felt ?? '—', emoji: '', color: 'var(--text)' };
  const scores = r.scores ?? {};
  const peaks = Array.isArray(r.peaks) ? r.peaks : [];
  const intended = FEELINGS[r.intended] ?? { label: r.intended ?? '—', emoji: '' };

  const scoreRows = FEELING_KEYS.map((key) => `
    <div class="score-row">
      <span style="color:${FEELINGS[key].color}">${FEELINGS[key].label}</span>
      ${bar(scores[key] ?? 0, FEELINGS[key].color)}
      <span class="meter-val">${(scores[key] ?? 0).toFixed(2)}</span>
    </div>`).join('');

  const peakItems = peaks.length
    ? peaks.map((p) => `
        <li>
          <span class="peak-t">${fmt(p.t)}</span>
          <span class="peak-feeling" style="color:${(FEELINGS[p.feeling] ?? {}).color ?? 'var(--text)'}">${esc(p.feeling)}</span>
          <span class="peak-val">${(p.value ?? 0).toFixed(2)}</span>
        </li>`).join('')
    : '<li><span class="peak-val">no clear peaks</span></li>';

  els.receipt.innerHTML = `
    <div class="receipt-top">
      <div>
        <div class="felt-line">intended <b>${intended.emoji} ${esc(intended.label)}</b> → felt</div>
        <div class="felt-word" style="color:${felt.color}">${felt.emoji} ${esc(felt.label)}</div>
        <div class="felt-line">on <b>${esc(clip?.name ?? r.clipId ?? '')}</b></div>
      </div>
      <div class="badges">
        <span class="chip ${r.stateHit ? 'badge-hit' : 'badge-miss'}">${r.stateHit ? 'state hit ✓' : 'miss'}</span>
        ${r.skipped ? '<span class="chip">skipped</span>' : ''}
      </div>
    </div>
    <div class="score-rows">${scoreRows}</div>
    <div class="engagement">
      <span class="meter-label">Engagement</span>
      ${bar(r.engagement ?? 0, 'var(--accent)')}
      <span class="meter-val">${(r.engagement ?? 0).toFixed(2)}</span>
    </div>
    <ul class="peaks">${peakItems}</ul>
    <p class="receipt-foot">Receipt #${state.sessions.length} · your taste profile was updated.</p>
  `;
}

// ---------------------------------------------------------------- camera / MediaPipe

async function getLandmarker() {
  if (state.landmarker) return state.landmarker;
  if (!state.landmarkerPromise) {
    state.landmarkerPromise = (async () => {
      const vision = await import(TASKS_VISION_URL);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
      const make = (delegate) => vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      try { state.landmarker = await make('GPU'); }
      catch (err) { console.warn('GPU delegate failed, falling back to CPU:', err); state.landmarker = await make('CPU'); }
      return state.landmarker;
    })().catch((err) => { state.landmarkerPromise = null; throw err; });
  }
  return state.landmarkerPromise;
}

async function enableCamera() {
  if (state.cameraOn) return;
  els.btnCamera.disabled = true;
  els.btnCamera.textContent = 'Starting…';
  els.camState.textContent = 'starting…';
  els.camState.className = 'chip chip-warn';
  try {
    const landmarker = await getLandmarker();
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    camPreview.srcObject = state.stream;
    await camPreview.play().catch(() => {});
    state.cameraOn = true;
    els.camRow.hidden = false;
    els.camState.textContent = 'camera on';
    els.camState.className = 'chip chip-on';
    els.btnCamera.textContent = 'Turn camera off';
    setBaselineNote();
    state.sampleTimer = setInterval(sampleTick, SAMPLE_MS);
  } catch (err) {
    console.error(err);
    // The stream may already be acquired even though startup failed: stop
    // every track, or the camera stays live while the UI says "camera off".
    if (state.sampleTimer) { clearInterval(state.sampleTimer); state.sampleTimer = null; }
    if (state.stream) { for (const track of state.stream.getTracks()) track.stop(); state.stream = null; }
    camPreview.srcObject = null;
    els.camState.textContent = 'camera off';
    els.camState.className = 'chip chip-off';
    els.btnCamera.textContent = 'Turn camera on';
    const why = err?.name === 'NotAllowedError'
      ? 'permission denied'
      : err?.name === 'NotFoundError' ? 'no camera found' : err.message;
    toast(`Camera could not start: ${why}`, true);
  }
  els.btnCamera.disabled = false;
}

function disableCamera() {
  state.cameraOn = false;
  if (state.sampleTimer) { clearInterval(state.sampleTimer); state.sampleTimer = null; }
  if (state.stream) { for (const track of state.stream.getTracks()) track.stop(); state.stream = null; }
  camPreview.srcObject = null;
  els.camRow.hidden = true;
  els.camState.textContent = 'camera off';
  els.camState.className = 'chip chip-off';
  els.btnCamera.textContent = 'Turn camera on';
  els.faceChip.textContent = 'no face';
  els.faceChip.classList.remove('face-found');
  state.lastFeatures = null;
  renderMeters(null);
  setBaselineNote();
}

els.btnCamera.addEventListener('click', () => (state.cameraOn ? disableCamera() : enableCamera()));

// ---------------------------------------------------------------- the ~10fps loop

function sampleTick() {
  if (!state.cameraOn || !state.landmarker) return;
  if (!isMediaPlaying()) return; // readings only while actually watching
  sampleFrame();
}

// One face reading → one contract frame. Also called by tests with synthetic frames.
function ingestFrame(frame) {
  const session = state.session;
  if (!session) return;
  session.frames.push(frame);

  // baseline from the first 3 s of the session (camera-on mid-clip retries
  // once per second until a real baseline exists)
  if (!session.baseline) {
    const sinceStart = frame.t - session.frames[0].t;
    const now = performance.now();
    if (sinceStart >= CALIB_SECONDS && now - session.baselineTriedAt > 1000) {
      session.baselineTriedAt = now;
      try { session.baseline = calibrate(session.frames.slice()) ?? null; }
      catch (err) { console.error('calibrate failed:', err); session.baseline = null; }
      if (session.baseline && session.baseline.frames > 0) {
        toast(session.baseline.late
          ? 'Baseline estimated from a late camera start — treat the receipt as approximate.'
          : 'Baseline set — your neutral face is known.');
      }
      setBaselineNote();
    }
  }

  let f = null;
  try { f = features(frame, session.baseline) ?? null; }
  catch (err) { console.error('features failed:', err); }
  state.lastFeatures = f;
  renderMeters(f);
}

function sampleFrame() {
  let result;
  const ts = Math.max(performance.now(), state.lastDetectTs + 1); // must strictly increase
  state.lastDetectTs = ts;
  try {
    result = state.landmarker.detectForVideo(camPreview, ts);
  } catch (err) {
    console.error('detect failed:', err);
    return;
  }

  const t = currentMediaTime(); // file <video> or YouTube, whichever is loaded
  const landmarks = result?.faceLandmarks?.[0];

  if (landmarks) {
    // scale: face box width / video width
    let minX = 1, maxX = 0;
    for (const p of landmarks) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }

    // bs: all 52 blendshape category scores
    const bs = {};
    const cats = result?.faceBlendshapes?.[0]?.categories;
    if (cats) for (const c of cats) bs[c.categoryName] = c.score;

    // yaw / pitch in degrees from the 4×4 transform matrix (column-major)
    let yaw = 0, pitch = 0;
    const d = result?.facialTransformationMatrixes?.[0]?.data;
    if (d) {
      yaw = Math.atan2(d[8], d[10]) * RAD;
      pitch = Math.asin(Math.min(1, Math.max(-1, -d[9]))) * RAD;
    }

    els.faceChip.textContent = 'face';
    els.faceChip.classList.add('face-found');
    ingestFrame({ t, face: true, bs, yaw: +yaw.toFixed(1), pitch: +pitch.toFixed(1), scale: +(maxX - minX).toFixed(3) });
  } else {
    els.faceChip.textContent = 'no face';
    els.faceChip.classList.remove('face-found');
    ingestFrame({ t, face: false, bs: {}, yaw: 0, pitch: 0, scale: 0 });
  }
}

// ---------------------------------------------------------------- meters

function buildMeters() {
  els.meters.textContent = '';
  for (const key of METER_KEYS) {
    const row = document.createElement('div');
    row.className = 'meter';
    const label = document.createElement('span');
    label.className = 'meter-label';
    label.textContent = key === 'leanIn' ? 'Lean-in' : key[0].toUpperCase() + key.slice(1);
    const track = document.createElement('div');
    track.className = 'meter-track';
    const fill = document.createElement('div');
    fill.className = 'meter-fill';
    fill.id = `meter-${key}`;
    fill.style.background = METER_COLORS[key];
    track.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'meter-val';
    val.id = `meter-val-${key}`;
    val.textContent = '–';
    row.append(label, track, val);
    els.meters.appendChild(row);
  }
}

function renderMeters(f) {
  for (const key of METER_KEYS) {
    const fill = $(`meter-${key}`);
    const val = $(`meter-val-${key}`);
    const v = f ? Math.min(1, Math.max(0, f[key] ?? 0)) : 0;
    fill.style.width = `${Math.round(v * 100)}%`;
    val.textContent = f ? v.toFixed(2) : '–';
  }
}

function setBaselineNote() {
  const s = state.session;
  if (!state.cameraOn) { els.baselineNote.textContent = 'Camera off — no signals.'; return; }
  if (!s || s.frames.length === 0) { els.baselineNote.textContent = 'Waiting for playback…'; return; }
  els.baselineNote.textContent = s.baseline
    ? 'Baseline set — values are relative to your neutral face.'
    : `Calibrating (first ${CALIB_SECONDS} s — hold a neutral face)…`;
}

// ---------------------------------------------------------------- want / recommend

function buildWantButtons() {
  els.wantButtons.textContent = '';
  for (const key of FEELING_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'want-btn';
    btn.dataset.feeling = key;
    btn.textContent = `${FEELINGS[key].emoji} ${FEELINGS[key].label}`;
    btn.addEventListener('click', () => setWanted(key));
    els.wantButtons.appendChild(btn);
  }
}

function setWanted(feeling) {
  state.wanted = state.wanted === feeling ? null : feeling;
  for (const btn of els.wantButtons.children) {
    btn.classList.toggle('active', btn.dataset.feeling === state.wanted);
    const f = FEELINGS[btn.dataset.feeling];
    btn.style.borderColor = btn.dataset.feeling === state.wanted ? f.color : '';
    btn.style.color = btn.dataset.feeling === state.wanted ? f.color : '';
  }
  if (state.wanted) runRecommend();
  else {
    els.recs.hidden = true;
    els.recs.textContent = '';
    els.recsEmpty.hidden = false;
  }
}

function runRecommend() {
  if (!state.wanted) return;
  els.recsEmpty.hidden = true;
  let recs = null;
  try {
    recs = recommend(state.profile ?? {}, state.clips.map(cleanClip), state.wanted) ?? [];
  } catch (err) {
    console.error('recommend failed:', err);
    toast(`recommend() failed: ${err.message}`, true);
    return;
  }
  els.recs.hidden = false;
  els.recs.textContent = '';
  if (!recs.length) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.textContent = state.clips.length
      ? 'You have seen every clip for this feeling. Load more, or pick another feeling.'
      : 'Load some clips first.';
    els.recs.appendChild(li);
    return;
  }
  recs.forEach((r, i) => {
    const clip = r.clip ?? {};
    const f = FEELINGS[clip.intended] ?? {};
    const li = document.createElement('li');
    li.className = 'rec';
    li.title = 'Click to play';
    li.innerHTML = `
      <span class="rec-rank">#${i + 1}</span>
      <div>
        <div class="rec-name"><span>${esc(clip.name ?? clip.id ?? '?')}</span>
          <span class="tag" style="color:${f.color ?? ''}">${f.emoji ?? ''} ${esc(clip.intended ?? '')}</span></div>
        <div class="rec-reason">${esc(r.reason ?? '')}</div>
        ${bar(r.score ?? 0, f.color ?? 'var(--accent)')}
      </div>
      <span class="rec-score">${(r.score ?? 0).toFixed(2)}</span>`;
    li.addEventListener('click', () => {
      const actual = state.clips.find((c) => c.id === clip.id);
      if (actual) startSession(actual);
    });
    els.recs.appendChild(li);
  });
}

// ---------------------------------------------------------------- export

els.btnExport.addEventListener('click', () => {
  const data = {
    app: 'reaction-lab',
    version: 0,
    exportedAt: new Date().toISOString(),
    profile: state.profile,
    wanted: state.wanted,
    library: state.clips.map(cleanClip),
    sessions: state.sessions,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reaction-lab-session.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Session exported as JSON.');
});

els.fileInput.addEventListener('change', () => { addFiles(els.fileInput.files); els.fileInput.value = ''; });

// ---------------------------------------------------------------- init + test hook

buildMeters();
buildWantButtons();
updateNowPlaying();
renderMeters(null);
setBaselineNote();

// Debug/testing hook (harmless in production; used by smoke tests).
window.__rl = { state, startSession, finalizeSession, ingestFrame, setWanted, runRecommend };
