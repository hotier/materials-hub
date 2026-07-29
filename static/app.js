/* ========================================
   产出导航站 — 前端通用逻辑
   ======================================== */

(function () {
  'use strict';

  /* ======== 常量 ======== */
  const ALLOWED_EXTS = [
    'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'svg',
    'webp', 'bmp', 'ico', 'json', 'txt', 'md', 'csv', 'xml',
    'css', 'js', 'ts', 'yaml', 'yml', 'log', 'sql',
  ];

  const IMG_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico']);
  const CODE_EXTS = new Set(['json', 'xml', 'css', 'js', 'ts', 'yaml', 'yml', 'sql', 'csv']);

  /* ======== 工具函数 ======== */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  function showToast(msg, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getExt(filename) {
    const i = filename.lastIndexOf('.');
    return i > -1 ? filename.slice(i + 1).toLowerCase() : '';
  }

  function getPreviewType(ext) {
    if (ext === 'html' || ext === 'htm') return 'html';
    if (IMG_EXTS.has(ext)) return 'img';
    if (CODE_EXTS.has(ext)) return 'code';
    return 'text';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ======== 首页逻辑 ======== */
  function initIndexPage() {
    const cardGrid = $('#cardGrid');
    const loading = $('#loading');
    const emptyState = $('#emptyState');
    const searchInput = $('#searchInput');
    const tagFilter = $('#tagFilter');
    const materialCount = $('#materialCount');
    const logoutBtn = $('#logoutBtn');

    if (!cardGrid) return;

    let allMaterials = [];
    let activeTag = null;

    // ===== 登录逻辑（session cookie） =====
    async function tryAutoLogin() {
      try {
        const resp = await fetch('/api/auth-status');
        const data = await resp.json();
        if (!data.requireAuth) {
          initContent();
          return;
        }
        // 检查 cookie 是否有效
        const sessionResp = await fetch('/api/session');
        if (sessionResp.ok) {
          initContent();
          return;
        }
      } catch {
        // API 不可用，直接显示内容
        initContent();
        return;
      }

      // 未登录 → 重定向
      location.replace('/login.html?redirect=' + encodeURIComponent(location.pathname + location.search));
    }

    function initContent() {
      logoutBtn.style.display = '';
      loadMaterials();
    }

    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' }).catch(() => {});
      location.replace('/login.html');
    });

    // 启动登录检查
    tryAutoLogin();

    // ===== 数据加载 =====

    async function loadMaterials() {
      try {
        const resp = await fetch('/api/list');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        allMaterials = data.list || data || [];
        render();
      } catch (err) {
        console.error('加载产出失败:', err);
        showToast('加载产出列表失败', 'error');
        loading && (loading.style.display = 'none');
        emptyState && (emptyState.style.display = 'flex');
      }
    }

    function getTagsFromMaterials() {
      const set = new Set();
      allMaterials.forEach(m => (m.tags || []).forEach(t => set.add(t)));
      return [...set].sort();
    }

    function renderFilters() {
      if (!tagFilter) return;
      const tags = getTagsFromMaterials();
      tagFilter.innerHTML = tags.map(t =>
        `<span class="tag-chip${t === activeTag ? ' active' : ''}" data-tag="${t}">${t}</span>`
      ).join('');

      tagFilter.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          activeTag = activeTag === chip.dataset.tag ? null : chip.dataset.tag;
          renderFilters();
          renderCards();
        });
      });
    }

    /** 格式化日期显示（yyyy-mm-dd） */
    function formatDateLabel(dateStr) {
      return dateStr;
    }

    /** 生成一行产出列表 HTML */
    function buildRow(m) {
      const ext = (m.ext || '').toUpperCase();
      return `
        <tr class="list-row" data-id="${m.id}">
          <td class="list-col-name">
            <span class="list-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
            <span class="list-ext-badge">${escapeHtml(ext)}</span>
          </td>
          <td class="list-col-desc">${m.desc ? escapeHtml(m.desc) : '-'}</td>
          <td class="list-col-tags">${(m.tags || []).map(t =>
            `<span class="list-tag">${escapeHtml(t)}</span>`
          ).join('') || '-'}</td>
          <td class="list-col-actions">
            <button class="list-btn list-btn-delete" data-id="${m.id}" data-action="delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              删除
            </button>
          </td>
        </tr>`;
    }

    function renderCards() {
      const query = (searchInput?.value || '').toLowerCase().trim();

      let filtered = allMaterials;
      if (query) {
        filtered = filtered.filter(m =>
          m.name.toLowerCase().includes(query) ||
          (m.tags || []).some(t => t.toLowerCase().includes(query))
        );
      }
      if (activeTag) {
        filtered = filtered.filter(m => (m.tags || []).includes(activeTag));
      }

      loading && (loading.style.display = 'none');

      if (!filtered.length) {
        cardGrid.innerHTML = '';
        emptyState && (emptyState.style.display = 'flex');
        if (materialCount) materialCount.textContent = `0/${allMaterials.length}`;
        return;
      }

      emptyState && (emptyState.style.display = 'none');

      // 按日期分组
      const groups = {};
      filtered.forEach(m => {
        const date = m.createTime || '未分类';
        if (!groups[date]) groups[date] = [];
        groups[date].push(m);
      });

      // 日期降序排列
      const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

      cardGrid.innerHTML = sortedDates.map(date => {
        const items = groups[date];
        const label = formatDateLabel(date);
        return `
        <div class="folder">
          <button class="folder-header" aria-expanded="true">
            <svg class="folder-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            <svg class="folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span class="folder-title">${label}</span>
            <span class="folder-count">${items.length} 个产出</span>
          </button>
          <div class="folder-body">
            <table class="list-table">
              <thead>
                <tr>
                  <th class="list-col-name">名称</th>
                  <th class="list-col-desc">简介</th>
                  <th class="list-col-tags">标签</th>
                  <th class="list-col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(buildRow).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      }).join('');

      // 文件夹展开/折叠
      cardGrid.querySelectorAll('.folder-header').forEach(header => {
        header.addEventListener('click', () => {
          const expanded = header.getAttribute('aria-expanded') === 'true';
          header.setAttribute('aria-expanded', !expanded);
        });
      });

      // 行点击打开预览
      cardGrid.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', () => {
          window.open(`/preview.html?id=${row.dataset.id}`, '_blank');
        });
      });

      // 删除按钮（阻止冒泡到行）
      cardGrid.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = allMaterials.find(m => m.id === btn.dataset.id);
          if (item) showDeleteModal(item);
        });
      });

      if (materialCount) materialCount.textContent = `${filtered.length}/${allMaterials.length}`;
    }

    function render() {
      renderFilters();
      renderCards();
    }

    if (searchInput) {
      searchInput.addEventListener('input', renderCards);
    }

    /* 删除弹窗 */
    let pendingDeleteId = null;

    function showDeleteModal(item) {
      pendingDeleteId = item.id;
      $('#deleteItemName').textContent = item.name;
      $('#deleteModal').style.display = '';
    }

    $('#cancelDelete').addEventListener('click', () => {
      pendingDeleteId = null;
      $('#deleteModal').style.display = 'none';
    });

    $('#confirmDelete').addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      try {
        const resp = await fetch(`/api/item?id=${encodeURIComponent(pendingDeleteId)}`, {
          method: 'DELETE',
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        showToast('产出已删除', 'success');
        pendingDeleteId = null;
        $('#deleteModal').style.display = 'none';
        await loadMaterials();
      } catch (err) {
        console.error('删除失败:', err);
        showToast('删除失败: ' + err.message, 'error');
      }
    });
  }

  /* ======== 上传页逻辑 ======== */
  function initUploadPage() {
    const authSection = $('#authSection');
    const uploadSection = $('#uploadSection');
    const dropZone = $('#dropZone');
    const fileInput = $('#fileInput');
    const filePreviewList = $('#filePreviewList');
    const uploadForm = $('#uploadForm');
    const tagList = $('#tagList');
    const tagInput = $('#tagInput');
    const submitBtn = $('#submitUpload');
    const uploadProgress = $('#uploadProgress');
    const uploadSuccess = $('#uploadSuccess');
    const progressFill = $('#progressFill');
    const progressText = $('#progressText');

    if (!uploadSection) return;

    let selectedFile = null;
    let tags = [];
    let isAuth = false;

    /* Cookie 鉴权 */
    async function checkAuth() {
      try {
        const resp = await fetch('/api/auth-status');
        const data = await resp.json();
        if (!data.requireAuth) {
          isAuth = true;
          authSection.style.display = 'none';
          uploadSection.style.display = '';
          return;
        }
        // 检查 cookie 是否有效
        const sessionResp = await fetch('/api/session');
        if (sessionResp.ok) {
          isAuth = true;
          authSection.style.display = 'none';
          uploadSection.style.display = '';
          return;
        }
      } catch (e) { /* 继续 */ }
      // 未登录 → 跳转
      location.replace('/login.html?redirect=' + encodeURIComponent('/upload.html'));
    }
    checkAuth();

    /* 拖拽上传 */
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length) handleFile(files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
      const ext = getExt(file.name);
      if (!ALLOWED_EXTS.includes(ext)) {
        showToast(`不支持 .${ext} 格式，允许：${ALLOWED_EXTS.join(', ')}`, 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('文件大小不能超过 10MB', 'error');
        return;
      }
      selectedFile = file;

      filePreviewList.innerHTML = `
        <div class="file-preview-item">
          <div class="file-preview-icon">${ext.toUpperCase()}</div>
          <div class="file-preview-info">
            <div class="file-preview-name">${escapeHtml(file.name)}</div>
            <div class="file-preview-size">${formatSize(file.size)}</div>
          </div>
          <button class="file-preview-remove" id="removeFile">移除</button>
        </div>
      `;
      $('#removeFile').addEventListener('click', resetFile);
      uploadForm.style.display = '';

      // 自动从文件名提取名称（保留扩展名）
      const nameInput = $('#materialName');
      if (nameInput && !nameInput.value) {
        nameInput.value = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
      }

      updateSubmitBtn();
    }

    function resetFile() {
      selectedFile = null;
      filePreviewList.innerHTML = '';
      uploadForm.style.display = 'none';
      uploadProgress.style.display = 'none';
      uploadSuccess.style.display = 'none';
      $('#materialName').value = '';
      tags = [];
      renderTags();
      updateSubmitBtn();
    }

    /* 标签管理 */
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = tagInput.value.trim();
        if (val && !tags.includes(val)) {
          tags.push(val);
          renderTags();
        }
        tagInput.value = '';
      }
    });

    function renderTags() {
      tagList.innerHTML = tags.map(t =>
        `<span class="tag-badge">${escapeHtml(t)}<span class="tag-badge-remove" data-tag="${t}">×</span></span>`
      ).join('');
      tagList.querySelectorAll('.tag-badge-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          tags = tags.filter(t => t !== btn.dataset.tag);
          renderTags();
        });
      });
    }

    function updateSubmitBtn() {
      const name = $('#materialName').value.trim();
      submitBtn.disabled = !(selectedFile && name);
    }

    $('#materialName').addEventListener('input', updateSubmitBtn);

    /* 提交上传 */
    submitBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      const name = $('#materialName').value.trim();
      const desc = $('#materialDesc').value.trim();

      uploadForm.style.display = 'none';
      uploadProgress.style.display = '';
      progressFill.style.width = '50%';
      progressText.textContent = '正在上传产出...';

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', name);
      formData.append('desc', desc);
      formData.append('tags', tags.join(','));

      try {
        const resp = await fetch('/api/upload', { method: 'POST', body: formData });
        progressFill.style.width = '100%';
        progressText.textContent = '处理完成';

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: '上传失败' }));
          throw new Error(err.message || err.error || `HTTP ${resp.status}`);
        }

        const result = await resp.json();

        setTimeout(() => {
          uploadProgress.style.display = 'none';
          uploadSuccess.style.display = '';
          $('#successMsg').textContent = `产出 "${name}" 上传成功！`;
        }, 300);

      } catch (err) {
        console.error('上传失败:', err);
        uploadProgress.style.display = 'none';
        uploadForm.style.display = '';
        showToast(err.message, 'error');
      }
    });

    $('#cancelUpload').addEventListener('click', resetFile);
    $('#uploadAnother').addEventListener('click', () => {
      uploadSuccess.style.display = 'none';
      resetFile();
    });
  }

  /* ======== 预览页逻辑 ======== */
  function initPreviewPage() {
    const htmlView = $('#htmlView');
    const imgView = $('#imgView');
    const imgContent = $('#imgContent');
    const codeView = $('#codeView');
    const codeContent = $('#codeContent');
    const textView = $('#textView');
    const textContent = $('#textContent');
    const loading = $('#previewLoading');
    const errorDiv = $('#previewError');
    const errorMsg = $('#previewErrorMsg');
    const title = $('#previewTitle');
    const extBadge = $('#previewExtBadge');

    if (!htmlView) return;

    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    if (!id) {
      showPreviewError('缺少产出 ID');
      return;
    }

    let currentExt = '';

    function hideAllViews() {
      [htmlView, imgView, codeView, textView].forEach(v => v && (v.style.display = 'none'));
    }

    function showView(viewType) {
      hideAllViews();
      const map = { html: htmlView, img: imgView, code: codeView, text: textView };
      const el = map[viewType];
      if (el) el.style.display = '';
    }

    async function loadPreview() {
      try {
        // 1. 获取元数据
        const listResp = await fetch('/api/list');
        const listData = await listResp.json();
        const items = listData.list || listData || [];
        const item = items.find(m => m.id === id);

        if (!item) throw new Error('产出不存在');

        const ext = (item.ext || getExt(item.r2Key || '')).toLowerCase();
        currentExt = ext;
        const viewType = getPreviewType(ext);

        // 更新标题和标签
        if (title) title.textContent = item.name;
        if (extBadge) {
          extBadge.textContent = ext.toUpperCase();
          extBadge.style.display = '';
        }

        // 2. 获取文件内容
        const resp = await fetch(`/api/preview?id=${encodeURIComponent(id)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        if (viewType === 'html') {
          const html = await resp.text();
          if (!html.trim()) throw new Error('文件内容为空');
          htmlView.srcdoc = html;
          showView('html');
        } else if (viewType === 'img') {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          imgContent.src = url;
          showView('img');
        } else if (viewType === 'code') {
          const text = await resp.text();
          codeContent.textContent = text;
          codeContent.className = `language-${ext}`;
          showView('code');
        } else {
          // 纯文本
          const text = await resp.text();
          textContent.textContent = text;
          showView('text');
        }

        loading.style.display = 'none';

      } catch (err) {
        console.error('预览加载失败:', err);
        showPreviewError(err.message);
      }
    }

    function showPreviewError(msg) {
      hideAllViews();
      loading.style.display = 'none';
      errorDiv.style.display = '';
      errorMsg.textContent = msg || '无法加载该产出';
    }

    loadPreview();

    // 新窗口打开
    $('#btnNewWindow')?.addEventListener('click', async () => {
      try {
        const resp = await fetch(`/api/preview?id=${encodeURIComponent(id)}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err) {
        showToast('打开新窗口失败', 'error');
      }
    });

    // 下载
    $('#btnDownload')?.addEventListener('click', async (e) => {
      try {
        const resp = await fetch(`/api/preview?id=${encodeURIComponent(id)}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 从标题获取文件名
        const name = title?.textContent || 'material';
        a.download = `${name}.${currentExt}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        showToast('下载失败', 'error');
      }
    });
  }

  /* ======== 启动 ======== */
  if (document.body.classList.contains('preview-body')) {
    initPreviewPage();
  } else if ($('#uploadSection') || $('#authSection')) {
    initUploadPage();
  } else if ($('#cardGrid')) {
    initIndexPage();
  }
})();
