/* ============================================================
   Storage helpers — chrome.storage.local with localStorage fallback
   ============================================================ */
const store = {
  async get(key, def) {
    // prefer synced value, fall back to local, then localStorage
    try {
      if (chrome?.storage?.sync) {
        const r = await chrome.storage.sync.get(key);
        if (r[key] !== undefined) return r[key];
      }
    } catch (_) {}
    try {
      if (chrome?.storage?.local) {
        const r = await chrome.storage.local.get(key);
        if (r[key] !== undefined) return r[key];
      }
    } catch (_) {}
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  },
  async set(key, val) {
    // try sync first; on quota error (8KB/item — e.g. big logo data URLs) fall back to local
    try {
      if (chrome?.storage?.sync) {
        await chrome.storage.sync.set({ [key]: val });
        // clear any stale local copy so sync stays source of truth
        try { await chrome.storage.local.remove(key); } catch (_) {}
        return;
      }
    } catch (_) {}
    try {
      if (chrome?.storage?.local) { await chrome.storage.local.set({ [key]: val }); return; }
    } catch (_) {}
    localStorage.setItem(key, JSON.stringify(val));
  }
};

/* ============================================================
   Defaults
   ============================================================ */
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_TASKS = {
  active: [
    { id: uid(), title: 'Deploy VenoPay KYC Flow', done: false, star: false },
    { id: uid(), title: 'Reply to client (Salon App)', done: false, star: false },
    { id: uid(), title: 'Update JerinLab website', done: false, star: false },
    { id: uid(), title: 'Review Shopify proposal', done: false, star: false },
    { id: uid(), title: 'Create content for Fiverr', done: false, star: false },
    { id: uid(), title: 'Stripe Issuing Integration', done: false, star: false },
    { id: uid(), title: 'Shopify App Review', done: false, star: false },
    { id: uid(), title: 'DNS migration to Cloudflare', done: false, star: false }
  ],
  completed: [
    { id: uid(), title: 'Morning workout', done: true, star: false },
    { id: uid(), title: 'Check emails', done: true, star: false },
    { id: uid(), title: 'Team standup', done: true, star: false },
    { id: uid(), title: 'Send invoice to client', done: true, star: false }
  ]
};

const DEFAULT_LINKS = [
  { name: 'Gmail',   url: 'https://mail.google.com' },
  { name: 'Fiverr',  url: 'https://www.fiverr.com' },
  { name: 'Upwork',  url: 'https://www.upwork.com' },
  { name: 'Shopify', url: 'https://www.shopify.com' },
  { name: 'Stripe',  url: 'https://dashboard.stripe.com' },
  { name: 'Mercury', url: 'https://mercury.com' },
  { name: 'GitHub',  url: 'https://github.com' },
  { name: 'Vercel',  url: 'https://vercel.com' },
  { name: 'n8n',     url: 'https://n8n.io' },
  { name: 'Coolify', url: 'https://coolify.io' },
  { name: 'ChatGPT', url: 'https://chat.openai.com' }
];

let state = { tasks: null, links: null, collapsed: false };

/* ============================================================
   Init
   ============================================================ */
(async function init() {
  state.tasks     = await store.get('tasks', null) || structuredClone(DEFAULT_TASKS);
  // migrate old {today,upcoming,completed} -> {active,completed}
  if (state.tasks.today || state.tasks.upcoming) {
    state.tasks = {
      active: [...(state.tasks.today || []), ...(state.tasks.upcoming || [])],
      completed: state.tasks.completed || []
    };
    saveTasks();
  }
  state.links     = await store.get('links', null) || structuredClone(DEFAULT_LINKS);
  state.collapsed = await store.get('collapsed', false);
  renderSidebar();
  renderQuick();
  wireGlobals();
  wireSync();
})();

/* live-update when sync pushes changes from another device */
function wireSync() {
  if (!chrome?.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let dirty = false;
    if (changes.tasks)     { state.tasks = changes.tasks.newValue; dirty = true; }
    if (changes.links)     { state.links = changes.links.newValue; dirty = true; }
    if (changes.collapsed) { state.collapsed = changes.collapsed.newValue; dirty = true; }
    if (dirty) { renderSidebar(); renderQuick(); }
  });
}

const saveTasks = () => store.set('tasks', state.tasks);
const saveLinks = () => store.set('links', state.links);

/* ============================================================
   Icons
   ============================================================ */
const checkSVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const starSVG  = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

const todayIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f5c518" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><polyline points="9 12 11.5 14.5 16 9.5" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
const upIcon    = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8a8a90" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
const doneIcon  = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#34c759" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"></rect><polyline points="8 12 11 15 16 9" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
const chevronSVG= `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

/* ============================================================
   Sidebar render
   ============================================================ */
function renderSidebar() {
  const root = document.getElementById('sidebarScroll');
  root.innerHTML = '';
  root.appendChild(section('Active Tasks', todayIcon, 'active', state.tasks.active, 'badge'));
  root.appendChild(completedSection());
}

function section(title, icon, key, list, badgeType) {
  const wrap = document.createElement('div');
  wrap.className = 'section';
  const head = document.createElement('div');
  head.className = 'section-head';
  head.innerHTML = `<span class="sec-icon">${icon}</span>
    <span class="section-title">${title}</span>
    <span class="count-badge ${badgeType === 'green' ? 'green' : ''}">${list.length}</span>`;
  wrap.appendChild(head);
  list.forEach(t => wrap.appendChild(taskRow(t, key)));
  if (key === 'active') {
    const add = document.createElement('div');
    add.className = 'new-task';
    add.innerHTML = `<span class="nt-icon">+</span><span class="nt-label">New Task</span>`;
    add.addEventListener('click', addTask);
    wrap.appendChild(add);
  }
  return wrap;
}

function completedSection() {
  const list = state.tasks.completed;
  const wrap = document.createElement('div');
  wrap.className = 'section';
  const head = document.createElement('div');
  head.className = 'section-head';
  head.innerHTML = `<span class="sec-icon">${doneIcon}</span>
    <span class="section-title">Completed</span>
    <span class="count-badge green">${list.length}</span>
    <span class="chevron ${state.collapsed ? 'collapsed' : ''}">${chevronSVG}</span>`;
  head.querySelector('.chevron').addEventListener('click', async () => {
    state.collapsed = !state.collapsed;
    await store.set('collapsed', state.collapsed);
    renderSidebar();
  });
  wrap.appendChild(head);
  if (!state.collapsed) list.forEach(t => wrap.appendChild(taskRow(t, 'completed')));
  return wrap;
}

function taskRow(t, key) {
  const row = document.createElement('div');
  row.className = 'task' + (t.done ? ' done' : '');

  // checkbox
  const cb = document.createElement('div');
  cb.className = 'checkbox';
  cb.innerHTML = checkSVG;
  cb.addEventListener('click', e => { e.stopPropagation(); toggleDone(t, key); });

  // title
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = t.title;
  title.addEventListener('dblclick', () => editTask(row, t, title));

  // star
  const star = document.createElement('div');
  star.className = 'star' + (t.star ? ' active' : '');
  star.title = 'Favorite';
  star.innerHTML = starSVG;
  star.addEventListener('click', e => { e.stopPropagation(); t.star = !t.star; saveTasks(); renderSidebar(); });

  // delete
  const del = document.createElement('div');
  del.className = 'task-del';
  del.title = 'Delete task';
  del.innerHTML = trashSVG;
  del.addEventListener('click', e => {
    e.stopPropagation();
    pull(key, t.id);
    saveTasks();
    renderSidebar();
  });

  row.append(cb, title, star, del);
  return row;
}

/* ============================================================
   Task actions
   ============================================================ */
function toggleDone(t, key) {
  t.done = !t.done;
  // move between completed and its origin
  if (t.done && key !== 'completed') {
    pull(key, t.id);
    t._origin = key;
    state.tasks.completed.unshift(t);
  } else if (!t.done && key === 'completed') {
    pull('completed', t.id);
    const dest = t._origin && state.tasks[t._origin] ? t._origin : 'active';
    state.tasks[dest].push(t);
  }
  saveTasks();
  renderSidebar();
}

function pull(key, id) {
  state.tasks[key] = state.tasks[key].filter(x => x.id !== id);
}

function editTask(row, t, titleEl) {
  const input = document.createElement('input');
  input.className = 'task-title-input';
  input.value = t.title;
  row.replaceChild(input, titleEl);
  input.focus();
  input.select();
  const commit = () => {
    t.title = input.value.trim() || t.title;
    saveTasks();
    renderSidebar();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') renderSidebar();
  });
}

function addTask() {
  const t = { id: uid(), title: 'New task', done: false, star: false };
  state.tasks.active.push(t);
  saveTasks();
  renderSidebar();
  // auto-edit the new row (last in Today section)
  const rows = document.querySelectorAll('.section')[0].querySelectorAll('.task');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('.task-title').dispatchEvent(new MouseEvent('dblclick'));
}

/* ============================================================
   Quick access
   ============================================================ */
function favicon(url) {
  try {
    const host = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  } catch { return ''; }
}

const editSVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
const trashSVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

let dragIndex = null;

function renderQuick() {
  const grid = document.getElementById('quickGrid');
  grid.innerHTML = '';
  state.links.forEach((l, i) => {
    const a = document.createElement('a');
    a.className = 'quick-item';
    a.href = l.url;
    a.draggable = true;

    const icon = document.createElement('div');
    icon.className = 'icon';
    if (l.logo) {
      const img = document.createElement('img');
      img.src = l.logo;
      img.alt = l.name;
      icon.appendChild(img);
    } else {
      const img = document.createElement('img');
      img.src = favicon(l.url);
      img.alt = l.name;
      img.onerror = () => {
        icon.className = 'icon letter';
        icon.textContent = l.name[0].toUpperCase();
      };
      icon.appendChild(img);
    }

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = l.name;

    // right-click → context menu (edit / delete)
    a.addEventListener('contextmenu', e => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, i);
    });

    // drag reorder
    a.addEventListener('dragstart', e => {
      dragIndex = i;
      a.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    a.addEventListener('dragend', () => {
      dragIndex = null;
      a.classList.remove('dragging');
      document.querySelectorAll('.quick-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    a.addEventListener('dragover', e => { e.preventDefault(); a.classList.add('drag-over'); });
    a.addEventListener('dragleave', () => a.classList.remove('drag-over'));
    a.addEventListener('drop', e => {
      e.preventDefault();
      a.classList.remove('drag-over');
      if (dragIndex === null || dragIndex === i) return;
      const [moved] = state.links.splice(dragIndex, 1);
      state.links.splice(i, 0, moved);
      saveLinks();
      renderQuick();
    });

    a.append(icon, label);
    grid.appendChild(a);
  });

  // add button
  const add = document.createElement('div');
  add.className = 'quick-item add';
  add.innerHTML = `<div class="icon">+</div><div class="label">Add</div>`;
  add.addEventListener('click', () => openLinkModal());
  grid.appendChild(add);
}

/* ============================================================
   Context menu (right-click on quick item)
   ============================================================ */
function closeContextMenu() {
  document.querySelectorAll('.context-menu').forEach(m => m.remove());
}

function openContextMenu(x, y, index) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';

  const edit = document.createElement('button');
  edit.innerHTML = `${editSVG}<span>Edit</span>`;
  edit.addEventListener('click', () => { closeContextMenu(); openLinkModal(index); });

  const del = document.createElement('button');
  del.className = 'danger';
  del.innerHTML = `<span style="display:flex">${trashSVG}</span><span>Delete</span>`;
  del.addEventListener('click', () => {
    closeContextMenu();
    state.links.splice(index, 1);
    saveLinks();
    renderQuick();
  });

  menu.append(edit, del);
  document.body.appendChild(menu);

  // keep on-screen
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth  - r.width  - 8) + 'px';
  menu.style.top  = Math.min(y, innerHeight - r.height - 8) + 'px';
}

/* ============================================================
   Modal
   ============================================================ */
let editIndex = null;   // null = adding new
let pendingLogo = null; // data URL or null

function renderLogoPreview() {
  const box = document.getElementById('logoPreview');
  const url = document.getElementById('linkUrl').value.trim();
  if (pendingLogo) {
    box.innerHTML = `<img src="${pendingLogo}" alt="" />`;
  } else if (url) {
    const src = favicon(/^https?:\/\//.test(url) ? url : 'https://' + url);
    box.innerHTML = src ? `<img src="${src}" alt="" />` : '?';
  } else {
    box.textContent = '?';
  }
}

function openLinkModal(index) {
  editIndex = (typeof index === 'number') ? index : null;
  const editing = editIndex !== null;
  const l = editing ? state.links[editIndex] : { name: '', url: '', logo: null };
  pendingLogo = l.logo || null;

  document.getElementById('modalTitle').textContent = editing ? 'Edit Quick Access' : 'Add Quick Access';
  document.getElementById('linkSave').textContent = editing ? 'Save' : 'Add';
  document.getElementById('linkName').value = l.name;
  document.getElementById('linkUrl').value = l.url;
  document.getElementById('linkModal').classList.add('open');
  renderLogoPreview();
  document.getElementById('linkName').focus();
}
function closeLinkModal() {
  document.getElementById('linkModal').classList.remove('open');
  editIndex = null;
  pendingLogo = null;
}
function saveLink() {
  const name = document.getElementById('linkName').value.trim();
  let url = document.getElementById('linkUrl').value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  const entry = { name, url, logo: pendingLogo || null };
  if (editIndex !== null) state.links[editIndex] = entry;
  else state.links.push(entry);
  saveLinks();
  renderQuick();
  closeLinkModal();
}

/* ============================================================
   Settings — export / import (tasks + links + collapsed)
   ============================================================ */
const EXPORT_VERSION = 1;

function openSettingsModal() {
  setSettingsNote('', '');
  document.getElementById('settingsModal').classList.add('open');
}
function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('open');
}
function openHelpModal()  { document.getElementById('helpModal').classList.add('open'); }
function closeHelpModal() { document.getElementById('helpModal').classList.remove('open'); }

function setSettingsNote(msg, type) {
  const el = document.getElementById('settingsNote');
  el.textContent = msg;
  el.className = 'settings-note' + (type ? ' ' + type : '');
}

function exportData() {
  const payload = {
    app: 'rocketwork',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    links: state.links,
    collapsed: state.collapsed
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `rocketwork-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setSettingsNote('Backup exported.', 'ok');
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // accept our export shape OR a bare {tasks, links}
    const tasks = data.tasks;
    const links = data.links;
    if (!tasks || !Array.isArray(tasks.active) || !Array.isArray(tasks.completed)) {
      throw new Error('No valid tasks in file');
    }
    if (!Array.isArray(links)) {
      throw new Error('No valid links in file');
    }

    state.tasks = tasks;
    state.links = links;
    state.collapsed = !!data.collapsed;

    await Promise.all([
      store.set('tasks', state.tasks),
      store.set('links', state.links),
      store.set('collapsed', state.collapsed)
    ]);

    renderSidebar();
    renderQuick();
    const n = tasks.active.length + tasks.completed.length;
    setSettingsNote(`Imported ${n} task${n === 1 ? '' : 's'} and ${links.length} link${links.length === 1 ? '' : 's'}.`, 'ok');
  } catch (err) {
    setSettingsNote('Import failed: ' + err.message, 'err');
  }
}

/* ============================================================
   Search + global wiring
   ============================================================ */
function wireGlobals() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLinkModal(); closeContextMenu(); closeSettingsModal(); closeHelpModal(); }
  });

  // toolbar buttons
  document.getElementById('helpBtn').addEventListener('click', openHelpModal);
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('helpClose').addEventListener('click', closeHelpModal);
  document.getElementById('settingsClose').addEventListener('click', closeSettingsModal);
  document.getElementById('helpModal').addEventListener('click', e => {
    if (e.target.id === 'helpModal') closeHelpModal();
  });
  document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target.id === 'settingsModal') closeSettingsModal();
  });

  // export / import
  const importFile = document.getElementById('importFile');
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const f = importFile.files[0];
    if (f) importData(f);
    importFile.value = '';
  });
  // dismiss context menu on any outside interaction
  document.addEventListener('click', e => {
    if (!e.target.closest('.context-menu')) closeContextMenu();
  });
  window.addEventListener('scroll', closeContextMenu, true);
  window.addEventListener('resize', closeContextMenu);

  document.getElementById('linkCancel').addEventListener('click', closeLinkModal);
  document.getElementById('linkSave').addEventListener('click', saveLink);
  document.getElementById('linkModal').addEventListener('click', e => {
    if (e.target.id === 'linkModal') closeLinkModal();
  });
  document.getElementById('linkUrl').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveLink();
  });
  document.getElementById('linkUrl').addEventListener('input', () => {
    if (!pendingLogo) renderLogoPreview();
  });

  // logo upload / clear
  const fileInput = document.getElementById('logoFile');
  document.getElementById('logoUploadBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // downscale to max 96px, keep aspect, export PNG data URL
        const max = 96;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        pendingLogo = c.toDataURL('image/png');
        renderLogoPreview();
      };
      img.onerror = () => { pendingLogo = reader.result; renderLogoPreview(); };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
    fileInput.value = '';
  });
  document.getElementById('logoClearBtn').addEventListener('click', () => {
    pendingLogo = null;
    renderLogoPreview();
  });
}
