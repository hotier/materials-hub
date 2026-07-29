// ========================================
//   产出导航站 — 首页 JS
// ========================================

const API_BASE = '/api';
const PREVIEW_BASE = '/preview';

// ---- State ----
let allMaterials = [];
let treeData = null;
let currentPath = null;   // 当前选中的目录路径，null = 全部
let selectedItem = null;  // 当前选中预览的产出
let searchQuery = '';

// ---- DOM refs ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const tableBody = $('#tableBody');
const loading = $('#loading');
const emptyState = $('#emptyState');
const workspace = $('#workspace');
const searchInput = $('#searchInput');
const materialCount = $('#materialCount');
const logoutBtn = $('#logoutBtn');
const breadcrumb = $('#breadcrumb');
const panelTitle = $('#panelTitle');
const panelCount = $('#panelCount');
const previewPanel = $('#previewPanel');
const ffViewer = $('#ffViewer');
const previewPlaceholder = $('#previewPlaceholder');
const previewFrame = $('#previewFrame');
const previewImg = $('#previewImg');
const previewImgContent = $('#previewImgContent');
const previewCode = $('#previewCode');
const previewCodeContent = $('#previewCodeContent');
const previewMd = $('#previewMd');
const previewMdContent = $('#previewMdContent');
const previewMdSource = $('#previewMdSource');
const previewMdSourceCode = $('#previewMdSourceCode');
const previewPanelTitle = $('#previewPanelTitle');
const previewPanelExtBadge = $('#previewPanelExtBadge');
const previewPanelMdToggle = $('#previewPanelMdToggle');
const previewOpenBtn = $('#previewOpenBtn');
const previewCloseBtn = $('#previewCloseBtn');
const listPanel = $('#listPanel');
const sidebar = $('#sidebar');
const dirTree = $('#dirTree');

// Delete modal
const deleteModal = $('#deleteModal');
const deleteItemName = $('#deleteItemName');
const cancelDelete = $('#cancelDelete');
const confirmDelete = $('#confirmDelete');
let deleteTargetId = null;

// Edit modal
const editModal = $('#editModal');
const editName = $('#editName');
const editDesc = $('#editDesc');
const editTags = $('#editTags');
const editExt = $('#editExt');
const cancelEdit = $('#cancelEdit');
const confirmEdit = $('#confirmEdit');
let editTargetItem = null;

// ---- Init ----
if (!location.pathname.endsWith('/upload.html')
    && !location.pathname.endsWith('/upload')
    && !location.pathname.endsWith('/login.html')
    && !location.pathname.endsWith('/login')
    && !location.pathname.endsWith('/preview.html')
    && !location.pathname.endsWith('/preview')) {
  init();
}

async function init() {
  checkAuth();
  bindEvents();
  await loadMaterials();
}

function bindEvents() {
  // Search
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderList();
  });

  // Preview actions
  previewCloseBtn.addEventListener('click', closePreview);
  previewOpenBtn.addEventListener('click', (e) => {
    // 按钮本身已是 <a target="_blank" href="/preview?id=...">，点击由浏览器开一个新窗口；
    // 这里只阻止「未选中时」的默认行为，避免重复打开窗口
    if (!selectedItem) e.preventDefault();
  });


  // Delete modal
  cancelDelete.addEventListener('click', () => { deleteModal.style.display = 'none'; });
  confirmDelete.addEventListener('click', handleDelete);
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) deleteModal.style.display = 'none';
  });

  // Edit modal
  cancelEdit.addEventListener('click', () => { editModal.style.display = 'none'; editTargetItem = null; });
  confirmEdit.addEventListener('click', executeEdit);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) { editModal.style.display = 'none'; editTargetItem = null; }
  });

  // Auth
  logoutBtn.addEventListener('click', async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    location.href = '/login.html?logout=1';
  });

  // Global click → close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.data-actions')) {
      closeAllDropdowns();
    }
  });
}

// ---- Auth ----
async function checkAuth() {
  try {
    const statusResp = await fetch('/api/auth-status');
    const data = await statusResp.json();
    if (!data.requireAuth) {
      logoutBtn.style.display = 'none';
      return;
    }
    const resp = await fetch('/api/session');
    if (resp.ok) {
      logoutBtn.style.display = 'inline-flex';
      return;
    }
  } catch (e) { /* ignore */ }
  // 未登录 → 重定向
  location.href = '/login.html';
}

// ---- Load Materials ----
async function loadMaterials() {
  const cached = getCachedList();

  // 1. 有缓存：立即用缓存渲染，loading 不显示
  if (cached.data) {
    applyMaterials(cached.data);
    // 缓存新鲜则跳过网络请求
    if (cached.fresh) return;
  } else {
    loading.style.display = 'flex';
    emptyState.style.display = 'none';
    workspace.style.display = 'none';
  }

  // 2. 异步拉取最新数据
  try {
    const resp = await fetch(`${API_BASE}/list`);
    if (resp.status === 401) {
      showToast('请先登录', 'warning');
      setTimeout(() => location.href = '/login.html', 1000);
      return;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const materials = Array.isArray(data) ? data : (data.materials || []);
    setCachedList(materials);
    applyMaterials(materials);
  } catch (err) {
    console.error('加载产出列表失败:', err);
    loading.style.display = 'none';
    // 有缓存时网络失败不弹 toast，静默使用旧数据
    if (!cached.data) {
      showToast('加载失败，请刷新重试', 'error');
    }
  }
}

/** 将材料数据应用到 UI */
function applyMaterials(materials) {
  allMaterials = materials;
  materialCount.textContent = allMaterials.length;
  buildTree();
  renderList();

  loading.style.display = 'none';
  if (allMaterials.length === 0) {
    emptyState.style.display = 'flex';
    workspace.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    workspace.style.display = 'flex';
    navigateToToday();
  }
}

// ---- Tree ----
function buildTree() {
  const root = {
    name: '全部',
    path: '',
    children: {},
    count: allMaterials.length,
    expanded: true
  };

  for (const item of allMaterials) {
    // Parse createTime to year/month/day
    let year, month, day;
    if (item.createTime) {
      const d = new Date(item.createTime);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear().toString();
        month = (d.getMonth() + 1).toString().padStart(2, '0');
        day = d.getDate().toString().padStart(2, '0');
      }
    }

    if (!year) {
      if (!root.children['__no_time__']) {
        root.children['__no_time__'] = {
          name: '无日期', path: '__no_time__', children: {}, count: 0, expanded: false
        };
      }
      root.children['__no_time__'].count++;
      continue;
    }

    const yPath = year;
    const mPath = `${year}/${month}`;
    const dPath = `${year}/${month}/${day}`;

    // Year
    if (!root.children[yPath]) {
      root.children[yPath] = { name: `${year}年`, path: yPath, children: {}, count: 0, expanded: false };
    }
    root.children[yPath].count++;

    // Month
    if (!root.children[yPath].children[mPath]) {
      root.children[yPath].children[mPath] = { name: `${parseInt(month)}月`, path: mPath, children: {}, count: 0, expanded: false };
    }
    root.children[yPath].children[mPath].count++;

    // Day
    if (!root.children[yPath].children[mPath].children[dPath]) {
      root.children[yPath].children[mPath].children[dPath] = { name: `${parseInt(day)}日`, path: dPath, children: {}, count: 0, expanded: false };
    }
    root.children[yPath].children[mPath].children[dPath].count++;
  }

  treeData = root;
  renderTree();
}

function renderTree() {
  if (!treeData) return;

  const buildNode = (node, depth = 0) => {
    const children = Object.values(node.children);
    const hasChildren = children.length > 0;

    let html = '';
    if (depth > 0) {
      // Render node header
      const isActive = currentPath === node.path || (currentPath === null && node.path === '');
      const isRoot = node.path === '';
      html += `<div class="tree-node" data-path="${node.path}">
        <div class="tree-node-header${isActive ? ' active' : ''}" data-path="${node.path}">
          ${hasChildren
            ? `<span class="tree-node-arrow${node.expanded !== false ? ' expanded' : ''}">▶</span>`
            : `<span style="width:16px;flex-shrink:0;"></span>`
          }
          <svg class="tree-node-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${hasChildren
              ? '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
              : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
            }
          </svg>
          <span class="tree-node-label">${escapeHtml(node.name)}</span>
          <span class="tree-node-count">${node.count}</span>
        </div>`;

      if (hasChildren && node.expanded !== false) {
        html += `<div class="tree-children">`;
        for (const child of children) {
          html += buildNode(child, depth + 1);
        }
        html += `</div>`;
      }

      html += `</div>`;
    } else {
      // Root level — only render children directly
      for (const child of children) {
        html += buildNode(child, depth + 1);
      }
    }

    return html;
  };

  dirTree.innerHTML =
    `<div class="tree-node">
      <div class="tree-node-header${currentPath === null ? ' active' : ''}" data-path="">
        <span style="width:16px;flex-shrink:0;"></span>
        <svg class="tree-node-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span class="tree-node-label">全部</span>
        <span class="tree-node-count">${allMaterials.length}</span>
      </div>
    </div>` + buildNode(treeData);

  // Bind tree events
  dirTree.querySelectorAll('.tree-node-header').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleTreeNodeClick(el.dataset.path);
    });
  });
  dirTree.querySelectorAll('.tree-node-arrow').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = el.parentElement.dataset.path;
      toggleTreeNode(path);
    });
  });
}

function handleTreeNodeClick(path) {
  currentPath = path || null;

  // Update breadcrumb
  updateBreadcrumb(path);

  // Update tree active state
  dirTree.querySelectorAll('.tree-node-header').forEach(el => {
    el.classList.toggle('active', el.dataset.path === path);
  });

  renderList();
}

function toggleTreeNode(path) {
  const node = findNodeInTree(treeData, path);
  if (node) {
    node.expanded = !node.expanded;
    renderTree();
  }
}

function findNodeInTree(node, path) {
  if (node.path === path) return node;
  for (const child of Object.values(node.children)) {
    const found = findNodeInTree(child, path);
    if (found) return found;
  }
  return null;
}

function navigateToToday() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  const yPath = year;
  const mPath = `${year}/${month}`;
  const dPath = `${year}/${month}/${day}`;

  // Find the deepest existing path
  let targetPath = null;
  if (findNodeInTree(treeData, dPath)) {
    targetPath = dPath;
  } else if (findNodeInTree(treeData, mPath)) {
    targetPath = mPath;
  } else if (findNodeInTree(treeData, yPath)) {
    targetPath = yPath;
  }

  if (!targetPath) return;

  // Expand ancestors and navigate
  expandAncestors(targetPath);
  handleTreeNodeClick(targetPath);
}

// Expand all ancestor nodes of a path
function expandAncestors(targetPath) {
  const parts = targetPath.split('/');
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    const node = findNodeInTree(treeData, acc);
    if (node && !node.expanded) {
      node.expanded = true;
    }
  }
  renderTree();
}

// After delete/data change, restore navigation to the previous path
// Falls back to the nearest surviving ancestor if the exact path no longer exists
function restoreNavigation(savedPath) {
  if (!savedPath) {
    // Was at root, just render
    handleTreeNodeClick(null);
    return;
  }

  // Walk up from savedPath to find deepest existing ancestor
  const parts = savedPath.split('/');
  while (parts.length > 0) {
    const testPath = parts.join('/');
    if (findNodeInTree(treeData, testPath)) {
      // Expand ancestors and navigate
      expandAncestors(testPath);
      handleTreeNodeClick(testPath);
      return;
    }
    parts.pop();
  }

  // Nothing survived, back to root
  handleTreeNodeClick(null);
}

function updateBreadcrumb(path) {
  if (!breadcrumb) return;
  if (!path) {
    breadcrumb.innerHTML = `<span class="breadcrumb-item active">全部</span>`;
    return;
  }

  const parts = path.split('/');
  let html = `<span class="breadcrumb-item" data-path="">全部</span>`;
  for (let i = 0; i < parts.length; i++) {
    let label = parts[i];
    if (i === 0 && /^\d{4}$/.test(label)) label += '年';
    else if (i === 1 && /^\d{2}$/.test(label)) label = parseInt(label) + '月';
    else if (i === 2 && /^\d{2}$/.test(label)) label = parseInt(label) + '日';
    const partial = parts.slice(0, i + 1).join('/');
    html += `<span class="breadcrumb-sep">/</span>`;
    if (i === parts.length - 1) {
      html += `<span class="breadcrumb-item active" data-path="${partial}">${escapeHtml(label)}</span>`;
    } else {
      html += `<span class="breadcrumb-item" data-path="${partial}">${escapeHtml(label)}</span>`;
    }
  }
  breadcrumb.innerHTML = html;

  breadcrumb.querySelectorAll('.breadcrumb-item').forEach(el => {
    el.addEventListener('click', () => handleTreeNodeClick(el.dataset.path));
  });
}

// ---- Render List ----
function renderList() {
  const filtered = getFilteredMaterials();

  if (panelTitle) panelTitle.textContent = currentPath ? formatTimePath(currentPath) : '全部产出';
  if (panelCount) panelCount.textContent = `${filtered.length} 个`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--c-text-muted);">当前目录下没有匹配的产出</td></tr>`;
    if (previewPanel.classList.contains('open')) closePreview();
    return;
  }

  tableBody.innerHTML = filtered.map(item => {
    const tags = (item.tags || []).map(t => escapeHtml(t)).join('');
    const isSelected = selectedItem && selectedItem.id === item.id;

    return `<tr class="data-row${isSelected ? ' selected' : ''}" data-id="${item.id}">
      <td>
        <div class="data-name">
          <span class="data-name-text" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        </div>
      </td>
      <td>
        <span class="data-ext-badge">${escapeHtml(item.ext || '?')}</span>
      </td>
      <td>
        <div class="data-desc" title="${escapeHtml(item.desc || '')}">${escapeHtml(item.desc || '—')}</div>
      </td>
      <td>
        <div class="data-tags">${(item.tags || []).map(t => `<span class="data-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </td>
      <td>
        <div class="data-actions">
          <button class="data-btn-more" data-id="${item.id}" title="更多操作">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          <div class="data-dropdown" id="dropdown-${item.id}">
            <button class="data-dropdown-item dropdown-edit" data-id="${item.id}">编辑</button>
            <button class="data-dropdown-item dropdown-copy" data-id="${item.id}">复制链接</button>
            <button class="data-dropdown-item dropdown-new-window" data-id="${item.id}">新窗口打开</button>
            <button class="data-dropdown-item dropdown-delete" data-id="${item.id}">删除</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Bind row events
  tableBody.querySelectorAll('.data-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't trigger preview if clicking dropdown items or more button
      if (e.target.closest('.data-btn-more') || e.target.closest('.data-dropdown-item')) return;
      const id = row.dataset.id;
      const item = allMaterials.find(m => m.id === id);
      if (item) openPreview(item);
    });
  });

  // More button → toggle dropdown
  tableBody.querySelectorAll('.data-btn-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const dropdown = document.getElementById(`dropdown-${id}`);
      if (!dropdown) return;
      // Reset position
      dropdown.style.top = '';
      dropdown.style.bottom = '';
      // Close all other open dropdowns
      document.querySelectorAll('.data-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
      // Flip if off-screen
      if (dropdown.classList.contains('open')) {
        requestAnimationFrame(() => {
          const dr = dropdown.getBoundingClientRect();
          if (dr.bottom > window.innerHeight - 8) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = '100%';
            dropdown.style.marginTop = '0';
            dropdown.style.marginBottom = '4px';
          }
        });
      }
    });
  });

  // Dropdown actions
  tableBody.querySelectorAll('.dropdown-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = allMaterials.find(m => m.id === id);
      if (!item) return;
      closeAllDropdowns();
      handleEdit(item);
    });
  });

  tableBody.querySelectorAll('.dropdown-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      closeAllDropdowns();
      const url = `${location.origin}/preview?id=${encodeURIComponent(id)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('链接已复制');
      }).catch(() => {
        showToast('复制失败，请重试');
      });
    });
  });

  tableBody.querySelectorAll('.dropdown-new-window').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      closeAllDropdowns();
      window.open(`${location.origin}/preview?id=${encodeURIComponent(id)}`, '_blank');
    });
  });

  tableBody.querySelectorAll('.dropdown-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = allMaterials.find(m => m.id === id);
      closeAllDropdowns();
      if (item) showDeleteModal(item);
    });
  });
}

function getFilteredMaterials() {
  let items = allMaterials;

  // Filter by current dir path (time-based: YYYY, YYYY/MM, YYYY/MM/DD)
  if (currentPath) {
    if (currentPath === '__no_time__') {
      items = items.filter(m => {
        if (!m.createTime) return true;
        return isNaN(new Date(m.createTime).getTime());
      });
    } else {
      const parts = currentPath.split('/');
      items = items.filter(m => {
        if (!m.createTime) return false;
        const d = new Date(m.createTime);
        if (isNaN(d.getTime())) return false;
        const y = d.getFullYear().toString();
        const mo = (d.getMonth() + 1).toString().padStart(2, '0');
        const da = d.getDate().toString().padStart(2, '0');
        if (parts.length >= 1 && y !== parts[0]) return false;
        if (parts.length >= 2 && mo !== parts[1]) return false;
        if (parts.length >= 3 && da !== parts[2]) return false;
        return true;
      });
    }
  }

  // Filter by search query
  if (searchQuery) {
    items = items.filter(m =>
      m.name.toLowerCase().includes(searchQuery) ||
      (m.desc && m.desc.toLowerCase().includes(searchQuery)) ||
      (m.tags && m.tags.some(t => t.toLowerCase().includes(searchQuery)))
    );
  }

  return items;
}

// ---- Preview ----
let ffHandle = null;

// 用命令式 mountViewer 挂载 Flyfish（Web Component 为属性驱动，且 mountViewer 返回的是普通句柄对象，
// 通过 .subscribe(state => ...) 监听 state.ready / state.error，而不是 DOM 事件）
function mountFlyfish(container, opts, onReady, onError) {
  if (ffHandle) {
    try { if (typeof ffHandle.destroy === 'function') ffHandle.destroy(); } catch (e) {}
    ffHandle = null;
  }
  // 清理容器（含可能存在的 shadow DOM）
  container.innerHTML = '';
  if (container.shadowRoot) container.shadowRoot.innerHTML = '';

  if (!window.FlyfishFileViewerWebFull || !window.FlyfishFileViewerWebFull.mountViewer) {
    if (onError) onError();
    return;
  }
  ffHandle = window.FlyfishFileViewerWebFull.mountViewer(container, {
    theme: 'light',
    locale: 'zh-CN',
    toolbar: { position: 'bottom-right' },
    ...opts,
  });

  const applyState = (state) => {
    if (state && state.error) { if (onError) onError(); }
    else if (state && state.ready) { if (onReady) onReady(); }
  };

  if (typeof ffHandle.subscribe === 'function') {
    ffHandle.subscribe(applyState);
  } else {
    // 兜底：轮询 getState()
    const timer = setInterval(() => {
      const st = (ffHandle && typeof ffHandle.getState === 'function') ? ffHandle.getState() : null;
      if (st && (st.error || st.ready)) { clearInterval(timer); applyState(st); }
    }, 300);
  }
}

// 构造带扩展名的文件名交给 Flyfish 识别类型（item.name 是用户标题、可能不含后缀）
function ffViewerName(item) {
  const ext = (item.ext || '').toLowerCase();
  if (ext && !item.name.toLowerCase().endsWith('.' + ext)) {
    return item.name + '.' + ext;
  }
  return item.name;
}

function openPreview(item) {
  selectedItem = item;

  // Update list selection
  tableBody.querySelectorAll('.data-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.id === item.id);
  });

  previewPanel.classList.add('open');

  const ext = (item.ext || '').toLowerCase();
  previewOpenBtn.href = `${PREVIEW_BASE}?id=${encodeURIComponent(item.id)}`;
  previewPanelTitle.textContent = item.name;
  previewPanelExtBadge.textContent = ext;
  previewPanelExtBadge.style.display = '';
  previewPanelMdToggle.style.display = 'none';

  // Show loading placeholder
  previewPlaceholder.style.display = 'flex';
  previewPlaceholder.querySelector('p').textContent = '加载预览中...';

  // 统一交给 Flyfish File Viewer 渲染（支持约 200+ 种格式）
  ffViewer.style.display = 'block';
  mountFlyfish(
    ffViewer,
    {
      url: `${API_BASE}/raw?key=${encodeURIComponent(item.R2Key || '')}`,
      name: ffViewerName(item),
    },
    () => { previewPlaceholder.style.display = 'none'; },
    () => {
      previewPlaceholder.style.display = 'flex';
      previewPlaceholder.querySelector('p').textContent = '预览加载失败';
    }
  );
}

function closePreview() {
  selectedItem = null;
  previewPanel.classList.remove('open');
  ffViewer.style.display = 'none';
  if (ffHandle) {
    if (typeof ffHandle.destroy === 'function') { try { ffHandle.destroy(); } catch (e) {} }
    ffHandle = null;
    ffViewer.innerHTML = '';
  }

  // Reset header
  previewPanelTitle.textContent = '预览';
  previewPanelExtBadge.style.display = 'none';
  previewPanelMdToggle.style.display = 'none';

  tableBody.querySelectorAll('.data-row').forEach(row => {
    row.classList.remove('selected');
  });

  previewPlaceholder.style.display = 'flex';
  previewPlaceholder.querySelector('p').textContent = '点击列表中的产出查看预览';
}

// ---- Delete ----
function showDeleteModal(item) {
  deleteTargetId = item.id;
  deleteItemName.textContent = item.name;
  deleteModal.style.display = 'flex';
}

async function handleDelete() {
  if (!deleteTargetId) return;

  try {
    const resp = await fetch(`${API_BASE}/item?id=${encodeURIComponent(deleteTargetId)}`, {
      method: 'DELETE',
    });

    if (!resp.ok && resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}`);
    }

    // Remove from local state
    allMaterials = allMaterials.filter(m => m.id !== deleteTargetId);
    setCachedList(allMaterials);
    materialCount.textContent = allMaterials.length;

    if (selectedItem && selectedItem.id === deleteTargetId) {
      closePreview();
    }

    // Rebuild tree and restore navigation
    const savedPath = currentPath;
    buildTree();
    restoreNavigation(savedPath);

    showToast('已删除', 'success');

    if (allMaterials.length === 0) {
      workspace.style.display = 'none';
      emptyState.style.display = 'flex';
    }
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败，请重试', 'error');
  } finally {
    deleteModal.style.display = 'none';
    deleteTargetId = null;
  }
}

// ---- Dropdown helpers ----
function closeAllDropdowns() {
  document.querySelectorAll('.data-dropdown.open').forEach(d => d.classList.remove('open'));
}

async function handleEdit(item) {
  editTargetItem = item;
  editName.value = item.name || '';
  editDesc.value = item.desc || '';
  editTags.value = (item.tags || []).join(', ');
  editExt.textContent = item.ext ? '.' + item.ext : '';
  editModal.style.display = 'flex';
  setTimeout(() => editName.focus(), 50);
}

async function executeEdit() {
  if (!editTargetItem) return;
  const newName = editName.value.trim();
  if (!newName) { showToast('名称不能为空', 'error'); return; }

  const newDesc = editDesc.value.trim();
  const newTags = editTags.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  // 未改动则直接关闭
  const unchanged =
    newName === (editTargetItem.name || '') &&
    newDesc === (editTargetItem.desc || '') &&
    newTags.join(',') === (editTargetItem.tags || []).join(',');
  if (unchanged) { editModal.style.display = 'none'; editTargetItem = null; return; }

  try {
    const res = await fetch(`/api/item?id=${encodeURIComponent(editTargetItem.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, desc: newDesc, tags: newTags }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '保存失败');
    }
    showToast('保存成功');
    // Refresh local data
    const r = await res.json();
    const idx = allMaterials.findIndex(m => m.id === editTargetItem.id);
    if (idx !== -1 && r.item) allMaterials[idx] = r.item;
    if (selectedItem && selectedItem.id === editTargetItem.id) selectedItem = allMaterials[idx];
    setCachedList(allMaterials);
    renderList();
  } catch (e) {
    showToast(e.message || '保存失败', 'error');
  } finally {
    editModal.style.display = 'none';
    editTargetItem = null;
  }
}

// ---- Toast ----
function showToast(msg, type = 'success') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.addEventListener('animationend', () => toast.remove());
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

// ---- Utils ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimePath(path) {
  const parts = path.split('/');
  return parts.map((p, i) => {
    if (i === 0 && /^\d{4}$/.test(p)) return p + '年';
    if (i === 1 && /^\d{2}$/.test(p)) return parseInt(p) + '月';
    if (i === 2 && /^\d{2}$/.test(p)) return parseInt(p) + '日';
    return p;
  }).join(' / ');
}

// ========================================
//   Upload Page Logic
// ========================================
(function initUploadIfNeeded() {
  if (!location.pathname.endsWith('/upload.html') && !location.pathname.endsWith('/upload')) return;

  let isAuth = false;
  const authSection = $('#authSection');
  const uploadSection = $('#uploadSection');
  const authPassword = $('#authPassword');
  const authSubmit = $('#authSubmit');
  const dropZone = $('#dropZone');
  const fileInput = $('#fileInput');
  const folderInput = $('#folderInput');
  const filePreviewList = $('#filePreviewList');
  const uploadProgress = $('#uploadProgress');
  const progressFill = $('#progressFill');
  const progressText = $('#progressText');
  const uploadSuccess = $('#uploadSuccess');
  const successMsg = $('#successMsg');
  const uploadAnother = $('#uploadAnother');
  const previewUploadBtn = $('#previewUploadBtn');

  let selectedFiles = [];
  let uploadedItemId = null;

  async function checkAuth() {
    try {
      const resp = await fetch('/api/auth-status');
      const data = await resp.json();
      if (!data.requireAuth) {
        onAuthSuccess();
        return;
      }
      const sessionResp = await fetch('/api/session');
      if (sessionResp.ok) {
        onAuthSuccess();
        return;
      }
    } catch (e) { /* ignore */ }
    // 未登录 → 重定向到登录页，登录后回到上传页
    location.href = '/login.html?redirect=' + encodeURIComponent('/upload.html');
  }

  function onAuthSuccess() {
    isAuth = true;
    authSection.style.display = 'none';
    uploadSection.style.display = '';
  }

  async function doLogin(pwd) {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '密码错误' }));
      throw new Error(err.error || '密码错误');
    }
    return resp.json();
  }

  // Auth submit
  authSubmit.addEventListener('click', async () => {
    const pwd = authPassword.value.trim();
    if (!pwd) { showToast('请输入密码', 'warning'); return; }
    authSubmit.disabled = true;
    authSubmit.textContent = '验证中...';
    try {
      await doLogin(pwd);
      onAuthSuccess();
      showToast('验证成功', 'success');
    } catch (e) {
      showToast(e.message || '验证失败', 'error');
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = '验证';
    }
  });
  authPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authSubmit.click();
  });

  // 显示/隐藏密码（上传页）
  const authPwdToggle = $('#authPwdToggle');
  if (authPwdToggle) {
    authPwdToggle.addEventListener('click', () => {
      const isPass = authPassword.type === 'password';
      authPassword.type = isPass ? 'text' : 'password';
      authPwdToggle.innerHTML = isPass
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      authPassword.focus();
    });
  }

  // File input（单个或多个文件）
  fileInput.addEventListener('change', () => {
    const items = Array.from(fileInput.files).map(f => ({ file: f, relativePath: f.webkitRelativePath || null }));
    addFiles(items);
    fileInput.value = '';
  });
  // Folder input（整体文件夹，保留目录结构）
  folderInput.addEventListener('change', () => {
    const items = Array.from(folderInput.files).map(f => ({ file: f, relativePath: f.webkitRelativePath || f.name }));
    addFiles(items);
    folderInput.value = '';
  });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const items = e.dataTransfer.items;
    let collected;
    if (items && items.length && items[0].webkitGetAsEntry) {
      const entries = [];
      for (const it of items) {
        const entry = it.webkitGetAsEntry && it.webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      collected = entries.length ? await traverseEntries(entries) : [];
    } else {
      collected = Array.from(e.dataTransfer.files).map(f => ({ file: f, relativePath: f.webkitRelativePath || null }));
    }
    if (collected.length) addFiles(collected);
  });

  // 递归遍历拖入的文件夹，收集所有文件并带上相对路径
  async function traverseEntries(entries, basePath = '') {
    const result = [];
    for (const entry of entries) {
      const path = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isFile) {
        await new Promise(res => entry.file(f => { result.push({ file: f, relativePath: path }); res(); }));
      } else if (entry.isDirectory) {
        const children = await readDirEntry(entry);
        const sub = await traverseEntries(children, path);
        result.push(...sub);
      }
    }
    return result;
  }
  function readDirEntry(dirEntry) {
    return new Promise(resolve => {
      const reader = dirEntry.createReader();
      const all = [];
      const readBatch = () => {
        reader.readEntries(batch => {
          if (!batch.length) resolve(all);
          else { all.push(...batch); readBatch(); }
        }, () => resolve(all));
      };
      readBatch();
    });
  }

  function addFiles(files) {
    selectedFiles = files;
    renderFileList();
    if (files.length > 0) {
      startUpload();
    }
  }

  function renderFileList() {
    filePreviewList.innerHTML = selectedFiles.map((f, i) => {
      const name = f.file.name;
      const ext = (name.split('.').pop() || '').toLowerCase();
      const size = f.file.size < 1024 * 1024
        ? `${(f.file.size / 1024).toFixed(1)} KB`
        : `${(f.file.size / 1024 / 1024).toFixed(2)} MB`;
      const display = f.relativePath || name;
      return `<div class="file-preview-item">
        <div class="file-preview-icon">${ext.slice(0, 4)}</div>
        <div class="file-preview-info">
          <div class="file-preview-name" title="${escapeHtml(display)}">${escapeHtml(display)}</div>
          <div class="file-preview-size">${size}</div>
        </div>
        <button class="file-preview-remove" data-idx="${i}">移除</button>
      </div>`;
    }).join('');

    filePreviewList.querySelectorAll('.file-preview-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        selectedFiles = selectedFiles.filter((_, i) => i !== idx);
        renderFileList();
        if (selectedFiles.length === 0) {
          dropZone.style.display = '';
        }
      });
    });
  }

  // Start upload immediately after files are added (no edit form)
  async function startUpload() {
    if (selectedFiles.length === 0) return;

    uploadProgress.style.display = '';
    dropZone.style.display = 'none';

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const file = f.file;
        const formData = new FormData();
        formData.append('file', file);
        const itemName = f.relativePath ? f.relativePath : f.file.name;
        formData.append('name', itemName);
        if (f.relativePath) formData.append('relativePath', f.relativePath);

        const resp = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: '上传失败' }));
          throw new Error(err.error || `上传失败 HTTP ${resp.status}`);
        }

        const result = await resp.json();
        if (result.item) {
          uploadedItemId = result.item.id;
          cacheItem(result.item.id, result.item);
        }

        const pct = Math.round(((i + 1) / selectedFiles.length) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `上传中... ${pct}%`;
      }

      invalidateListCache(); // 列表已变化，下次访问首页重新拉取
      uploadProgress.style.display = 'none';
      uploadSuccess.style.display = '';
      successMsg.textContent = `成功上传 ${selectedFiles.length} 个文件`;
    } catch (e) {
      uploadProgress.style.display = 'none';
      dropZone.style.display = '';
      showToast(e.message || '上传失败', 'error');
    }
  }

  // Upload another
  uploadAnother.addEventListener('click', () => {
    uploadSuccess.style.display = 'none';
    dropZone.style.display = '';
    filePreviewList.style.display = '';
    selectedFiles = [];
  });

  // Preview uploaded item
  previewUploadBtn.addEventListener('click', () => {
    if (uploadedItemId) {
      location.href = '/preview?id=' + encodeURIComponent(uploadedItemId);
    }
  });

  checkAuth();
})();
