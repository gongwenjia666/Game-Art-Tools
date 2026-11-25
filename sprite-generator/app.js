// ============================================================
//  Video Sequence Image Extractor
// ============================================================

const state = {
    videoFile: null,
    videoUrl: null,
    videoElement: null,
    frames: [],
    isExtracting: false,
    cancelExtraction: false,
    extractionMode: 'fps',
    selectedFrames: new Set(),
    spriteSheet: null,
};

// ---- DOM references ----
const $ = (id) => document.getElementById(id);

const dom = {
    dropZone: $('drop-zone'),
    fileInput: $('file-input'),
    selectFileBtn: $('select-file-btn'),
    uploadSection: $('upload-section'),
    configSection: $('config-section'),
    videoPreview: $('video-preview'),
    infoFilename: $('info-filename'),
    infoDuration: $('info-duration'),
    infoResolution: $('info-resolution'),
    infoSize: $('info-size'),
    modeInput: $('mode-input'),
    modeInputLabel: $('mode-input-label'),
    modeInputHint: $('mode-input-hint'),
    qualityGroup: $('quality-group'),
    qualitySlider: $('quality-slider'),
    qualityValue: $('quality-value'),
    scaleSelect: $('scale-select'),
    estimateBox: $('estimate-box'),
    estimateCount: $('estimate-count'),
    estimateWarning: $('estimate-warning'),
    extractBtn: $('extract-btn'),
    changeVideoBtn: $('change-video-btn'),
    progressSection: $('progress-section'),
    progressBar: $('progress-bar'),
    progressText: $('progress-text'),
    progressPercent: $('progress-percent'),
    progressPreview: $('progress-preview'),
    progressPreviewImg: $('progress-preview-img'),
    progressFrameLabel: $('progress-frame-label'),
    cancelBtn: $('cancel-btn'),
    resultsSection: $('results-section'),
    resultsCount: $('results-count'),
    frameGallery: $('frame-gallery'),
    selectAllBtn: $('select-all-btn'),
    downloadSelectedBtn: $('download-selected-btn'),
    selectedCount: $('selected-count'),
    downloadAllBtn: $('download-all-btn'),
    spriteBtn: $('sprite-btn'),
    spriteSection: $('sprite-section'),
    spriteLayout: $('sprite-layout'),
    spriteColumnsGroup: $('sprite-columns-group'),
    spriteColumns: $('sprite-columns'),
    spritePadding: $('sprite-padding'),
    spriteSizeMode: $('sprite-size-mode'),
    spriteSizeGroup: $('sprite-size-group'),
    spriteWidth: $('sprite-width'),
    spriteHeight: $('sprite-height'),
    spriteBg: $('sprite-bg'),
    spriteFormat: $('sprite-format'),
    spriteQualityGroup: $('sprite-quality-group'),
    spriteQuality: $('sprite-quality'),
    spriteQualityValue: $('sprite-quality-value'),
    spriteUseSelected: $('sprite-use-selected'),
    spriteSelectedCount: $('sprite-selected-count'),
    spriteGridInfo: $('sprite-grid-info'),
    spriteFrameCount: $('sprite-frame-count'),
    spriteSizeInfo: $('sprite-size-info'),
    generateSpriteBtn: $('generate-sprite-btn'),
    spriteResult: $('sprite-result'),
    spritePreviewImg: $('sprite-preview-img'),
    spriteResultSize: $('sprite-result-size'),
    downloadSpriteBtn: $('download-sprite-btn'),
    resetBtn: $('reset-btn'),
    lightbox: $('lightbox'),
    lightboxImg: $('lightbox-img'),
    lightboxLabel: $('lightbox-label'),
    lightboxDownload: $('lightbox-download'),
    lightboxClose: $('lightbox-close'),
    toast: $('toast'),
};

const FORMAT_MAP = {
    png:   { mime: 'image/png',    ext: 'png',  needsQuality: false },
    jpeg:  { mime: 'image/jpeg',   ext: 'jpg',  needsQuality: true  },
    webp:  { mime: 'image/webp',   ext: 'webp', needsQuality: true  },
};

// ============================================================
//  Initialization
// ============================================================

function init() {
    setupUpload();
    setupSettings();
    setupActions();
    setupLightbox();
    setupSpriteSheet();
}

// ============================================================
//  Upload
// ============================================================

function setupUpload() {
    dom.selectFileBtn.addEventListener('click', () => dom.fileInput.click());
    dom.dropZone.addEventListener('click', (e) => {
        if (e.target !== dom.selectFileBtn) dom.fileInput.click();
    });

    dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dom.dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dom.dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.dropZone.classList.remove('drag-over');
        });
    });

    dom.dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
}

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'mpg', 'mpeg', 'wmv', 'ts', 'flv', '3gp', 'ogv'];

function isVideoFile(file) {
    if (file.type && file.type.startsWith('video/')) return true;
    // Some containers (e.g. .mov on Windows) report an empty or generic MIME type;
    // fall back to the file extension.
    const ext = file.name.toLowerCase().split('.').pop();
    return VIDEO_EXTENSIONS.includes(ext);
}

function handleFile(file) {
    if (isVideoFile(file)) {
        handleVideoFile(file);
    } else {
        showToast('仅支持视频文件', 'error');
    }
}

function handleVideoFile(file) {
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.frames.forEach(f => { if (f.url) URL.revokeObjectURL(f.url); });
    state.frames = [];
    state.selectedFrames.clear();
    if (state.spriteSheet && state.spriteSheet.url) URL.revokeObjectURL(state.spriteSheet.url);
    state.spriteSheet = null;

    state.videoFile = file;
    state.videoUrl = URL.createObjectURL(file);

    loadVideo();
}

function cleanupVideoState() {
    state.frames.forEach(f => { if (f.url) URL.revokeObjectURL(f.url); });
    state.frames = [];
    state.selectedFrames.clear();
    if (state.spriteSheet && state.spriteSheet.url) URL.revokeObjectURL(state.spriteSheet.url);
    state.spriteSheet = null;
    state.videoFile = null;
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = null;
    if (state.videoElement) {
        state.videoElement.pause();
        state.videoElement.removeAttribute('src');
        state.videoElement.load();
        state.videoElement = null;
    }
}

function loadVideo() {
    const video = dom.videoPreview;
    video.src = state.videoUrl;
    video.muted = true;

    video.addEventListener('loadedmetadata', onVideoLoaded, { once: true });
    video.addEventListener('error', onVideoError, { once: true });

    function onVideoLoaded() {
        dom.infoFilename.textContent = state.videoFile.name;
        dom.infoDuration.textContent = formatTime(video.duration);
        dom.infoResolution.textContent = `${video.videoWidth} x ${video.videoHeight}`;
        dom.infoSize.textContent = formatFileSize(state.videoFile.size);

        state.videoElement = video;

        dom.uploadSection.classList.add('hidden');
        dom.configSection.classList.remove('hidden');

        updateEstimate();
    }

    function onVideoError() {
        const code = video.error ? video.error.code : 0;
        if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE) {
            showToast('视频容器已识别，但当前浏览器不支持其编码格式（如 HEVC/ProRES 的 MOV），请转为 H.264 编码的 MP4/WebM 后重试', 'error');
        } else {
            showToast('视频加载失败，可能是不支持的格式或损坏的文件', 'error');
        }
    }
}

// ============================================================
//  Settings
// ============================================================

function setupSettings() {
    // Mode tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.extractionMode = tab.dataset.mode;
            updateModeInput();
            updateEstimate();
        });
    });

    dom.modeInput.addEventListener('input', updateEstimate);

    // Format radio
    document.querySelectorAll('input[name="format"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const fmt = FORMAT_MAP[radio.value];
            dom.qualityGroup.classList.toggle('hidden', !fmt.needsQuality);
        });
    });

    dom.qualitySlider.addEventListener('input', () => {
        dom.qualityValue.textContent = dom.qualitySlider.value;
    });
}

function updateModeInput() {
    const mode = state.extractionMode;
    const configs = {
        fps:      { label: '提取帧率 (FPS)',  value: 2,   min: 0.1, step: 0.1, hint: '每秒提取的帧数，例如 2 表示每秒 2 帧' },
        count:    { label: '总帧数',           value: 20,  min: 1,   step: 1,   hint: '从视频中均匀提取指定数量的帧' },
        interval: { label: '时间间隔 (秒)',    value: 5,   min: 0.1, step: 0.1, hint: '每隔 N 秒提取一帧' },
    };
    const cfg = configs[mode];
    dom.modeInputLabel.textContent = cfg.label;
    dom.modeInput.value = cfg.value;
    dom.modeInput.min = cfg.min;
    dom.modeInput.step = cfg.step;
    dom.modeInputHint.textContent = cfg.hint;
}

function updateEstimate() {
    if (!state.videoElement) return;

    const duration = state.videoElement.duration;
    if (!duration || isNaN(duration)) return;

    const val = parseFloat(dom.modeInput.value);
    if (!val || val <= 0) {
        dom.estimateCount.textContent = 0;
        return;
    }

    let count = 0;
    if (state.extractionMode === 'fps') {
        count = Math.floor(duration * val);
    } else if (state.extractionMode === 'count') {
        count = Math.floor(val);
    } else if (state.extractionMode === 'interval') {
        count = Math.floor(duration / val);
    }

    count = Math.max(0, Math.min(count, 2000)); // cap at 2000

    dom.estimateCount.textContent = count;
    dom.estimateWarning.classList.toggle('hidden', count <= 200);
}

// ============================================================
//  Frame Extraction
// ============================================================

function setupActions() {
    dom.extractBtn.addEventListener('click', startExtraction);
    dom.changeVideoBtn.addEventListener('click', reset);
    dom.cancelBtn.addEventListener('click', () => { state.cancelExtraction = true; });
    dom.resetBtn.addEventListener('click', reset);
    dom.downloadAllBtn.addEventListener('click', downloadAllZip);
    dom.downloadSelectedBtn.addEventListener('click', downloadSelectedZip);
    dom.selectAllBtn.addEventListener('click', toggleSelectAll);
}

function getSettings() {
    const formatVal = document.querySelector('input[name="format"]:checked').value;
    const fmt = FORMAT_MAP[formatVal];
    const scale = parseFloat(dom.scaleSelect.value);
    const quality = parseInt(dom.qualitySlider.value) / 100;
    const modeValue = parseFloat(dom.modeInput.value);

    return {
        mode: state.extractionMode,
        modeValue,
        mimeType: fmt.mime,
        extension: fmt.ext,
        quality: fmt.needsQuality ? quality : undefined,
        scale,
    };
}

function computeTimestamps(duration, settings) {
    const ts = [];
    if (settings.mode === 'fps') {
        const interval = 1 / settings.modeValue;
        const count = Math.min(Math.floor(duration * settings.modeValue), 2000);
        for (let i = 0; i < count; i++) ts.push(i * interval);
    } else if (settings.mode === 'count') {
        const count = Math.min(Math.floor(settings.modeValue), 2000);
        const interval = duration / count;
        for (let i = 0; i < count; i++) ts.push(i * interval);
    } else if (settings.mode === 'interval') {
        let t = 0;
        while (t < duration && ts.length < 2000) {
            ts.push(t);
            t += settings.modeValue;
        }
    }
    return ts;
}

async function startExtraction() {
    const settings = getSettings();
    const duration = state.videoElement.duration;

    if (!duration || isNaN(duration)) {
        showToast('视频时长未知，无法提取', 'error');
        return;
    }

    const timestamps = computeTimestamps(duration, settings);
    if (timestamps.length === 0) {
        showToast('提取参数无效，请检查设置', 'error');
        return;
    }

    if (timestamps.length > 500 && !confirm(`即将提取 ${timestamps.length} 帧图片，可能需要较长时间。是否继续？`)) {
        return;
    }

    // Clean up previous frames
    state.frames.forEach(f => { if (f.url) URL.revokeObjectURL(f.url); });
    state.frames = [];
    state.selectedFrames.clear();
    state.cancelExtraction = false;
    state.isExtracting = true;

    // Hide config, show progress
    dom.configSection.classList.add('hidden');
    dom.progressSection.classList.remove('hidden');
    dom.progressBar.style.width = '0%';
    dom.progressText.textContent = `0 / ${timestamps.length}`;
    dom.progressPercent.textContent = '0%';
    dom.progressPreview.classList.remove('active');

    // Prepare video
    const video = state.videoElement;
    video.pause();
    video.muted = true;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * settings.scale);
    canvas.height = Math.round(video.videoHeight * settings.scale);
    const ctx = canvas.getContext('2d');

    // Extract frames
    for (let i = 0; i < timestamps.length; i++) {
        if (state.cancelExtraction) break;

        // Seek
        await seekToTime(video, Math.min(timestamps[i], duration - 0.01));

        // Wait for paint
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 30));

        // Draw
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // To blob
        const blob = await canvasToBlob(canvas, settings.mimeType, settings.quality);

        const url = URL.createObjectURL(blob);

        state.frames.push({
            index: i,
            timestamp: timestamps[i],
            blob,
            url,
            extension: settings.extension,
        });

        // Update progress
        const pct = Math.round(((i + 1) / timestamps.length) * 100);
        dom.progressBar.style.width = pct + '%';
        dom.progressText.textContent = `${i + 1} / ${timestamps.length}`;
        dom.progressPercent.textContent = pct + '%';

        // Update preview
        dom.progressPreviewImg.src = url;
        dom.progressFrameLabel.textContent = `第 ${i + 1} 帧 · ${formatTime(timestamps[i])}`;
        dom.progressPreview.classList.add('active');
    }

    state.isExtracting = false;

    if (state.cancelExtraction && state.frames.length === 0) {
        dom.progressSection.classList.add('hidden');
        dom.configSection.classList.remove('hidden');
        showToast('已取消提取', 'error');
        return;
    }

    // Show results
    dom.progressSection.classList.add('hidden');
    dom.resultsSection.classList.remove('hidden');
    dom.resultsCount.textContent = state.frames.length;
    renderGallery();
    updateSpriteEstimate();
    showToast(`成功提取 ${state.frames.length} 帧图片`, 'success');
}

function seekToTime(video, time) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                video.removeEventListener('seeked', onSeeked);
                resolve(); // resolve anyway to continue
            }
        }, 3000);

        const onSeeked = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);
            resolve();
        };

        video.addEventListener('seeked', onSeeked);
        try {
            video.currentTime = time;
        } catch (e) {
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);
            resolve();
        }
    });
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, mimeType, quality);
    });
}

// ============================================================
//  Sprite Sheet (精灵序列图)
// ============================================================

function setupSpriteSheet() {
    dom.spriteBtn.addEventListener('click', () => {
        dom.spriteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        dom.spriteSection.classList.add('flash-highlight');
        setTimeout(() => dom.spriteSection.classList.remove('flash-highlight'), 1200);
    });

    dom.spriteLayout.addEventListener('change', () => {
        const showCols = dom.spriteLayout.value === 'custom';
        dom.spriteColumnsGroup.classList.toggle('hidden', !showCols);
        updateSpriteEstimate();
    });

    dom.spriteColumns.addEventListener('input', updateSpriteEstimate);
    dom.spritePadding.addEventListener('input', updateSpriteEstimate);

    // Power-of-2 output size options: 32 ~ 8192
    const POW2_SIZES = [];
    for (let p = 5; p <= 13; p++) POW2_SIZES.push(2 ** p);
    POW2_SIZES.forEach(v => {
        dom.spriteWidth.add(new Option(v, v));
        dom.spriteHeight.add(new Option(v, v));
    });
    dom.spriteWidth.value = '512';
    dom.spriteHeight.value = '512';

    dom.spriteSizeMode.addEventListener('change', () => {
        dom.spriteSizeGroup.classList.toggle('hidden', dom.spriteSizeMode.value !== 'custom');
        updateSpriteEstimate();
    });
    dom.spriteWidth.addEventListener('change', updateSpriteEstimate);
    dom.spriteHeight.addEventListener('change', updateSpriteEstimate);

    dom.spriteFormat.addEventListener('change', () => {
        const fmt = FORMAT_MAP[dom.spriteFormat.value];
        dom.spriteQualityGroup.classList.toggle('hidden', !fmt.needsQuality);
    });

    dom.spriteQuality.addEventListener('input', () => {
        dom.spriteQualityValue.textContent = dom.spriteQuality.value;
    });

    dom.spriteUseSelected.addEventListener('change', updateSpriteEstimate);

    dom.generateSpriteBtn.addEventListener('click', generateSpriteSheet);
    dom.downloadSpriteBtn.addEventListener('click', downloadSpriteSheet);
}

function getSpriteFrameIndices() {
    if (dom.spriteUseSelected.checked && state.selectedFrames.size > 0) {
        return [...state.selectedFrames].sort((a, b) => a - b);
    }
    return state.frames.map((_, i) => i);
}

function getSpriteOutputSize() {
    if (dom.spriteSizeMode.value !== 'custom') return null;
    return {
        width: parseInt(dom.spriteWidth.value) || 512,
        height: parseInt(dom.spriteHeight.value) || 512,
    };
}

function computeSpriteGrid(count, layout, customColumns) {
    let columns, rows;
    if (count === 0) return { columns: 0, rows: 0 };
    if (layout === 'horizontal') {
        columns = count;
        rows = 1;
    } else if (layout === 'vertical') {
        columns = 1;
        rows = count;
    } else if (layout === 'custom') {
        columns = Math.min(Math.max(1, customColumns), count);
        rows = Math.ceil(count / columns);
    } else {
        // auto grid: prefer a roughly square layout
        columns = Math.ceil(Math.sqrt(count));
        rows = Math.ceil(count / columns);
    }
    return { columns, rows };
}

function updateSpriteEstimate() {
    if (!state.frames.length) return;

    const indices = getSpriteFrameIndices();
    const count = indices.length;
    dom.spriteFrameCount.textContent = count;
    dom.spriteSelectedCount.textContent = count;

    if (count === 0) {
        dom.spriteGridInfo.textContent = '-';
        dom.spriteSizeInfo.textContent = '-';
        return;
    }

    const layout = dom.spriteLayout.value;
    const customCols = parseInt(dom.spriteColumns.value) || 4;
    const padding = parseInt(dom.spritePadding.value) || 0;
    const { columns, rows } = computeSpriteGrid(count, layout, customCols);
    dom.spriteGridInfo.textContent = `${columns} × ${rows}`;

    // Custom power-of-2 output size overrides the estimate
    const customSize = getSpriteOutputSize();
    if (customSize) {
        dom.spriteSizeInfo.textContent = `${customSize.width} × ${customSize.height} px`;
        return;
    }

    // Estimate dimensions using first frame's intrinsic size
    const first = state.frames[indices[0]];
    if (first && first.url) {
        const img = new Image();
        img.onload = () => {
            const w = columns * img.width + (columns + 1) * padding;
            const h = rows * img.height + (rows + 1) * padding;
            dom.spriteSizeInfo.textContent = `${w} × ${h} px`;
        };
        img.onerror = () => { dom.spriteSizeInfo.textContent = '-'; };
        img.src = first.url;
    }
}

async function generateSpriteSheet() {
    const indices = getSpriteFrameIndices();
    if (indices.length === 0) {
        showToast('没有可用的帧，请先提取或勾选帧', 'error');
        return;
    }

    const layout = dom.spriteLayout.value;
    const customCols = parseInt(dom.spriteColumns.value) || 4;
    const padding = parseInt(dom.spritePadding.value) || 0;
    const bgColor = dom.spriteBg.value;
    const fmt = FORMAT_MAP[dom.spriteFormat.value];
    const quality = parseInt(dom.spriteQuality.value) / 100;

    const { columns, rows } = computeSpriteGrid(indices.length, layout, customCols);
    const customSize = getSpriteOutputSize();

    dom.generateSpriteBtn.disabled = true;
    dom.generateSpriteBtn.textContent = '生成中...';

    try {
        // Load frame images
        const images = await Promise.all(
            indices.map(idx => loadImage(state.frames[idx].url))
        );

        const frameW = images[0].width;
        const frameH = images[0].height;
        let totalW, totalH;
        if (customSize) {
            // Fixed power-of-2 canvas
            totalW = customSize.width;
            totalH = customSize.height;
        } else {
            totalW = columns * frameW + (columns + 1) * padding;
            totalH = rows * frameH + (rows + 1) * padding;
        }

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');

        // Background
        if (bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, totalW, totalH);
        }

        // Draw frames
        images.forEach((img, i) => {
            const col = i % columns;
            const row = Math.floor(i / columns);
            if (customSize) {
                // Evenly divided cells; contain-fit each frame into cell (padding inset), centered
                const cellW = Math.floor(totalW / columns);
                const cellH = Math.floor(totalH / rows);
                const availW = Math.max(1, cellW - padding * 2);
                const availH = Math.max(1, cellH - padding * 2);
                const scale = Math.min(availW / img.width, availH / img.height);
                const dw = img.width * scale;
                const dh = img.height * scale;
                const x = col * cellW + (cellW - dw) / 2;
                const y = row * cellH + (cellH - dh) / 2;
                ctx.drawImage(img, x, y, dw, dh);
            } else {
                const x = col * (frameW + padding) + padding;
                const y = row * (frameH + padding) + padding;
                ctx.drawImage(img, x, y);
            }
        });

        // To blob
        const blob = await canvasToBlob(canvas, fmt.mime, fmt.needsQuality ? quality : undefined);

        // Clean up previous sprite
        if (state.spriteSheet && state.spriteSheet.url) {
            URL.revokeObjectURL(state.spriteSheet.url);
        }

        state.spriteSheet = {
            blob,
            url: URL.createObjectURL(blob),
            ext: fmt.ext,
            width: totalW,
            height: totalH,
            columns,
            rows,
        };

        // Show result
        dom.spritePreviewImg.src = state.spriteSheet.url;
        dom.spriteResultSize.textContent =
            `${columns} × ${rows} 网格 · ${totalW} × ${totalH} px · ${formatFileSize(blob.size)}`;
        dom.spriteResult.classList.remove('hidden');
        dom.spriteResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('精灵序列图生成成功', 'success');
    } catch (e) {
        showToast('生成失败: ' + e.message, 'error');
    } finally {
        dom.generateSpriteBtn.disabled = false;
        dom.generateSpriteBtn.textContent = '生成精灵序列图';;
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = url;
    });
}

function downloadSpriteSheet() {
    if (!state.spriteSheet) {
        showToast('请先生成精灵图', 'error');
        return;
    }
    const baseName = state.videoFile
        ? state.videoFile.name.replace(/\.[^.]+$/, '')
        : 'video';
    const ss = state.spriteSheet;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(ss.blob);
    a.download = `${baseName}_sprite_${ss.columns}x${ss.rows}.${ss.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('精灵图下载已开始', 'success');
}

// ============================================================
//  Gallery
// ============================================================

function renderGallery() {
    dom.frameGallery.innerHTML = '';

    state.frames.forEach((frame, idx) => {
        const card = document.createElement('div');
        card.className = 'frame-card';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'frame-checkbox';
        checkbox.dataset.index = idx;
        checkbox.checked = state.selectedFrames.has(idx);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) state.selectedFrames.add(idx);
            else state.selectedFrames.delete(idx);
            updateSelectedCount();
        });

        const img = document.createElement('img');
        img.className = 'frame-thumbnail';
        img.src = frame.url;
        img.alt = `Frame ${idx + 1}`;
        img.loading = 'lazy';
        img.addEventListener('click', () => openLightbox(frame, idx));

        const dlBtn = document.createElement('button');
        dlBtn.className = 'frame-download-btn';
        dlBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        dlBtn.title = '下载此帧';
        dlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadFrame(frame);
        });

        const info = document.createElement('div');
        info.className = 'frame-info';
        info.innerHTML = `
            <span class="frame-number">#${String(idx + 1).padStart(3, '0')}</span>
            <span class="frame-timestamp">${formatTime(frame.timestamp)}</span>
        `;

        card.appendChild(checkbox);
        card.appendChild(img);
        card.appendChild(dlBtn);
        card.appendChild(info);
        dom.frameGallery.appendChild(card);
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    dom.selectedCount.textContent = state.selectedFrames.size;
    updateSpriteEstimate();
}

function toggleSelectAll() {
    const allSelected = state.selectedFrames.size === state.frames.length;
    if (allSelected) {
        state.selectedFrames.clear();
    } else {
        state.frames.forEach((_, idx) => state.selectedFrames.add(idx));
    }
    document.querySelectorAll('.frame-checkbox').forEach(cb => {
        cb.checked = state.selectedFrames.has(parseInt(cb.dataset.index));
    });
    updateSelectedCount();
}

// ============================================================
//  Download
// ============================================================

function downloadFrame(frame) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(frame.blob);
    a.download = makeFrameFilename(frame);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function makeFrameFilename(frame) {
    const baseName = state.videoFile
        ? state.videoFile.name.replace(/\.[^.]+$/, '')
        : 'video';
    const ts = formatTimestampForFile(frame.timestamp);
    return `${baseName}_frame_${String(frame.index + 1).padStart(4, '0')}_${ts}.${frame.extension}`;
}

async function downloadAllZip() {
    if (state.frames.length === 0) return;

    if (typeof JSZip === 'undefined') {
        showToast('JSZip 库未加载，无法打包下载', 'error');
        return;
    }

    dom.downloadAllBtn.disabled = true;
    dom.downloadAllBtn.textContent = '打包中...';

    try {
        const zip = new JSZip();
        const baseName = state.videoFile
            ? state.videoFile.name.replace(/\.[^.]+$/, '')
            : 'video';
        const folder = zip.folder(`${baseName}_frames`);

        state.frames.forEach(frame => {
            folder.file(makeFrameFilename(frame), frame.blob);
        });

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_frames.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast('ZIP 下载已开始', 'success');
    } catch (e) {
        showToast('打包失败: ' + e.message, 'error');
    } finally {
        dom.downloadAllBtn.disabled = false;
        dom.downloadAllBtn.textContent = '全部下载 (ZIP)';
    }
}

async function downloadSelectedZip() {
    if (state.selectedFrames.size === 0) {
        showToast('请先选择要下载的帧', 'error');
        return;
    }

    if (typeof JSZip === 'undefined') {
        showToast('JSZip 库未加载，无法打包下载', 'error');
        return;
    }

    dom.downloadSelectedBtn.disabled = true;
    dom.downloadSelectedBtn.textContent = '打包中...';

    try {
        const zip = new JSZip();
        const baseName = state.videoFile
            ? state.videoFile.name.replace(/\.[^.]+$/, '')
            : 'video';
        const folder = zip.folder(`${baseName}_frames_selected`);

        state.frames.forEach((frame, idx) => {
            if (state.selectedFrames.has(idx)) {
                folder.file(makeFrameFilename(frame), frame.blob);
            }
        });

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_frames_selected.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast(`已下载 ${state.selectedFrames.size} 帧`, 'success');
    } catch (e) {
        showToast('打包失败: ' + e.message, 'error');
    } finally {
        dom.downloadSelectedBtn.disabled = false;
        dom.downloadSelectedBtn.innerHTML = '下载选中 (<span id="selected-count">0</span>)';
        dom.selectedCount = $('selected-count');
        dom.selectedCount.textContent = state.selectedFrames.size;
    }
}

// ============================================================
//  Lightbox
// ============================================================

let lightboxFrame = null;

function setupLightbox() {
    dom.lightboxClose.addEventListener('click', closeLightbox);
    document.querySelector('.lightbox-overlay').addEventListener('click', closeLightbox);
    dom.lightboxDownload.addEventListener('click', () => {
        if (lightboxFrame) downloadFrame(lightboxFrame);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dom.lightbox.classList.contains('hidden')) {
            closeLightbox();
        }
    });
}

function openLightbox(frame, idx) {
    lightboxFrame = frame;
    dom.lightboxImg.src = frame.url;
    dom.lightboxLabel.textContent = `第 ${idx + 1} 帧 · ${formatTime(frame.timestamp)}`;
    dom.lightbox.classList.remove('hidden');
}

function closeLightbox() {
    dom.lightbox.classList.add('hidden');
    lightboxFrame = null;
}

// ============================================================
//  Reset
// ============================================================

function reset() {
    cleanupVideoState();

    dom.fileInput.value = '';
    dom.configSection.classList.add('hidden');
    dom.progressSection.classList.add('hidden');
    dom.resultsSection.classList.add('hidden');
    dom.uploadSection.classList.remove('hidden');
    dom.frameGallery.innerHTML = '';
    dom.spriteResult.classList.add('hidden');
    dom.spritePreviewImg.src = '';
    dom.spriteGridInfo.textContent = '-';
    dom.spriteFrameCount.textContent = '-';
    dom.spriteSizeInfo.textContent = '-';
    dom.spriteSelectedCount.textContent = '0';
}

// ============================================================
//  Utilities
// ============================================================

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '--';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}m${String(s).padStart(4, '0')}s`;
}

function formatTimestampForFile(seconds) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}m${String(s).padStart(4, '0')}s`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

let toastTimer = null;
function showToast(message, type = '') {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.className = 'toast show';
    if (type) dom.toast.classList.add('toast-' + type);
    toastTimer = setTimeout(() => {
        dom.toast.classList.remove('show');
    }, 3500);
}

// ---- Start ----
init();
