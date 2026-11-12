(() => {
  // Shrinks a video on the device before it is uploaded, without asking the person anything.
  // A clip over the upload limit (or a large 4K/1080p+ clip) is played off-screen into a canvas and
  // re-recorded at a lower resolution with a bitrate sized to fit the limit. The only thing shown is the
  // regular upload progress. If the browser cannot re-record video, the original file is used unchanged.
  const BIG_FILE = 25 * 1024 * 1024; // a clip at least this big with a long edge over 1920px is shrunk even under the limit
  const MAX_SECONDS = 20 * 60; // re-recording runs in real time, so very long clips are left as they are
  const jobs = new WeakMap(); // File -> job, so selection can start the work and Publish/retry reuse it
  let queue = Promise.resolve(); // one clip at a time keeps phones responsive
  let audio = null;
  const waiting = new Set(); // playbacks the browser blocked until the next tap

  const recorderType = () => {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream || !(window.AudioContext || window.webkitAudioContext)) return '';
    return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type)) || '';
  };
  function audioContext() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      audio.addEventListener('statechange', () => { if (audio.state === 'running') [...waiting].forEach(retry => retry()); });
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(type => document.addEventListener(type, () => {
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
    [...waiting].forEach(retry => retry());
  }, { capture: true, passive: true }));

  const aborted = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });
  function once(target, event, signal, timeout = 0) {
    return new Promise((resolve, reject) => {
      const done = (fn, value) => { clearTimeout(timer); target.removeEventListener(event, ok); target.removeEventListener('error', fail); signal?.removeEventListener('abort', stop); fn(value); };
      const ok = value => done(resolve, value), fail = () => done(reject, new Error('video unreadable')), stop = () => done(reject, aborted());
      const timer = timeout ? setTimeout(() => done(reject, new Error('video timeout')), timeout) : 0;
      target.addEventListener(event, ok); target.addEventListener('error', fail); signal?.addEventListener('abort', stop);
    });
  }
  // Kept in the page (tiny and invisible) because some browsers stop painting frames of detached videos.
  function element(url) {
    const video = Object.assign(document.createElement('video'), { playsInline: true, preload: 'auto', src: url });
    video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
    document.body.append(video);
    return video;
  }
  async function probe(url, signal) {
    const video = element(url);
    video.muted = true; video.preload = 'metadata';
    try { await once(video, 'loadedmetadata', signal, 15000); return { width: video.videoWidth, height: video.videoHeight, duration: video.duration }; }
    finally { video.removeAttribute('src'); video.load(); video.remove(); }
  }
  // Plays the clip, waiting for the next tap if the browser blocks sound, so the recording never starts silent.
  function play(video, signal) {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        waiting.delete(attempt);
        if (signal.aborted) return;
        if (audioContext().state !== 'running') { waiting.add(attempt); return; }
        video.play().then(resolve, error => { if (signal.aborted) reject(aborted()); else if (error?.name === 'NotAllowedError') waiting.add(attempt); else reject(error); });
      };
      signal.addEventListener('abort', () => { waiting.delete(attempt); reject(aborted()); }, { once: true });
      // Without a tap for a minute, give up; the original is used and a later Publish tap tries again.
      setTimeout(() => { if (waiting.delete(attempt)) reject(new Error('playback blocked')); }, 60000);
      attempt();
    });
  }
  const even = value => Math.max(2, Math.round(value / 2) * 2);

  async function encode(url, info, { edge, videoBps, audioBps }, type, signal, onProgress) {
    const scale = Math.min(1, edge / Math.max(info.width, info.height, 1));
    const canvas = Object.assign(document.createElement('canvas'), { width: even(info.width * scale), height: even(info.height * scale) });
    const paint = canvas.getContext('2d', { alpha: false });
    const video = element(url);
    const cleanup = [];
    try {
      await once(video, 'loadeddata', signal, 15000);
      const stream = canvas.captureStream(30);
      // The sound goes only into the recording, never to the speakers.
      const context = audioContext(), source = context.createMediaElementSource(video), output = context.createMediaStreamDestination();
      source.connect(output);
      cleanup.push(() => source.disconnect());
      output.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      cleanup.push(() => stream.getTracks().forEach(track => track.stop()));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: videoBps, audioBitsPerSecond: audioBps });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      let finished = false, lastTime = -1, lastMove = Date.now();
      const draw = () => {
        if (finished) return;
        paint.drawImage(video, 0, 0, canvas.width, canvas.height);
        onProgress(Math.min(1, video.currentTime / info.duration));
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw); else requestAnimationFrame(draw);
      };
      paint.drawImage(video, 0, 0, canvas.width, canvas.height);
      await play(video, signal);
      recorder.start(1000);
      draw();
      // Frames are not painted while the app is in the background, so recording pauses with it.
      const visibility = () => {
        if (document.hidden) { video.pause(); if (recorder.state === 'recording') recorder.pause(); }
        else if (!finished) play(video, signal).then(() => { if (recorder.state === 'paused') recorder.resume(); draw(); }, () => {});
      };
      document.addEventListener('visibilitychange', visibility);
      cleanup.push(() => document.removeEventListener('visibilitychange', visibility));
      await new Promise((resolve, reject) => {
        const watchdog = setInterval(() => {
          if (document.hidden) { lastMove = Date.now(); return; }
          if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastMove = Date.now(); }
          else if (Date.now() - lastMove > 20000) { clearInterval(watchdog); reject(new Error('video stalled')); }
        }, 1000);
        cleanup.push(() => clearInterval(watchdog));
        once(video, 'ended', signal).then(resolve, reject);
      }).finally(() => { finished = true; video.pause(); if (recorder.state !== 'inactive') recorder.stop(); });
      await stopped;
      if (signal.aborted) throw aborted();
      return new Blob(chunks, { type: type.split(';')[0] });
    } finally {
      cleanup.reverse().forEach(fn => { try { fn(); } catch {} });
      video.removeAttribute('src'); video.load(); video.remove();
    }
  }

  // Bitrate and size targets for each attempt; the second attempt is smaller in case the encoder overshoots.
  function plans(info, maxBytes) {
    return [0.8, 0.5].map((share, index) => {
      const total = maxBytes * 8 * share / info.duration;
      const audioBps = total < 600000 ? 64000 : 96000;
      const videoBps = Math.min(2500000, Math.max(0, total - audioBps));
      const steps = [1280, 854, 640, 480];
      const step = videoBps >= 1500000 ? 0 : videoBps >= 700000 ? 1 : videoBps >= 350000 ? 2 : 3;
      return { edge: steps[Math.min(steps.length - 1, step + index)], videoBps, audioBps };
    }).filter(plan => plan.videoBps >= 100000);
  }
  const renamed = (name, type) => `${String(name || 'video').replace(/\.[a-z0-9]{1,5}$/i, '') || 'video'}.${type.includes('mp4') ? 'mp4' : 'webm'}`;

  function start(file, maxBytes) {
    const controller = new AbortController();
    const job = { maxBytes, controller, percent: 0, compressing: false, failed: false, settled: false, listeners: new Set() };
    const report = value => { job.percent = value; if (job.compressing) job.listeners.forEach(listener => { try { listener(value); } catch {} }); };
    const run = async () => {
      const type = recorderType();
      if (!type || controller.signal.aborted) return file;
      const url = URL.createObjectURL(file);
      try {
        const info = await probe(url, controller.signal);
        if (!info.width || !info.height || !Number.isFinite(info.duration) || info.duration <= 0 || info.duration > MAX_SECONDS) return file;
        if (file.size <= maxBytes && !(file.size > BIG_FILE && Math.max(info.width, info.height) > 1920)) return file;
        const attempts = plans(info, maxBytes);
        job.compressing = attempts.length > 0;
        for (const [index, plan] of attempts.entries()) {
          const from = index ? 85 : 0, to = index ? 99 : 85;
          const blob = await encode(url, info, plan, type, controller.signal, fraction => report(Math.max(job.percent, Math.floor(from + (to - from) * fraction))));
          if (blob.size && blob.size <= maxBytes && blob.size < file.size) return new File([blob], renamed(file.name, type), { type: blob.type, lastModified: Date.now() });
          report(to);
        }
        // Only a clip still over the limit is worth another try on the next Publish; a big clip under it just uploads as is.
        job.failed = file.size > maxBytes;
        return file;
      } catch { job.failed = file.size > maxBytes; return file; }
      finally { URL.revokeObjectURL(url); report(100); job.compressing = false; job.settled = true; job.listeners.clear(); }
    };
    job.promise = queue = queue.then(run, run);
    return job;
  }

  // Resolves to the file to upload: a smaller copy when one was needed and possible, otherwise the original.
  // onProgress(0–100) is only called while a copy is being made, so callers can fold it into their progress bar.
  function prepare(file, { maxBytes, onProgress } = {}) {
    if (!(file instanceof Blob) || !String(file.type).startsWith('video/') || !maxBytes || file.size <= Math.min(maxBytes, BIG_FILE)) return Promise.resolve(file);
    let job = jobs.get(file);
    if (!job || job.maxBytes !== maxBytes || job.controller.signal.aborted || (job.settled && job.failed)) { job = start(file, maxBytes); jobs.set(file, job); }
    if (onProgress) { job.listeners.add(onProgress); if (job.compressing) onProgress(job.percent); }
    return job.promise.finally(() => job.listeners.delete(onProgress));
  }
  // Stops background work for a clip the person removed before posting.
  function cancel(file) {
    const job = file && jobs.get(file);
    if (!job) return;
    job.controller.abort(); jobs.delete(file);
  }
  window.MilkyWayVideo = { prepare, cancel };
})();
