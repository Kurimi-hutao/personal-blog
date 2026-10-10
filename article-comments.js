(function () {
  'use strict';
  const types = new Set(['image/png','image/jpeg','image/gif','image/webp','text/plain','application/pdf']);
  const textRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const textWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  // File blobs stay in IndexedDB, not localStorage. Transactions also serialize
  // pending saves and deletion after a successful send.
  let dbPromise;
  function draftFiles(id, value, remove = false) {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('hutao-comment-drafts', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise.then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', value !== undefined || remove ? 'readwrite' : 'readonly');
      const store = tx.objectStore('drafts');
      const request = remove ? store.delete(id) : value !== undefined ? store.put(value, id) : store.get(id);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }
  let comments = [], article, form, status, files = [], previewUrls = [], busy = false, draftTimer;
  const uploaded = new Map();
  const expanded = new Set();
  let savedFiles = files;
  let filesTouched = false;
  const byDate = (a,b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id));
  const key = () => `hutao-comment-draft-${article.id}`;
  function feedback(message, error = false) { status.textContent = message; status.classList.toggle('error', error); }
  function saveDraft() {
    if (!article || busy) return;
    const value = { name: form.elements.visitorName.value, body: form.elements.body.value, parent: form.elements.parentId.value, target: form.elements.replyToId.value };
    textWrite(key(), value);
    textWrite('hutao-comment-name', value.name);
    if (files !== savedFiles) {
      const snapshot = files;
      draftFiles(article.id, snapshot).then(() => { savedFiles = snapshot; }).catch(() => { if (files.length) feedback('文字草稿已保存；当前浏览器无法保存图片草稿，请勿关闭页面。'); });
    }
  }
  function scheduleSave() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 250); }
  function setReply(target) {
    form.elements.parentId.value = target ? target.parent_id || target.id : '';
    form.elements.replyToId.value = target?.id || '';
    renderReplyContext(); scheduleSave();
  }
  function renderReplyContext() {
    const context = document.querySelector('#replyContext');
    const id = form.elements.replyToId.value;
    context.hidden = !form.elements.parentId.value;
    if (context.hidden) return;
    const target = comments.find(c => c.id === id);
    context.querySelector('span').textContent = target ? `回复 ${target.visitor_name}：${(target.body || '图片').slice(0,60)}` : '正在回复此楼';
  }
  function updateComposer() {
    form.querySelector('[type=submit]').disabled = busy || (!form.elements.body.value.trim() && !files.length);
    document.querySelector('#commentLength').textContent = `${form.elements.body.value.length}/2000`;
    form.elements.body.style.height = 'auto';
    form.elements.body.style.height = `${Math.min(260, Math.max(100, form.elements.body.scrollHeight))}px`;
  }
  function renderFiles() {
    previewUrls.forEach(url => URL.revokeObjectURL(url)); previewUrls = [];
    const previews = document.querySelector('#commentPreviews'); previews.replaceChildren();
    files.forEach((file, index) => {
      const item = document.createElement('div'); item.className = 'comment-file-preview';
      if (file.type.startsWith('image/')) {
        const image = document.createElement('img'); image.src = URL.createObjectURL(file); image.alt = file.name;
        previewUrls.push(image.src); item.append(image);
      }
      const name = document.createElement('span'); name.textContent = file.name; item.append(name);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.disabled = busy;
      remove.setAttribute('aria-label', `移除 ${file.name}`);
      remove.onclick = () => { filesTouched = true; files = files.filter((_,i) => i !== index); renderFiles(); scheduleSave(); };
      item.append(remove); previews.append(item);
    });
    previews.hidden = !files.length; updateComposer();
  }
  function addFiles(incoming) {
    if (busy) return;
    const added = [...incoming];
    if (added.some(file => !types.has(file.type) || file.size > 5 * 1024 * 1024 || !file.size)) {
      feedback('请选择图片、TXT 或 PDF，单个文件须为 1 字节至 5 MB。', true); return;
    }
    const next = [...files];
    added.forEach(file => { if (!next.some(old => old.name === file.name && old.size === file.size && old.lastModified === file.lastModified)) next.push(file); });
    if (next.length > 3) { feedback('一次最多发送 3 张图片或文件，请先移除多余的附件。', true); return; }
    filesTouched = true; files = next; renderFiles(); scheduleSave(); feedback('图片或文件已添加，可以直接发送。');
  }
  let imageDialog;
  function showImage(url, name) {
    if (!imageDialog) {
      imageDialog = document.createElement('dialog'); imageDialog.className = 'comment-image-dialog';
      imageDialog.setAttribute('aria-label', '评论图片预览');
      imageDialog.innerHTML = '<button type="button" aria-label="关闭图片">×</button><img alt=""><a target="_blank" rel="noopener noreferrer">查看原图</a>';
      imageDialog.querySelector('button').onclick = () => imageDialog.close();
      imageDialog.onclick = e => { if (e.target === imageDialog) imageDialog.close(); };
      document.body.append(imageDialog);
    }
    imageDialog.querySelector('img').src = url; imageDialog.querySelector('img').alt = name;
    imageDialog.querySelector('a').href = url; imageDialog.showModal();
  }
  function item(comment, floor, isReply) {
    const node = document.createElement('article'); node.className = `comment-item${isReply ? ' comment-reply' : ''}`;
    node.id = `comment-${comment.id}`;
    const header = document.createElement('header');
    const name = document.createElement('strong'); name.textContent = comment.visitor_name;
    if (comment.is_owner) { const badge = document.createElement('small'); badge.className = 'owner-comment-badge'; badge.textContent = '站长'; name.append(badge); }
    const meta = document.createElement('span'); meta.textContent = isReply ? `${floor} 楼内 · ` : `${floor} 楼 · `;
    const time = document.createElement('time'); time.dateTime = comment.created_at; time.textContent = articleService.formatDate(comment.created_at); meta.append(time);
    if (comment.pinned) { const badge = document.createElement('b'); badge.className = 'pinned-comment-badge'; badge.textContent = '置顶'; meta.append(badge); }
    header.append(name, meta); node.append(header);
    if (isReply && comment.reply_to_id) {
      const target = comments.find(c => c.id === comment.reply_to_id && (c.id === comment.parent_id || c.parent_id === comment.parent_id));
      const context = document.createElement('a'); context.className = 'comment-reply-target';
      context.textContent = target ? `回复 @${target.visitor_name}` : '回复已删除的评论';
      if (target) context.href = `#comment-${target.id}`; node.append(context);
    }
    if (comment.body) { const body = document.createElement('p'); body.textContent = comment.body; node.append(body); }
    const attachments = document.createElement('div'); attachments.className = 'comment-files';
    (comment.attachments || []).forEach(file => {
      let url; try { url = new URL(file.url, location.href); } catch { return; }
      if (!['https:','http:'].includes(url.protocol)) return;
      if (file.type?.startsWith('image/')) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'comment-image'; button.setAttribute('aria-label', `查看图片 ${file.name}`);
        const image = document.createElement('img'); image.src = url.href; image.alt = file.name || '评论图片'; image.loading = 'lazy';
        button.append(image); button.onclick = () => showImage(url.href, image.alt); attachments.append(button);
      } else {
        const link = document.createElement('a'); link.href = url.href; link.textContent = file.name; link.target = '_blank'; link.rel = 'noopener noreferrer'; attachments.append(link);
      }
    });
    if (attachments.childElementCount) node.append(attachments);
    const actions = document.createElement('div'); actions.className = 'comment-item-actions';
    const reply = document.createElement('button'); reply.type = 'button'; reply.className = 'comment-reply-button'; reply.textContent = '回复';
    reply.onclick = () => {
      if (busy) return;
      setReply(comment); form.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' }); form.elements.body.focus({ preventScroll: true });
    };
    const like = document.createElement('button'); like.type = 'button'; like.className = 'comment-reply-button comment-like-button';
    like.textContent = `赞 ${comment.like_count || 0}`; like.setAttribute('aria-pressed', String(articleService.hasCommentReaction(comment.id)));
    like.onclick = async () => {
      like.disabled = true;
      try { const result = await articleService.toggleCommentReaction(comment.id); like.textContent = `赞 ${result.count}`; like.setAttribute('aria-pressed', String(result.active)); }
      catch { feedback('点赞暂时失败，请稍后重试。', true); } finally { like.disabled = false; }
    };
    actions.append(reply, like); node.append(actions); return node;
  }
  function render() {
    const list = document.querySelector('#commentList'); list.replaceChildren();
    const roots = comments.filter(c => !c.parent_id).sort(byDate);
    const floors = new Map(roots.map((c,i) => [c.id, i+1]));
    const ordered = [...roots].sort((a,b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || byDate(a,b));
    document.querySelector('#commentCount').textContent = `${comments.length} 条评论 · ${roots.length} 楼`;
    if (!roots.length) {
      if (window.InkAssets) InkAssets.state(list, { kind: 'comments', title: '此卷尚待落墨', detail: '还没有评论，写句话或发张图吧。' });
      else { const empty = document.createElement('p'); empty.className = 'comment-empty'; empty.textContent = '还没有评论，写句话或发张图吧。'; list.append(empty); }
    }
    ordered.forEach(root => {
      const node = item(root, floors.get(root.id), false);
      const replies = comments.filter(c => c.parent_id === root.id).sort(byDate);
      if (replies.length) {
        const thread = document.createElement('div'); thread.className = 'comment-replies';
        const draw = subset => subset.forEach(reply => thread.append(item(reply, floors.get(root.id), true)));
        draw(expanded.has(root.id) ? replies : replies.slice(0,3));
        if (replies.length > 3 && !expanded.has(root.id)) {
          const more = document.createElement('button'); more.type = 'button'; more.className = 'comment-more'; more.textContent = `展开其余 ${replies.length-3} 条回复`;
          more.onclick = () => { expanded.add(root.id); more.remove(); draw(replies.slice(3)); }; thread.append(more);
        }
        node.append(thread);
      }
      list.append(node);
    });
    renderReplyContext();
  }
  async function load() {
    try {
      comments = await articleService.listComments(article.id); render();
      const parent = form.elements.parentId.value;
      if (parent && !comments.some(c => c.id === parent && !c.parent_id)) { setReply(null); feedback('原回复楼层已不可用，草稿保留为新评论。'); }
    } catch {
      const list = document.querySelector('#commentList'); list.replaceChildren();
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'comment-more comment-retry'; retry.textContent = '评论读取失败，点击重试'; retry.onclick = load; list.append(retry);
    }
  }
  async function send(event) {
    event.preventDefault(); if (busy) return;
    const body = form.elements.body.value.trim();
    if (!body && !files.length) { feedback('写句话或添加图片后再发送。', true); return; }
    if (body.length > 2000) { feedback('评论最多 2000 字。', true); return; }
    clearTimeout(draftTimer); saveDraft(); filesTouched = true; busy = true;
    const controls = [...form.querySelectorAll('input,textarea,button')]; controls.forEach(el => { el.disabled = true; });
    feedback('正在发送……');
    try {
      const attachments = [];
      for (let i=0; i<files.length; i++) {
        feedback(`正在上传 ${i+1}/${files.length}……`);
        if (!uploaded.has(files[i])) uploaded.set(files[i], (await articleService.uploadCommentFiles([files[i]], article.id))[0]);
        attachments.push(uploaded.get(files[i]));
      }
      const name = form.elements.visitorName.value.trim() || `访客${articleService.getVisitorToken().slice(-4)}`;
      const created = await articleService.createComment({ article_id: article.id, parent_id: form.elements.parentId.value || null, reply_to_id: form.elements.replyToId.value || null, visitor_name: name, visitor_token: articleService.getVisitorToken(), body, attachments });
      form.elements.body.value = ''; form.elements.parentId.value = ''; form.elements.replyToId.value = ''; files = []; uploaded.clear();
      textWrite('hutao-comment-name', name); form.elements.visitorName.value = name;
      try { localStorage.removeItem(key()); } catch {}
      await draftFiles(article.id, undefined, true).catch(() => {});
      savedFiles = files;
      renderReplyContext(); renderFiles();
      if (created.approved === false) feedback('已发送，审核后显示。');
      else { if (created.parent_id) expanded.add(created.parent_id); comments.push(created); render(); feedback('发送成功。'); }
    } catch (error) {
      const message = /comments_body|reply_to_id|schema cache|column.*does not exist/i.test(error.message || '') ? '评论服务需要更新，请站长执行评论升级迁移。草稿已保留。' : `发送失败：${error.message || '网络不可用'}。可直接重试，草稿已保留。`;
      feedback(message, true);
    } finally { busy = false; controls.forEach(el => { el.disabled = false; }); updateComposer(); }
  }
  function setup(value) {
    article = value; form = document.querySelector('#commentForm'); status = document.querySelector('#commentStatus');
    document.querySelector('#comments').hidden = false;
    const draft = textRead(key(), {});
    form.elements.visitorName.value = draft.name || textRead('hutao-comment-name', '');
    form.elements.body.value = draft.body || ''; form.elements.parentId.value = draft.parent || ''; form.elements.replyToId.value = draft.target || '';
    renderReplyContext(); updateComposer();
    if (draft.body) feedback('已恢复未发送的评论草稿。');
    draftFiles(article.id).then(saved => { if (!filesTouched && saved?.length) { files = saved; savedFiles = files; renderFiles(); feedback('已恢复评论和图片草稿。'); } }).catch(() => {});
    form.addEventListener('input', () => { if (status.textContent.startsWith('已恢复')) feedback(''); updateComposer(); scheduleSave(); });
    document.querySelector('#cancelReply').onclick = () => setReply(null);
    document.querySelector('#pickCommentImage').onclick = () => document.querySelector('#commentImageInput').click();
    document.querySelector('#pickCommentFile').onclick = () => form.elements.attachments.click();
    [document.querySelector('#commentImageInput'), form.elements.attachments].forEach(input => input.onchange = () => { addFiles(input.files); input.value = ''; });
    form.addEventListener('paste', event => {
      const images = [...(event.clipboardData?.items || [])].filter(item => item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
      if (images.length) { event.preventDefault(); addFiles(images); }
    });
    form.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); form.classList.add('is-dragging'); } });
    form.addEventListener('dragleave', event => { if (!form.contains(event.relatedTarget)) form.classList.remove('is-dragging'); });
    form.addEventListener('drop', event => { if (event.dataTransfer.files.length) { event.preventDefault(); form.classList.remove('is-dragging'); addFiles(event.dataTransfer.files); } });
    form.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', send);
    window.addEventListener('pagehide', () => { clearTimeout(draftTimer); saveDraft(); previewUrls.forEach(url => URL.revokeObjectURL(url)); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(draftTimer); saveDraft(); } });
  }
  window.ArticleComments = { setup, load };
}());
