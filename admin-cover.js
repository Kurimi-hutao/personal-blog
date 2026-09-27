/* Covers use a marked first attachment, keeping existing public pages and schemas compatible. */
(() => {
  const form = document.querySelector('#articleForm');
  const urlInput = form.elements.videoPoster;
  const fileInput = form.elements.coverFile;
  const preview = document.querySelector('#coverPreview');
  const placeholder = document.querySelector('#coverPlaceholder');
  const status = document.querySelector('#coverStatus');
  const video = document.querySelector('#coverVideo');
  const seek = document.querySelector('#frameSeek');
  const capture = document.querySelector('#captureCover');
  let localFile = null;
  let localData = '';
  let savedCover = null;
  let sourceObjectUrl = '';
  let revision = 0;
  let processing = false;
  let savedAttachments = [];
  let attachmentPreviewUrl = '';

  function say(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
  function draftChanged() { form.dispatchEvent(new Event('input', { bubbles: true })); }
  function show(url) {
    preview.hidden = !url;
    placeholder.hidden = Boolean(url);
    if (url) preview.src = url;
    else preview.removeAttribute('src');
  }
  function fallback() {
    const removed = new Set([...form.querySelectorAll('[name="removeAttachment"]:checked')].map(input => Number(input.value)));
    return savedAttachments.find((file, index) => file.role !== 'cover' && !removed.has(index) && file.type?.startsWith('image/'))?.url || attachmentPreviewUrl;
  }
  function refresh() { show(localData || urlInput.value.trim() || fallback()); }
  preview.addEventListener('load', () => {
    preview.parentElement.classList.remove('is-changing');
    void preview.offsetWidth;
    preview.parentElement.classList.add('is-changing');
  });
  preview.addEventListener('error', () => { preview.hidden = true; placeholder.hidden = false; say('图片无法预览，请检查地址或重新上传图片。', true); });
  function canvasImage(source, width, height) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4f0e7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .85);
  }
  function fileFromData(data) {
    const binary = atob(data.split(',')[1]);
    return new File([Uint8Array.from(binary, char => char.charCodeAt(0))], 'cover.jpg', { type: 'image/jpeg' });
  }
  function useData(data, message) {
    localFile = fileFromData(data);
    localData = data;
    savedCover = null;
    urlInput.value = '';
    show(data);
    say(message);
    draftChanged();
  }
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const token = ++revision;
    processing = false;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      fileInput.value = '';
      say('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。', true);
      return;
    }
    processing = true;
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      if (token !== revision) return;
      useData(canvasImage(image, image.naturalWidth, image.naturalHeight), '自定义封面已选好，将随作品一同保存。');
    } catch (_) { if (token === revision) say('无法读取这张图片，请换一张图片。', true); }
    finally { URL.revokeObjectURL(objectUrl); if (token === revision) processing = false; }
  });
  urlInput.addEventListener('input', () => {
    revision++;
    processing = false;
    localFile = null;
    localData = '';
    savedCover = null;
    fileInput.value = '';
    refresh();
    say(urlInput.value ? '将使用此图片地址作为封面。' : '已恢复默认封面。');
  });
  document.querySelector('#clearCover').addEventListener('click', () => {
    urlInput.value = '';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  form.addEventListener('change', event => { if (event.target.name === 'removeAttachment') refresh(); });
  function clearAttachmentPreview() {
    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
    attachmentPreviewUrl = '';
  }
  form.elements.attachments.addEventListener('change', () => {
    clearAttachmentPreview();
    const image = [...form.elements.attachments.files].find(file => file.type.startsWith('image/'));
    if (image) attachmentPreviewUrl = URL.createObjectURL(image);
    refresh();
  });

  function unloadVideo() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.hidden = true;
    seek.disabled = true;
    seek.value = 0;
    seek.max = 0;
    capture.disabled = true;
    document.querySelector('#frameTime').textContent = '00:00';
    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
    sourceObjectUrl = '';
  }
  document.querySelector('#loadCoverVideo').addEventListener('click', () => {
    unloadVideo();
    const file = form.elements.videoFile.files[0];
    const url = form.elements.videoUrl.value.trim();
    if (!file && !/^https?:\/\//i.test(url)) { say('请先选择视频文件或填写有效的视频直链。', true); return; }
    if (file && !['video/mp4', 'video/webm', 'video/ogg'].includes(file.type)) { say('请选择 MP4、WebM 或 OGG 视频。', true); return; }
    video.crossOrigin = 'anonymous';
    if (file) sourceObjectUrl = URL.createObjectURL(file);
    video.src = sourceObjectUrl || url;
    video.hidden = false;
    say('正在载入视频画面……');
  });
  function updateDuration() {
    if (!Number.isFinite(video.duration) || video.duration <= 0) { say('此视频没有可选取的时间轴，请上传封面图片。', true); return; }
    seek.max = Math.max(0, video.duration - .05);
    seek.disabled = false;
    say('拖动进度条或播放视频，选好画面后点击“用这一帧作封面”。');
  }
  video.addEventListener('loadedmetadata', updateDuration);
  video.addEventListener('durationchange', updateDuration);
  function updateFrame() {
    capture.disabled = video.readyState < 2 || video.seeking || seek.disabled;
    seek.value = video.currentTime;
    const seconds = Math.floor(video.currentTime || 0);
    document.querySelector('#frameTime').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  ['loadeddata', 'seeked', 'timeupdate', 'seeking'].forEach(event => video.addEventListener(event, updateFrame));
  video.addEventListener('error', () => {
    if (!video.getAttribute('src')) return;
    capture.disabled = true;
    seek.disabled = true;
    say('无法读取视频画面。直链可能不允许跨域取帧，请选择本地视频文件，或上传封面图片。', true);
  });
  seek.addEventListener('input', () => { video.pause(); capture.disabled = true; video.currentTime = Number(seek.value); });
  capture.addEventListener('click', () => {
    video.pause();
    if (video.readyState < 2 || video.seeking || !video.videoWidth) return;
    revision++;
    processing = false;
    try {
      useData(canvasImage(video, video.videoWidth, video.videoHeight), `已选取 ${document.querySelector('#frameTime').textContent} 的画面作为封面。`);
      fileInput.value = '';
    } catch (_) { say('该视频不允许截取画面，请选择本地视频，或上传封面图片。', true); }
  });
  form.elements.videoFile.addEventListener('change', unloadVideo);
  form.elements.videoUrl.addEventListener('input', unloadVideo);
  window.addEventListener('pagehide', unloadVideo);

  window.adminCover = {
    reset(article = null) {
      revision++;
      processing = false;
      localFile = null;
      localData = '';
      fileInput.value = '';
      clearAttachmentPreview();
      savedAttachments = article?.attachments || [];
      savedCover = savedAttachments.find(file => file.role === 'cover') || null;
      urlInput.value = article?.video_poster || savedCover?.url || '';
      unloadVideo();
      refresh();
      say('上传图片或从视频取帧后，可在此预览。');
    },
    mode(isVideo) {
      document.querySelector('#framePicker').hidden = !isVideo;
      if (!isVideo) video.pause();
    },
    selection() {
      if (processing) throw new Error('封面正在处理，请稍后再保存。');
      const url = urlInput.value.trim();
      if (url && !/^https?:\/\//i.test(url)) throw new Error('封面地址须以 http:// 或 https:// 开头。');
      const existing = savedAttachments.find(file => file.role === 'cover' && file.url === url);
      return { file: localFile, attachment: !localFile && url ? (existing || { name: '自定义封面', url, type: 'image/jpeg', role: 'cover' }) : null };
    },
    draft() { return localData; },
    restore(data) {
      revision++;
      processing = false;
      localFile = null;
      localData = '';
      fileInput.value = '';
      unloadVideo();
      if (typeof data === 'string' && data.startsWith('data:image/jpeg;base64,')) useData(data, '已恢复草稿中的封面。');
      else refresh();
    }
  };
})();
