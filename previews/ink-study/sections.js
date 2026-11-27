(() => {
  'use strict';

  const form = document.querySelector('#folio-write');
  if (!form) return;
  const body = form.elements.body;
  const author = form.elements.author;
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector('.folio-feedback');
  const count = form.querySelector('#folio-count');
  const pending = form.querySelector('#folio-files');
  const posts = document.getElementById('folio-posts');
  const total = document.getElementById('folio-note-total');
  const types = ['image/jpeg','image/png','image/webp','image/gif'];
  const urls = new Set();
  const selected = [];
  const draftKey = 'ink-study-preview.note-draft.v1';
  let saving = false;
  let database;

  function openBook() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('ink-study-preview.notes', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('notes', {keyPath:'id', autoIncrement:true});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('blocked'));
    }).catch(error => { database = undefined; throw error; });
    return database;
  }

  async function notesTransaction(mode, action) {
    const db = await openBook();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', mode);
      const request = action(tx.objectStore('notes'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error || request.error);
    });
  }

  function saveDraft() {
    try { localStorage.setItem(draftKey, JSON.stringify({author:author.value, body:body.value})); } catch {}
  }
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey));
    if (draft) {
      author.value = String(draft.author || '').slice(0,30);
      body.value = String(draft.body || '').slice(0,2000);
    }
  } catch {}

  function refresh() {
    count.textContent = body.value.length + ' / 2000';
    submit.disabled = saving || (!body.value.trim() && !selected.length);
  }
  function listFiles() {
    pending.replaceChildren();
    selected.forEach((file,index) => {
      const item = document.createElement('span');
      item.append(file.name);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'folio-file-remove';
      remove.setAttribute('aria-label', '移除' + file.name);
      remove.textContent = '×';
      remove.onclick = () => {
        selected.splice(index,1);
        listFiles();
        (pending.querySelector('button') || form.querySelector('[data-folio-pick]')).focus();
      };
      item.append(remove);
      pending.append(item);
    });
    refresh();
  }
  function addFiles(files) {
    const messages = new Set();
    for (const file of files) {
      if (selected.length >= 3) { messages.add('每条留言最多附 3 件文件。'); break; }
      if (file.size > 5*1024*1024) { messages.add(file.name + ' 超过 5 MB。'); continue; }
      if (!types.includes(file.type) && !/\.(txt|pdf)$/i.test(file.name)) {
        messages.add(file.name + ' 的格式不受支持。'); continue;
      }
      if (!selected.some(other=>other.name===file.name && other.size===file.size && other.lastModified===file.lastModified)) selected.push(file);
    }
    status.textContent = [...messages].join(' ');
    listFiles();
  }

  function renderNote(note) {
    const article = document.createElement('article');
    const heading = document.createElement('header');
    const by = document.createElement('strong');
    by.textContent = note.author || '访客';
    const time = document.createElement('time');
    const timestamp = new Date(note.saved);
    time.dateTime = timestamp.toISOString();
    time.textContent = timestamp.toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    heading.append(by,time);
    article.append(heading);
    if (note.body) {
      const text = document.createElement('p');
      text.textContent = note.body;
      article.append(text);
    }
    for (const file of note.files || []) {
      const download = document.createElement('a');
      const url = URL.createObjectURL(file);
      urls.add(url);
      download.href = url;
      download.download = file.name;
      download.textContent = file.name;
      if (types.includes(file.type)) {
        const image = document.createElement('img');
        image.loading = 'lazy';
        image.alt = '';
        image.src = url;
        download.prepend(image);
      }
      article.append(download);
    }
    return article;
  }

  function updateTotal() { total.textContent = posts.childElementCount + ' 条留言'; }
  const initialLoad = notesTransaction('readonly', store=>store.getAll()).then(rows => {
    posts.replaceChildren(...rows.reverse().map(renderNote));
    updateTotal();
  }).catch(() => { status.textContent='浏览器暂时无法读取本地留言。'; });

  for (const button of form.querySelectorAll('[data-folio-pick]')) {
    const input = form.querySelector('#folio-' + button.dataset.folioPick);
    button.onclick = () => input.click();
    input.onchange = () => { addFiles([...input.files]); input.value = ''; };
  }
  form.addEventListener('paste', event => {
    const files = [...(event.clipboardData?.files || [])];
    if (files.length) { event.preventDefault(); addFiles(files); }
  });
  form.addEventListener('input', () => { saveDraft(); refresh(); });
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing && !submit.disabled) {
      event.preventDefault(); form.requestSubmit();
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const note = {author:author.value.trim(), body:body.value.trim(), saved:Date.now(), files:[...selected]};
    saving = true;
    const controls=[...form.querySelectorAll('input,textarea,button')];
    for (const control of controls) control.disabled = true;
    try {
      await initialLoad;
      await notesTransaction('readwrite', store=>store.add(note));
      posts.prepend(renderNote(note));
      updateTotal();
      body.value='';
      selected.length=0;
      saveDraft();
      listFiles();
      status.textContent='留言已保存在此浏览器。';
    } catch {
      status.textContent='本地存储不可用或已满。内容已保留，可以移除附件后重试。';
    } finally {
      for (const control of controls) control.disabled = false;
      saving = false;
      refresh();
    }
  });
  refresh();
  window.addEventListener('pagehide', event=>{
    if (!event.persisted) for (const url of urls) URL.revokeObjectURL(url);
  });
})();
