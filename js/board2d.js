/* ══ 2D GEOMETRİ TAHTASI İŞLEMLERİ VE SVG ÇİZİMLERİ ════════════════════ */

// App2 için: çap (iki parça) + O hizasında nokta
function renderApp2DiameterOverlay(svg) {
    const ns = 'http://www.w3.org/2000/svg';

    // Daha önce eklendiyse temizle
    const old = svg.getElementById('app2DiameterOverlay');
    if (old) old.remove();

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('id', 'app2DiameterOverlay');

    // Merkez (GRID 6x6 için merkez pin koordinatı: (2,2))
    const cx = pinX(2);
    const cy = pinY(2);

    // Çap uçları (soldaki ve sağdaki pinler): (2,0) ve (2,5)
    const xL = pinX(0), xR = pinX(5);

    // Renk (yeşil çap rengi)
    const stroke = '#22c55e';

    // SOL parça: okla gösterilen kesikli bölüm -> DÜZ çizgi
    const left = document.createElementNS(ns, 'line');
    left.setAttribute('x1', xL);
    left.setAttribute('y1', cy);
    left.setAttribute('x2', cx);
    left.setAttribute('y2', cy);
    left.setAttribute('stroke', stroke);
    left.setAttribute('stroke-width', '2.5');
    left.setAttribute('opacity', '0.95');
    // left: dasharray YOK => düz

    // SAĞ parça: diğer taraf kesikli kalsın
    const right = document.createElementNS(ns, 'line');
    right.setAttribute('x1', cx);
    right.setAttribute('y1', cy);
    right.setAttribute('x2', xR);
    right.setAttribute('y2', cy);
    right.setAttribute('stroke', stroke);
    right.setAttribute('stroke-width', '2.5');
    right.setAttribute('opacity', '0.95');
    right.setAttribute('stroke-dasharray', '10,8');

    // “O” hizasında çap üzerinde nokta (temaya uygun)
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.setAttribute('r', '4.2');
    dot.setAttribute('fill', currentTheme === 'dark' ? '#93c5fd' : '#1d4ed8');
    dot.setAttribute('stroke', 'rgba(255,255,255,0.25)');
    dot.setAttribute('stroke-width', '1');

    g.appendChild(left);
    g.appendChild(right);
    g.appendChild(dot);

    // Üste gelsin diye sona ekliyoruz
    svg.appendChild(g);
}

/* SVG oluştur */
function buildBoardSVG() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'boardSVG');
    svg.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);
    svg.setAttribute('width', BOARD_W);
    svg.setAttribute('height', BOARD_H);
    svg.style.cssText = `max-width:100%;max-height:100%;display:block;transform:scale(${boardZoom});transform-origin:center;transition:transform .2s;`;

    // Arka plan
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
    bg.setAttribute('width', BOARD_W); bg.setAttribute('height', BOARD_H);
    bg.setAttribute('rx', '16');
    const bgColor = currentTheme === 'dark' ? '#1a3a6b' : '#2563eb';
    bg.setAttribute('fill', bgColor);
    svg.appendChild(bg);

    // Grid çizgileri
    for (let i = 0; i < GRID_N; i++) {
        for (let j = 0; j < GRID_N; j++) {
            if (i < GRID_N - 1) {
                const l = document.createElementNS(ns, 'line');
                l.setAttribute('x1', pinX(j)); l.setAttribute('y1', pinY(i));
                l.setAttribute('x2', pinX(j)); l.setAttribute('y2', pinY(i + 1));
                l.setAttribute('stroke', 'rgba(255,255,255,0.10)');
                l.setAttribute('stroke-width', '1');
                svg.appendChild(l);
            }
            if (j < GRID_N - 1) {
                const l = document.createElementNS(ns, 'line');
                l.setAttribute('x1', pinX(j)); l.setAttribute('y1', pinY(i));
                l.setAttribute('x2', pinX(j + 1)); l.setAttribute('y2', pinY(i));
                l.setAttribute('stroke', 'rgba(255,255,255,0.10)');
                l.setAttribute('stroke-width', '1');
                svg.appendChild(l);
            }
        }
    }

    // Elastikler (sadece tamamlanmış lastikler — pinlerin altında)
    const elasticGroup = document.createElementNS(ns, 'g');
    elasticGroup.setAttribute('id', 'elasticGroup');
    svg.appendChild(elasticGroup);
    if (typeof renderElastics === 'function') {
        renderElastics(elasticGroup, false); // false = preview çizme
    }

    // Angle measure lines
    const angleLinesGroup = document.createElementNS(ns, 'g');
    angleLinesGroup.setAttribute('id', 'angleLinesGroup');
    svg.appendChild(angleLinesGroup);

    // Pinler
    for (let r = 0; r < GRID_N; r++) {
        for (let c = 0; c < GRID_N; c++) {
            const circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('id', pinId(r, c));
            circle.setAttribute('cx', pinX(c));
            circle.setAttribute('cy', pinY(r));
            circle.setAttribute('r', PIN_R);
            circle.setAttribute('data-r', r);
            circle.setAttribute('data-c', c);
            circle.setAttribute('class', 'pin-dot');
            const pinColor = currentTheme === 'dark' ? '#4a9fd4' : '#93c5fd';
            circle.setAttribute('fill', pinColor);
            circle.setAttribute('stroke', 'rgba(255,255,255,0.3)');
            circle.setAttribute('stroke-width', '1');
            svg.appendChild(circle);
        }
    }

    // Seçili pinleri vurgula
    selectedPins.forEach(({ r, c }) => {
        const el = svg.getElementById(pinId(r, c));
        if (el) { el.setAttribute('fill', '#ffd700'); el.setAttribute('r', PIN_R_SEL); }
    });
    anglePoints.forEach(({ r, c }) => {
        const el = svg.getElementById(pinId(r, c));
        if (el) { el.setAttribute('fill', '#f97316'); el.setAttribute('r', PIN_R_SEL); }
    });

    // Preview (kesikli çizgi) — pinlerin ÜSTÜNDE görünmesi için en sona eklenir
    const previewGroup = document.createElementNS(ns, 'g');
    previewGroup.setAttribute('id', 'previewGroup');
    svg.appendChild(previewGroup);
    renderPreview(previewGroup);

    // App2 overlay: çap + nokta
    renderApp2DiameterOverlay(svg);

    return svg;
}

function renderGuideElastic(svgEl, pins, color) {
    const ns = 'http://www.w3.org/2000/svg';
    const old = svgEl.getElementById('guideElasticGroup');
    if (old) old.parentNode.removeChild(old);
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('id', 'guideElasticGroup');
    if (pins && pins.length >= 2) {
        const allPins = [...pins, pins[0]]; // kapat
        const pts = allPins.map(p => `${pinX(p.c)},${pinY(p.r)}`).join(' ');
        const poly = document.createElementNS(ns, 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('stroke', color || '#ffd700');
        poly.setAttribute('stroke-width', '3');
        poly.setAttribute('stroke-dasharray', '10,6');
        poly.setAttribute('stroke-linecap', 'round');
        poly.setAttribute('fill', 'none');
        poly.setAttribute('opacity', '0.7');
        g.appendChild(poly);
        // Köşe pinlerini vurgula
        pins.forEach(p => {
            const c = document.createElementNS(ns, 'circle');
            c.setAttribute('cx', pinX(p.c));
            c.setAttribute('cy', pinY(p.r));
            c.setAttribute('r', '10');
            c.setAttribute('fill', 'none');
            c.setAttribute('stroke', color || '#ffd700');
            c.setAttribute('stroke-width', '2.5');
            c.setAttribute('opacity', '0.85');
            g.appendChild(c);
        });
    }
    svgEl.appendChild(g);
}

function renderPreview(group) {
    while (group.firstChild) group.removeChild(group.firstChild);
    const ns = 'http://www.w3.org/2000/svg';
    // Preview: seçili pinler — pinlerin ÜSTÜNDE gösterilir
    if (selectedPins.length > 0) {
        const pts = selectedPins.map(p => `${pinX(p.c)},${pinY(p.r)}`).join(' ');
        const preview = document.createElementNS(ns, 'polyline');
        preview.setAttribute('points', pts);
        preview.setAttribute('stroke', currentElasticColor);
        preview.setAttribute('stroke-width', '3');
        preview.setAttribute('stroke-dasharray', '6,4');
        preview.setAttribute('stroke-linecap', 'round');
        preview.setAttribute('fill', 'none');
        preview.setAttribute('opacity', '0.85');
        group.appendChild(preview);
    }
}

function rebuildBoard() {
    if (frontGroup) updateElastics3D();
    if (typeof window._app2RebuildHook === 'function') window._app2RebuildHook();
}

function bindPinEvents() {
    $('#boardSVG .pin-dot').off('click').on('click', function () {
        const r = parseInt($(this).attr('data-r'));
        const c = parseInt($(this).attr('data-c'));
        handlePinClick(r, c);
    });
}

function handlePinClick(r, c) {
    // Kilitli pinler seçilemesin (app2 büyük kare)
    if (window.app2LockedPins && window.app2LockedPins.some(p => p.r === r && p.c === c)) return;

    if (boardMode === 'angle') {
        handleAnglePinClick(r, c);
        return;
    }
    if (boardMode === 'measure') {
        handleMeasurePinClick(r, c);
        return;
    }
    // Draw mode
    // Limit kontrolü: seçili rengin limiti dolmuşsa yeni pin seçimine izin verme
    if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE && selectedPins.length === 0) {
        const colorName = ELASTIC_COLORS.find(c => c.hex === currentElasticColor)?.name;
        showLimitToast(colorName);
        return; // Yeni lastik başlatma
    }
    const idx = selectedPins.findIndex(p => p.r === r && p.c === c);
    if (idx >= 0) {
        if (idx === 1 && selectedPins.length === 2) {
            addElasticFromSelected(false); // commit as open line segment
            return;
        }
        // Pin zaten seçili → elastiği kapat
        if (idx === 0 && selectedPins.length >= 3) {
            if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) { selectedPins = []; rebuildBoard(); return; }
            elastics.push({ pins: [...selectedPins], color: currentElasticColor, closed: true });
            selectedPins = [];
            rebuildBoard();
            onElasticAdded();
            return;
        }
        return;
    }
    selectedPins.push({ r, c });
    rebuildBoard();
    // Elastik tamamla butonu
    onPinSelected(r, c);
}

// Ölçüm modu — 2 pin seçip mesafe hesapla
function handleMeasurePinClick(r, c) {
    measurePins.push({ r, c });
    const pin = document.getElementById(pinId(r, c));
    if (pin) { pin.setAttribute('fill', '#f97316'); pin.setAttribute('r', PIN_R_SEL); }
    if (measurePins.length === 2) {
        const [p1, p2] = measurePins;
        const dr = p2.r - p1.r, dc = p2.c - p1.c;
        const dist = Math.sqrt(dr * dr + dc * dc).toFixed(2);
        $('#measureRows').html(`<div class="mp-row"><span class="mp-label">Mesafe =</span><span class="mp-val">${dist} birim</span></div>`);
        $('#measurePanel').addClass('visible');
        measurePins = [];
        setTimeout(() => rebuildBoard(), 1200);
    }
}

// Açı modu — 3 pin seçip açı hesapla
function handleAnglePinClick(r, c) {
    anglePoints.push({ r, c });
    const pin = document.getElementById(pinId(r, c));
    if (pin) { pin.setAttribute('fill', '#f97316'); pin.setAttribute('r', PIN_R_SEL); }
    if (anglePoints.length === 3) {
        const [p1, p2, p3] = anglePoints;
        // Açı: p1-p2-p3 arasındaki açı (p2 köşe)
        const ax = pinX(p1.c) - pinX(p2.c), ay = pinY(p1.r) - pinY(p2.r);
        const bx = pinX(p3.c) - pinX(p2.c), by = pinY(p3.r) - pinY(p2.r);
        const dot = ax * bx + ay * by;
        const magA = Math.sqrt(ax * ax + ay * ay), magB = Math.sqrt(bx * bx + by * by);
        const cosA = Math.max(-1, Math.min(1, dot / (magA * magB)));
        const deg = (Math.acos(cosA) * 180 / Math.PI).toFixed(1);
        $('#angleRows').html(`<div class="mp-row"><span class="mp-label">Açı =</span><span class="mp-val">${deg}°</span></div>`);
        $('#angleOverlay').addClass('visible');
        $(document).trigger('angleMeasured', { deg: parseFloat(deg) });
        setTimeout(() => { anglePoints = []; rebuildBoard(); }, 1400);
    }
}

/* Dışarıdan hook edilebilen olaylar */
function onPinSelected(r, c) { $(document).trigger('pinSelected', { r, c, count: selectedPins.length }); }
function onElasticAdded() {
    incrementElasticUse(currentElasticColor);
    updateSwatchBadges();
    // Eğer seçili rengin limiti doluysa otomatik başka renge geç
    if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) {
        const next = ELASTIC_COLORS.find(c => getElasticUseCount(c.hex) < ELASTIC_MAX_USE);
        if (next) {
            currentElasticColor = next.hex;
            const idx = ELASTIC_COLORS.indexOf(next);
            selectedColorIdx = idx;
            $('.tb-color-swatch').removeClass('selected');
            $(`.tb-color-swatch[data-hex="${next.hex}"]`).addClass('selected');
        }
    }
    $(document).trigger('elasticAdded', { count: elastics.length });
}

/* Elastik ekleme ve kontrol */
function addElasticFromSelected(close) {
    if (selectedPins.length < 2) return false;
    if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) return false;
    elastics.push({ pins: [...selectedPins], color: currentElasticColor, closed: !!close });
    selectedPins = [];
    rebuildBoard();
    onElasticAdded();
    return true;
}

function clearBoard() {
    selectedPins = [];
    elastics = [];
    anglePoints = [];
    measurePins = [];
    backSelectedPins = [];
    backElastics = [];
    selected3DPinsAll = [];
    resetElasticUseCounts();
    updateSwatchBadges();
    // 3D elastikleri temizle
    if (frontGroup) { frontGroup.children.filter(c => c.userData && c.userData.isElastic).forEach(c => frontGroup.remove(c)); elasticMeshes = []; }
    if (backGroup) { backGroup.children.filter(c => c.userData && c.userData.isElastic).forEach(c => backGroup.remove(c)); }
    if (previewLine3D && frontGroup) { frontGroup.remove(previewLine3D); previewLine3D = null; }
    // 3D seçim önizleme çizgisini de temizle
    if (typeof updatePreview3D === 'function') updatePreview3D();
    if (typeof updatePinSelectionColors === 'function') updatePinSelectionColors();
    if (typeof renderGuides3D === 'function') renderGuides3D([]);
}

/* ÇEMBER ÇİZME YARDIMCısı (App2 için) */
function drawCircleOnBoard(which) {
    elastics = [];
    const ns = 'http://www.w3.org/2000/svg';

    if (which === 'small' || which === 'both') {
        const smallPins = [{ r: 1, c: 1 }, { r: 1, c: 3 }, { r: 3, c: 3 }, { r: 3, c: 1 }];
        elastics.push({ pins: smallPins, color: '#ef4444', closed: true });
    }
    if (which === 'big' || which === 'both') {
        const bigPins = [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }];
        elastics.push({ pins: bigPins, color: '#3b82f6', closed: true });
    }
    if (which === 'both') {
        const innerPins = [{ r: 0, c: 2 }, { r: 2, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
        elastics.push({ pins: innerPins, color: '#22c55e', closed: true });
        const circlePins = [];
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const r = Math.round(2 + 2 * Math.sin(angle));
            const c = Math.round(2 + 2 * Math.cos(angle));
            if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) circlePins.push({ r, c });
        }
        if (circlePins.length >= 4) elastics.push({ pins: circlePins, color: '#a855f7', closed: true });
    }
    if (which === 'small') {
        const circlePins = [];
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const r = Math.round(2 + 1.5 * Math.sin(angle));
            const c = Math.round(2 + 1.5 * Math.cos(angle));
            if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) circlePins.push({ r, c });
        }
        const unique = [];
        circlePins.forEach(p => { if (!unique.find(u => u.r === p.r && u.c === p.c)) unique.push(p); });
        if (unique.length >= 3) elastics.push({ pins: unique, color: '#a855f7', closed: true });
    }
    if (frontGroup) updateElastics3D();
}

/* ── Özel Şekil Çizme ve Pin Vurgulama Yardımcıları ── */
function drawSquare(r0, c0, size, color) {
    const pins = [{ r: r0, c: c0 }, { r: r0, c: c0 + size }, { r: r0 + size, c: c0 + size }, { r: r0 + size, c: c0 }];
    elastics.push({ pins, color: color || currentElasticColor, closed: true });
    if (frontGroup) updateElastics3D();
}

function highlightPins(pinList) {
    pinList.forEach(({ r, c }) => {
        const el = document.getElementById(pinId(r, c));
        if (el) { el.setAttribute('fill', '#10b981'); el.setAttribute('r', PIN_R_SEL); }
    });
}


function buildBackFaceSVG() {
    const ns = 'http://www.w3.org/2000/svg';
    const W = BOARD_W, H = BOARD_H;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'backBoardSVG');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.cssText = 'max-width:100%;max-height:100%;display:block;';

    // Arka plan
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('rx', '16');
    bg.setAttribute('fill', currentTheme === 'dark' ? '#1a3a6b' : '#2563eb');
    svg.appendChild(bg);

    const cx = W / 2, cy = H / 2;

    // Büyük çember (24 pin)
    const bigR = PIN_GAP * 2.0;
    const cornerInset = bigR * 0.985;
    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const px = cx + bigR * Math.cos(angle);
        const py = cy + bigR * Math.sin(angle);
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', px); c.setAttribute('cy', py);
        c.setAttribute('r', PIN_R);
        c.setAttribute('class', 'back-pin-dot');
        c.setAttribute('data-face', 'back');
        c.setAttribute('data-idx', i);
        c.setAttribute('data-circle', 'big');
        c.setAttribute('fill', currentTheme === 'dark' ? '#4a9fd4' : '#93c5fd');
        c.setAttribute('stroke', 'rgba(255,255,255,0.3)');
        c.setAttribute('stroke-width', '1');
        svg.appendChild(c);
    }
    // Büyük çember çizgisi
    const bigCircleEl = document.createElementNS(ns, 'circle');
    bigCircleEl.setAttribute('cx', cx); bigCircleEl.setAttribute('cy', cy);
    bigCircleEl.setAttribute('r', bigR);
    bigCircleEl.setAttribute('fill', 'none');
    bigCircleEl.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    bigCircleEl.setAttribute('stroke-width', '1');
    bigCircleEl.setAttribute('stroke-dasharray', '4,4');
    svg.insertBefore(bigCircleEl, svg.children[1]);

    // Küçük çember (12 pin)
    const smallR = PIN_GAP * 1.0;
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const px = cx + smallR * Math.cos(angle);
        const py = cy + smallR * Math.sin(angle);
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', px); c.setAttribute('cy', py);
        c.setAttribute('r', PIN_R);
        c.setAttribute('class', 'back-pin-dot');
        c.setAttribute('data-face', 'back');
        c.setAttribute('data-idx', i);
        c.setAttribute('data-circle', 'small');
        c.setAttribute('fill', currentTheme === 'dark' ? '#4a9fd4' : '#93c5fd');
        c.setAttribute('stroke', 'rgba(255,255,255,0.3)');
        c.setAttribute('stroke-width', '1');
        svg.appendChild(c);
    }
    // Küçük çember kılavuz çizgisi
    const smCircleEl = document.createElementNS(ns, 'circle');
    smCircleEl.setAttribute('cx', cx); smCircleEl.setAttribute('cy', cy);
    smCircleEl.setAttribute('r', smallR);
    smCircleEl.setAttribute('fill', 'none');
    smCircleEl.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    smCircleEl.setAttribute('stroke-width', '1');
    smCircleEl.setAttribute('stroke-dasharray', '4,4');
    svg.insertBefore(smCircleEl, svg.children[1]);

    // Köşe pinleri (4 adet)
    const corners = [{ x: cx - cornerInset, y: cy - cornerInset }, { x: cx + cornerInset, y: cy - cornerInset }, { x: cx + cornerInset, y: cy + cornerInset }, { x: cx - cornerInset, y: cy + cornerInset }];
    corners.forEach((p, i) => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
        c.setAttribute('r', PIN_R);
        c.setAttribute('fill', currentTheme === 'dark' ? '#4a9fd4' : '#93c5fd');
        c.setAttribute('stroke', 'rgba(255,255,255,0.3)');
        c.setAttribute('stroke-width', '1');
        svg.appendChild(c);
    });

    // Merkez noktası
    const center = document.createElementNS(ns, 'circle');
    center.setAttribute('cx', cx); center.setAttribute('cy', cy);
    center.setAttribute('r', 4);
    center.setAttribute('fill', 'rgba(255,255,255,0.3)');
    svg.appendChild(center);

    return svg;
}

function rebuildBackBoard() {
    const wrap = document.getElementById('boardBackSvgWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.appendChild(buildBackFaceSVG());
    $('#backBoardSVG .back-pin-dot').off('click').on('click', function () {
        const px = parseFloat($(this).attr('cx'));
        const py = parseFloat($(this).attr('cy'));
        handleBackPinClick(px, py, this);
    });
}

function handleBackPinClick(px, py, el) {
    const idx = backSelectedPins.findIndex(p => Math.abs(p.x - px) < 2 && Math.abs(p.y - py) < 2);
    if (idx >= 0) {
        if (idx === 0 && backSelectedPins.length >= 3) {
            backElastics.push({ points: [...backSelectedPins.map(p => ({ x: p.x, y: p.y }))], color: currentElasticColor, closed: true });
            backSelectedPins.forEach(p => { if (p.el) { p.el.setAttribute('fill', currentTheme === 'dark' ? '#4a9fd4' : '#93c5fd'); p.el.setAttribute('r', PIN_R); } });
            backSelectedPins = [];
            renderBackElastics();
        }
        return;
    }
    el.setAttribute('fill', '#ffd700'); el.setAttribute('r', PIN_R_SEL);
    backSelectedPins.push({ x: px, y: py, el });
    renderBackElastics();
}

function renderBackElastics() {
    const svg = document.getElementById('backBoardSVG');
    if (!svg) return;
    svg.querySelectorAll('.back-elastic').forEach(e => e.remove());
    const ns = 'http://www.w3.org/2000/svg';

    backElastics.forEach(el => {
        if (el.points.length < 2) return;
        const pts = el.points.map(p => `${p.x},${p.y}`).join(' ');
        const poly = document.createElementNS(ns, el.closed && el.points.length >= 3 ? 'polygon' : 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('stroke', el.color);
        poly.setAttribute('stroke-width', '4');
        poly.setAttribute('stroke-linecap', 'square');
        poly.setAttribute('stroke-linejoin', 'miter');
        if (el.closed) {
            const r = parseInt(el.color.slice(1, 3), 16);
            const g = parseInt(el.color.slice(3, 5), 16);
            const b = parseInt(el.color.slice(5, 7), 16);
            poly.setAttribute('fill', `rgba(${r},${g},${b},0.18)`);
        } else {
            poly.setAttribute('fill', 'none');
        }
        poly.setAttribute('class', 'back-elastic');
        poly.setAttribute('pointer-events', 'none');
        svg.insertBefore(poly, svg.querySelector('.back-pin-dot'));
    });

    // Preview
    if (backSelectedPins.length > 0) {
        const pts = backSelectedPins.map(p => `${p.x},${p.y}`).join(' ');
        const prev = document.createElementNS(ns, 'polyline');
        prev.setAttribute('points', pts);
        prev.setAttribute('stroke', currentElasticColor);
        prev.setAttribute('stroke-width', '3');
        prev.setAttribute('stroke-dasharray', '6,4');
        prev.setAttribute('fill', 'none');
        prev.setAttribute('opacity', '0.7');
        prev.setAttribute('class', 'back-elastic');
        prev.setAttribute('pointer-events', 'none');
        svg.insertBefore(prev, svg.querySelector('.back-pin-dot'));
    }
}
