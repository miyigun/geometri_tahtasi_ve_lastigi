$(document).ready(function () {

    /* ══ TEMA ══════════════════════════════════════════════════════ */
    let currentTheme = 'dark';
    $('html').attr('data-theme', currentTheme);

    /* ══ RENK PALETİ ═══════════════════════════════════════════════ */
    const ELASTIC_COLORS = [
        { name: 'Kırmızı', hex: '#ef4444' },
        { name: 'Yeşil', hex: '#22c55e' },
        { name: 'Sarı', hex: '#eab308' },
    ];
    // Her renk için kullanım sayacı (max 7)
    const ELASTIC_MAX_USE = 7;
    let elasticUseCounts = {
        '#ef4444': 0,
        '#22c55e': 0,
        '#eab308': 0,
    };
    function getElasticUseCount(hex) { return elasticUseCounts[hex] || 0; }
    function incrementElasticUse(hex) { if (elasticUseCounts[hex] !== undefined) elasticUseCounts[hex]++; }
    function resetElasticUseCounts() { elasticUseCounts = { '#ef4444': 0, '#22c55e': 0, '#eab308': 0 }; }
    function updateSwatchBadges() {
        Object.keys(elasticUseCounts).forEach(hex => {
            const used = elasticUseCounts[hex];
            const remaining = ELASTIC_MAX_USE - used;
            const swatch = document.querySelector(`.tb-color-swatch[data-hex="${hex}"]`);
            if (swatch) {
                swatch.title = `${ELASTIC_COLORS.find(c => c.hex === hex).name} (${remaining} kaldı)`;
                swatch.style.opacity = remaining <= 0 ? '0.35' : '1';
                swatch.style.cursor = remaining <= 0 ? 'not-allowed' : 'pointer';
            }
        });
    }

    let _limitToastTimer = null;
    function showLimitToast(colorName) {
        const toast = document.getElementById('limitToast');
        if (!toast) return;
        toast.textContent = `⚠️ ${colorName || 'Bu renk'} lastik bitti! En fazla 7 adet kullanılabilir.`;
        toast.classList.add('show');
        clearTimeout(_limitToastTimer);
        _limitToastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2200);
    }
    let selectedColorIdx = 0;
    let paletteOpen = false;

    const $popup = $('#palettePopup');
    ELASTIC_COLORS.forEach((c, i) => {
        $popup.append($(`<div class="tb-color-swatch ${i === 0 ? 'selected' : ''}" title="${c.name} 7 adet kaldı." data-idx="${i}" data-hex="${c.hex}" style="background:${c.hex};"></div>`));
    });

    function positionPalette() {
        const tb = document.getElementById('sideToolbar');
        const rect = tb.getBoundingClientRect();
        const isMob = window.innerWidth <= 640;
        if (isMob) { $popup.css({ bottom: '60px', right: '8px', top: 'auto', left: 'auto' }); return; }
        const popH = $popup.outerHeight(true) || 280;
        let topPos = rect.top + rect.height / 2 - popH / 2;
        topPos = Math.max(10, Math.min(topPos, window.innerHeight - popH - 10));
        $popup.css({ top: topPos, right: window.innerWidth - rect.left + 6, left: 'auto', bottom: 'auto' });
    }

    $('#paletteToggleBtn').on('click', function (e) {
        e.stopPropagation(); paletteOpen = !paletteOpen;
        $popup.toggleClass('open', paletteOpen);
        $(this).toggleClass('active', paletteOpen);
        if (paletteOpen) positionPalette();
    });
    $(window).on('resize', function () { if (paletteOpen) positionPalette(); });
    $(document).on('click', function (e) {
        if (paletteOpen && !$(e.target).closest('#palettePopup,#paletteToggleBtn').length) {
            paletteOpen = false; $popup.removeClass('open'); $('#paletteToggleBtn').removeClass('active');
        }
    });
    $(document).on('click', '.tb-color-swatch', function () {
        const idx = parseInt($(this).data('idx'));
        const hex = ELASTIC_COLORS[idx].hex;
        if (getElasticUseCount(hex) >= ELASTIC_MAX_USE) {
            // Limit dolmuş, seçime izin verme
            return;
        }
        selectedColorIdx = idx;
        $('.tb-color-swatch').removeClass('selected');
        $(this).addClass('selected');
        currentElasticColor = hex;
    });

    /* ══ GEOMETRİ TAHTASI DURUMU ═══════════════════════════════════ */
    const GRID_N = 6;     // 6×6 pin
    const PIN_GAP = 62;    // px arası mesafe
    const PIN_R = 7;     // pin yarıçapı
    const PIN_R_SEL = 10;
    const PAD = 44;    // kenar boşluk
    const BOARD_W = PAD * 2 + PIN_GAP * (GRID_N - 1);
    const BOARD_H = BOARD_W;

    let currentElasticColor = ELASTIC_COLORS[0].hex;
    let selectedPins = [];   // [{r,c}, ...]
    let elastics = [];   // [{pins:[{r,c},...], color, closed}]
    let boardZoom = 1.0;
    let boardMode = 'draw'; // 'draw' | 'measure' | 'angle'
    let anglePoints = [];     // [{r,c}, ...]

    function pinId(r, c) { return `pin-${r}-${c}`; }
    function pinX(c) { return PAD + c * PIN_GAP; }
    function pinY(r) { return PAD + r * PIN_GAP; }

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
        renderElastics(elasticGroup, false); // false = preview çizme

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
        if (selectedPins.length >= 2) {
            // İlk ve son aynı = otomatik kapat → hayır, sadece çizgi ekle
        }
        rebuildBoard();
        // Elastik tamamla butonu
        onPinSelected(r, c);
    }

    // Ölçüm modu — 2 pin seçip mesafe hesapla
    let measurePins = [];
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
    }

    /* ══ ÇEMBER ÇİZME YARDIMCısı (App2 için) ═══════════════════════ */
    function drawCircleOnBoard(which) {
        elastics = [];
        const ns = 'http://www.w3.org/2000/svg';

        if (which === 'small' || which === 'both') {
            // Küçük çember: 12 pin, merkez (2,2), yarıçap=2
            // Pin koordinatlarında yaklaşık çember (iç çember, köşeleri çemberin üzerinde)
            // Geometri tahtasında köşeleri büyük çemberin üzerinde olan kare = "küçük kare"
            // yarıçap = √2·(kenar/2) = √2·1 ≈ 1.41 birim
            // Tahtada 4 pin köşe: (1,1),(1,3),(3,3),(3,1) → köşegen = 2√2 → r=√2
            const smallPins = [{ r: 1, c: 1 }, { r: 1, c: 3 }, { r: 3, c: 3 }, { r: 3, c: 1 }];
            elastics.push({ pins: smallPins, color: '#ef4444', closed: true });
        }
        if (which === 'big' || which === 'both') {
            // Büyük kare: 4 kenar pin (0,0),(0,4),(4,4),(4,0) → kenar=4 birim, r=2 birim
            const bigPins = [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }];
            elastics.push({ pins: bigPins, color: '#3b82f6', closed: true });
        }
        if (which === 'both') {
            // İç içe küçük kare (köşeleri büyük çemberin üzerinde)
            const innerPins = [{ r: 0, c: 2 }, { r: 2, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
            elastics.push({ pins: innerPins, color: '#22c55e', closed: true });
            // Daire gösterimi: 8 noktalı çokgen (yaklaşık çember)
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
            // Dairenin yaklaşık temsili (8-pin çokgen, r=1.5)
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
    let current2DFace = 'front'; // 'front' | 'back'

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

        // ── Büyük çember (24 pin) ──
        // r = PIN_GAP * 2 birim ≈ yarıçap
        const bigR = PIN_GAP * 2.0;
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
        // Büyük çember çizgisi (kılavuz)
        const bigCircleEl = document.createElementNS(ns, 'circle');
        bigCircleEl.setAttribute('cx', cx); bigCircleEl.setAttribute('cy', cy);
        bigCircleEl.setAttribute('r', bigR);
        bigCircleEl.setAttribute('fill', 'none');
        bigCircleEl.setAttribute('stroke', 'rgba(255,255,255,0.15)');
        bigCircleEl.setAttribute('stroke-width', '1');
        bigCircleEl.setAttribute('stroke-dasharray', '4,4');
        svg.insertBefore(bigCircleEl, svg.children[1]);

        // ── Küçük çember (12 pin) ──
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
        const corners = [{ x: PAD, y: PAD }, { x: W - PAD, y: PAD }, { x: W - PAD, y: H - PAD }, { x: PAD, y: H - PAD }];
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
        // Arka yüz pinlerine lastik geçirme (aynı mantık)
        $('#backBoardSVG .back-pin-dot').off('click').on('click', function () {
            // Arka yüzde de lastik çizilebilir: koordinat olarak cx/cy kullan
            const px = parseFloat($(this).attr('cx'));
            const py = parseFloat($(this).attr('cy'));
            handleBackPinClick(px, py, this);
        });
    }

    // Arka yüz pin seçim & lastik
    let backSelectedPins = []; // [{x,y,el}, ...]
    let backElastics = [];     // [{points:[{x,y},...], color, closed}]

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
        // Eski lastikleri temizle
        svg.querySelectorAll('.back-elastic').forEach(e => e.remove());
        const ns = 'http://www.w3.org/2000/svg';

        backElastics.forEach(el => {
            if (el.points.length < 2) return;
            const pts = el.points.map(p => `${p.x},${p.y}`).join(' ');
            const poly = document.createElementNS(ns, el.closed && el.points.length >= 3 ? 'polygon' : 'polyline');
            poly.setAttribute('points', pts);
            poly.setAttribute('stroke', el.color);
            poly.setAttribute('stroke-width', '4');
            poly.setAttribute('stroke-linecap', 'round');
            poly.setAttribute('stroke-linejoin', 'round');
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
            // Pinlerin altına ekle
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

    // 2D yüz geçiş butonları
    $('#face2DFrontBtn').on('click', function () {
        if (current2DFace === 'front') return;
        current2DFace = 'front';
        $(this).addClass('active'); $('#face2DBackBtn').removeClass('active');
        $('#geoBoard').css('display', 'flex');
        $('#geoBoardBack').css('display', 'none');
    });
    $('#face2DBackBtn').on('click', function () {
        if (current2DFace === 'back') return;
        current2DFace = 'back';
        $(this).addClass('active'); $('#face2DFrontBtn').removeClass('active');
        $('#geoBoard').css('display', 'none');
        $('#geoBoardBack').css({
            display: 'flex', flex: '1', position: 'relative', overflow: 'hidden',
            userSelect: 'none', minHeight: '0', alignItems: 'center', justifyContent: 'center'
        });
        rebuildBackBoard();
    });

    /* Zoom / Reset / Undo — 3D */
    function clear3DElastics() {
        if (frontGroup) { frontGroup.children.filter(c => c.userData.isElastic).forEach(c => frontGroup.remove(c)); }
        if (backGroup) { backGroup.children.filter(c => c.userData.isElastic).forEach(c => backGroup.remove(c)); }
        elastics = []; elasticMeshes = [];
        selected3DPinsAll = [];
        updatePinSelectionColors();
    }
    $('#zoomInBtn').on('click', () => { if (threeCamera) { threeCamera.position.multiplyScalar(0.85); } });
    $('#zoomOutBtn').on('click', () => { if (threeCamera) { threeCamera.position.multiplyScalar(1.18); } });
    $('#resetBoardBtn').on('click', () => { clear3DElastics(); if (threeCamera) { threeCamera.position.set(0, 0, 9); threeControls && threeControls.reset(); } });
    $('#clearBoardBtn').on('click', () => {
        // 2D seçili pin önizlemesini, 3D seçili pinleri ve tüm elastikleri temizle
        selectedPins = [];
        backSelectedPins = [];
        clearBoard();
        // Arka yüz SVG'sini de yenile
        if (current2DFace === 'back') rebuildBackBoard();
    });
    $('#undoBtn').on('click', () => {
        if (selected3DPinsAll.length > 0) { selected3DPinsAll.pop(); updatePinSelectionColors(); return; }
        // Son elastiği kaldır
        const frontEls = frontGroup ? frontGroup.children.filter(c => c.userData.isElastic) : [];
        const backEls = backGroup ? backGroup.children.filter(c => c.userData.isElastic) : [];
        if (backEls.length > 0) { backGroup.remove(backEls[backEls.length - 1]); }
        else if (frontEls.length > 0) { frontGroup.remove(frontEls[frontEls.length - 1]); elastics.pop(); }
    });

    /* ══ ÖZEL ŞEKIL ÇIZME YARDIMCıLARı ════════════════════════════ */
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

    /* Seçilmiş pinlerden dörtgen var mı? (tam 4 pin, dikdörtgen/kare) */
    function isValidSquare(pins) {
        if (pins.length !== 4) return false;
        const rs = pins.map(p => p.r), cs = pins.map(p => p.c);
        const minR = Math.min(...rs), maxR = Math.max(...rs);
        const minC = Math.min(...cs), maxC = Math.max(...cs);
        const h = maxR - minR, w = maxC - minC;
        return h === w && h === 2;
    }

    /* ── Adım 4 tahta-üzeri overlay input kutuları ─────────────────── */
    function _buildAreaOverlay() {
        const container = document.getElementById('threeContainer');
        if (!container || !threeCamera || !threeRenderer) return;
        _removeAreaOverlay();

        // elastics dizisindeki pinlerin 3D konumlarını hesapla
        const step = BOARD_SIZE_3D / (PIN_COLS - 1);
        const half = BOARD_SIZE_3D / 2;
        const zF = 0.08; // ön yüz z offset

        function pinTo3D(r, c) {
            return new THREE.Vector3(
                -half + c * step,
                half - r * step,
                zF
            );
        }

        // Her elastiğin merkez noktasını bul ve ekrana yansıt
        function projectToScreen(v3) {
            const canvas = threeRenderer.domElement;
            const rect = container.getBoundingClientRect();
            const canRect = canvas.getBoundingClientRect();
            const clone = v3.clone();
            clone.project(threeCamera);
            // NDC → canvas piksel
            const px = (clone.x * 0.5 + 0.5) * canRect.width + (canRect.left - rect.left);
            const py = (-clone.y * 0.5 + 0.5) * canRect.height + (canRect.top - rect.top);
            return { x: px, y: py };
        }

        // Bölge renkleri (lastik ekleme sırasına göre: [0]=2x2, [1]=lastik2, [2]=lastik3)
        // 4 bölge: a² (elastics[0] merkezi), ab (sağ üst), ab (sol alt), b² (köşe)
        // Tüm elastiklerin merkezlerini bul
        const regions = [];
        elastics.forEach((el, i) => {
            if (!el.pins || el.pins.length < 2) return;
            const xs = el.pins.map(p => p.c);
            const ys = el.pins.map(p => p.r);
            const midC = (Math.min(...xs) + Math.max(...xs)) / 2;
            const midR = (Math.min(...ys) + Math.max(...ys)) / 2;
            const center3D = pinTo3D(midR, midC);
            const screen = projectToScreen(center3D);
            const colors = ['#ef4444', '#eab308', '#3b82f6', '#22c55e'];
            const ids = ['area1', 'area2', 'area3', 'area4'];
            if (i < 4) {
                regions.push({ id: ids[i], color: colors[i], x: screen.x, y: screen.y });
            }
        });

        // Eğer 3'ten az elastik varsa (henüz tamamlanmamış), konumları tahmini koy
        // (bu durum normalde olmamalı — adım 4'e gelindiğinde 3 elastik mevcut)

        const wrap = document.createElement('div');
        wrap.id = 'areaOverlayWrap';
        wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;';

        regions.forEach(r => {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = r.id;
            inp.className = 'overlay-area-input';
            inp.readOnly = true;
            inp.placeholder = '?';
            inp.style.cssText = `
            position:absolute;
            left:${r.x}px; top:${r.y}px;
            transform:translate(-50%,-50%);
            width:68px;height:34px;text-align:center;font-size:1.05em;font-weight:700;
            background:rgba(0,0,0,.72);backdrop-filter:blur(4px);
            border:2px solid ${r.color};border-radius:9px;color:#fff;
            cursor:pointer;pointer-events:all;outline:none;
            transition:border-color .2s, box-shadow .2s;
        `;
            inp.addEventListener('focus', () => {
                inp.style.boxShadow = `0 0 0 3px ${r.color}55`;
            });
            inp.addEventListener('blur', () => { inp.style.boxShadow = ''; });
            wrap.appendChild(inp);
        });
        container.appendChild(wrap);
    }
    function _removeAreaOverlay() {
        const el = document.getElementById('areaOverlayWrap');
        if (el) el.remove();
    }

    /* ══ İÇERİK ALANI ══════════════════════════════════════════════ */
    function loadTab(name) {
        $('#contentArea').empty();
        if (name === 'intro') loadIntro();
        else if (name === 'app1') loadApp1();
        else if (name === 'app2') loadApp2();
        else if (name === 'app3') loadApp3();
        else if (name === 'deep') loadDeep();
    }

    $('.tab-button').on('click', function () {
        if ($(this).prop('disabled')) return;
        $('.tab-button').removeClass('active');
        $(this).addClass('active');
        clearBoard();
        boardMode = 'draw';
        loadTab($(this).data('tab'));
    });

    /* ══ TANITIM SEKMESI ════════════════════════════════════════════ */
    function loadIntro() {
        renderIntroStep(0);
    }

    function renderIntroStep(step) {
        clearBoard();
        boardMode = 'draw';
        const totalSteps = 3;
        const pct = Math.round(((step + 1) / totalSteps) * 100);
        let html = `<div class="progress-container">
        <div class="progress-label"><span>Tanıtım</span><span>${step + 1}/${totalSteps}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

        switch (step) {
            case 0:
                html += `<div class="instruction-box">
            <h3>Geometri Tahtası ve Lastiği</h3>
            <p>Plastikten yapılan materyal, <strong>mavi renktedir</strong> ve <strong>kare şeklindedir</strong>.</p>
            <p>Bir yüzünde <strong>36 pin</strong> vardır. Diğer yüzünde ise merkezleri aynı olan, 12 ve 24 pinden oluşan <strong>iki çember</strong> yer almaktadır.</p>
            <p>Materyalin bu yüzünün her köşesinde birer pin vardır.</p>
            <p style="margin-top:4px;font-size:.92em;">Materyal içerisinde aşağıda belirtilen sayıda lastik bulunmaktadır:</p>
            <ul>
                <li>7 yeşil renkli lastik</li>
                <li>7 kırmızı renkli lastik</li>
                <li>7 sarı renkli lastik</li>
            </ul>
            <p style="margin-top:4px;font-size:.92em;">Bunlara araçlar çubuğu üzerindeki <strong>Palet</strong> aracı ile ulaşabilirsiniz.</p>
            <p style="margin-top:8px;font-size:.85em;color:var(--text-secondary);">Sağ paneldeki geometri tahtasını inceleyebilirsiniz.</p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="introStep0Btn">Devam Et</button></div>`;
                break;
            case 1:
                html += `<div class="instruction-box">
            <h3>Konular</h3>
            <p>Geometri tahtası materyali, tüm sınıf düzeylerinde <strong>geometri</strong> ve <strong>analitik geometri</strong> konularında kullanılabilir.</p>
            <h4>🎯 Kazanımlar</h4>
            <ul>
                <li>Geometri tahtası üzerinde oluşturulabilecek çokgenlerin ve çemberlerin özelliklerini keşfeder.</li>
                <li>Tamkare bir ifadeyi modeller.</li>
                <li>İrrasyonel bir sayının geometrik yorumunu yapar.</li>
            </ul>
        </div>
        <div style="text-align:center;"><button class="action-button" id="introStep1Btn">Devam Et</button></div>`;
                break;
            case 2:
                html += `<div class="success-message" style="padding:18px;">
            ✓ Tanıtım tamamlandı!<br>
            <span style="font-size:.9em;">Uygulamalara geçmeye hazırsınız.</span>
        </div>
        <div class="instruction-box">
            <h3>Başlamaya Hazır mısınız?</h3>
            <p>Uygulama 1'de <strong>Tamkare İfade</strong> elde etmeyi öğreneceksiniz.</p>
            <p>Geometri tahtasında 2×2 kare oluşturmayı deneyebilirsiniz.</p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="introFinishBtn">Uygulama 1'e Geç</button></div>`;
                $('[data-tab="app1"]').prop('disabled', false);
                break;
        }

        $('#contentArea').html(html);
        if (window.MathJax) MathJax.typesetPromise();

        switch (step) {
            case 0: $('#introStep0Btn').on('click', () => renderIntroStep(1)); break;
            case 1: $('#introStep1Btn').on('click', () => renderIntroStep(2)); break;
            case 2: $('#introFinishBtn').on('click', () => $('[data-tab="app1"]').prop('disabled', false).click()); break;
        }
    }

    /* ══ UYGULAMA 1: Tamkare İfade Elde Edelim! ═══════════════════ */
    function loadApp1() {
        clearBoard();
        if (frontGroup) updateElastics3D();
        boardMode = 'draw';
        renderApp1Step(0);
    }

    function renderApp1Step(step) {
        // Adım 3 ve sonrasında tahta korunur (kullanıcının çizimleri silinmez)
        if (step < 3) clearBoard();
        boardMode = 'draw';
        const totalSteps = 8;
        const pct = Math.round(((step + 1) / totalSteps) * 100);
        let html = `<div class="progress-container">
        <div class="progress-label"><span>Uygulama 1</span><span>${step + 1}/${totalSteps}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

        switch (step) {
            /* Adım 0: Bilgilendirme */
            case 0:
                html += `<div class="instruction-box">
            <h3>Tamkare İfade Elde Edelim!</h3>
            <h4>Hedeflenen Beceriler</h4>
            <ul>
                <li>İlişkilendirme</li>
                <li>Akıl Yürütme</li>
                <li>İletişim</li>
                <li>Matematiksel Modelleme</li>
            </ul>
            <h4>Hedefler</h4>
            <p>Öğrencilerin bütünü oluşturan parçaları bulabilmesi, <strong>tamkare ifade elde edebilmesi</strong> hedeflenir.</p>
            <h4>Uygulama Aşaması</h4>
            <p>Tamkare özdeşliğini elde etmek amacıyla kavramsal bilgiyi sorgulama, işlemsel bilgiyi inceleme ve derinleştirme sürecinde kullanılabilir.</p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app1s0Btn">Başla</button></div>`;
                $('#boardHint').text('🟦 Geometri tahtasını hazırlayın');
                break;

            /* Adım 1: Dikkat çekme — tamkare sayılar */
            case 1:
                html += `<div class="instruction-box">
            <p>"1'den 10'a kadar olan tam sayıların karekökleri alındığında hangileri <strong>bir tam sayıya karşılık gelir</strong>? Neden?"</p>
            <p style="margin-top:10px;font-size:.9em;color:var(--text-secondary);">Aşağıdaki sayılardan <strong>tamkare olanları</strong> seçiniz:</p>
            <div class="num-grid" id="numGrid">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="num-btn" data-num="${n}">${n}</button>`).join('')}
            </div>
            <div id="numFeedback" style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">0 doğru seçim</div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app1s1Btn" disabled>Devam Et</button></div>`;
                $('#boardHint').text('🔢 Tamkare sayıları seçin: 1, 4, 9');
                break;

            /* Adım 2: 2×2 Kare oluşturma */
            case 2:
                clearBoard();
                if (frontGroup) updateElastics3D();
                html += `<div class="instruction-box">
            <p>Geometri tahtası üzerinde <strong>tek bir lastikle 2×2'lik bir kare oluşturunuz.</strong></p>
            <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">Tahtada <strong>4 pine sırasıyla tıklayınız</strong> ve başlangıç noktasına dönerek kareyi tamamlayınız.</p>
            <div id="squareStatus" style="margin-top:10px;padding:8px;background:var(--bg-tertiary);border-radius:7px;font-size:.88em;color:var(--text-secondary);">
                ⬡ Henüz kare oluşturulmadı
            </div>
        </div>
        <div id="edgeQuestion" style="display:none;" class="instruction-box">
            <p>Bu karenin <strong>kenar uzunluğu</strong> kaç birimdir?</p>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <button class="option-button" id="edgeAns1" data-ans="wrong">1 birim</button>
                <button class="option-button" id="edgeAns2" data-ans="right">2 birim</button>
                <button class="option-button" id="edgeAns3" data-ans="wrong">3 birim</button>
            </div>
            <div id="edgeFeedback" style="margin-top:8px;font-size:.88em;"></div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app1s2Btn" disabled>Devam Et</button></div>`;
                $('#boardHint').text('📌 4 pin seçip ilk pine dönerek kareyi kapatın');
                break;

            /* Adım 3: 3×3 Kareye tamamlama */
            case 3:
                html += `<div class="instruction-box">
            <p>Karenin kenarını <strong>a</strong> olarak adlandırdık. Şimdi kareyi <strong>sağa ve aşağıya 1 birim</strong> genişleterek yeni bir kare elde ediniz.</p>
            <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">💡 Bundan sonra bu <strong>1 birimlik kenarı b olarak adlandıracağız</strong>.</p>
            <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">Yeni kenar uzunluğu <strong>a + b</strong> olacaktır. Bunu oluşturmak için <strong>farklı renkte 2 yeni lastik</strong> ekleyiniz.</p>
            <div id="completeStatus" style="margin-top:10px;padding:8px;background:var(--bg-tertiary);border-radius:7px;font-size:.88em;color:var(--text-secondary);">
                ⬡ Henüz (a+b)∙(a+b) kare tamamlanmadı
            </div>
        </div>
        <div id="abEdgeReveal" style="display:none;" class="instruction-box">
            <p>Oluşan büyük karenin kenar uzunluğu <strong>a + b</strong>'dir.</p>
            <p style="margin-top:6px;">Peki bu karenin alanı nedir?</p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app1s3Btn" disabled>Devam Et</button></div>`;
                $('#boardHint').text('🔳 2 yeni farklı renkli lastik ekleyerek 3×3 kareyi tamamlayın');
                break;

            /* Adım 4: Alan hesabı — sol panel girişleri */
            case 4:
                html += `<div class="instruction-box">
            <p>Oluşturduğunuz şekilde <strong>büyük karenin kenar uzunluğu a = 2 birim</strong>, <strong>sonradan eklenen genişletme kenarı b = 1 birim</strong>'dir.</p>
            <p style="margin-top:8px;">Sağ taraftaki tahtada dört renkli bölgenin alanını <strong>a</strong> ve <strong>b</strong> cinsinden yazınız:</p>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
                <div>
                    <label style="font-size:.85em;color:var(--text-secondary);display:block;margin-bottom:3px;">① 2×2 Karenin Alanı:</label>
                    <input type="text" id="area1" class="area-panel-input" placeholder="?" readonly
                        style="width:100%;padding:8px 12px;background:var(--input-bg);border:2px solid #ef4444;border-radius:8px;color:var(--text-primary);font-size:1em;font-weight:700;cursor:pointer;outline:none;">
                </div>
                <div>
                    <label style="font-size:.85em;color:var(--text-secondary);display:block;margin-bottom:3px;">② 1×2 Dikdörtgenin Alanı:</label>
                    <input type="text" id="area2" class="area-panel-input" placeholder="?" readonly
                        style="width:100%;padding:8px 12px;background:var(--input-bg);border:2px solid #eab308;border-radius:8px;color:var(--text-primary);font-size:1em;font-weight:700;cursor:pointer;outline:none;">
                </div>
                <div>
                    <label style="font-size:.85em;color:var(--text-secondary);display:block;margin-bottom:3px;">③ 2×1 Dikdörtgenin Alanı:</label>
                    <input type="text" id="area3" class="area-panel-input" placeholder="?" readonly
                        style="width:100%;padding:8px 12px;background:var(--input-bg);border:2px solid #22c55e;border-radius:8px;color:var(--text-primary);font-size:1em;font-weight:700;cursor:pointer;outline:none;">
                </div>
                <div>
                    <label style="font-size:.85em;color:var(--text-secondary);display:block;margin-bottom:3px;">④ 1×1 Karenin Alanı:</label>
                    <input type="text" id="area4" class="area-panel-input" placeholder="?" readonly
                        style="width:100%;padding:8px 12px;background:var(--input-bg);border:2px solid #3b82f6;border-radius:8px;color:var(--text-primary);font-size:1em;font-weight:700;cursor:pointer;outline:none;">
                </div>
            </div>
            <div id="areaFeedback" style="margin-top:8px;"></div>
        </div>
        <div id="panelKeyboard" style="display:none;margin-top:8px;padding:10px;background:var(--bg-tertiary);border-radius:9px;border:1px solid var(--border-color);">
            <div style="font-size:.8em;color:var(--text-secondary);margin-bottom:6px;">Seçili alan: <span id="activeAreaLabel" style="color:var(--text-accent);font-weight:700;"></span></div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
                ${['a', 'b', '2', '²', '+', '×', '(', ')'].map(k => `<button class="sq-key" data-val="${k}" style="padding:6px 12px;border-radius:6px;background:var(--button-bg);border:1.5px solid var(--border-color);color:var(--button-text);cursor:pointer;font-size:1em;font-weight:600;">${k}</button>`).join('')}
                <button class="sq-key" data-val="⌫" style="padding:6px 12px;border-radius:6px;background:rgba(239,68,68,.2);border:1.5px solid #ef4444;color:#ef4444;cursor:pointer;font-size:1em;">⌫</button>
            </div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app1s4CheckBtn" style="margin-top:8px;">Kontrol Et</button></div>
        <div style="text-align:center;display:none;" id="app1s4NextArea"><button class="action-button" id="app1s4Btn">Devam Et</button></div>`;
                $('#boardHint').text('📐 Sol paneldeki kutulara bölge alanlarını yazın');
                break;

            /* Adım 5: Adım adım sadeleştirme + Özdeşlik */
            case 5:
                html += `<div class="instruction-box">
            <p>Bulduğunuz dört bölge alanını sırasıyla toplayınız:</p>
            <div id="sumSteps" style="margin-top:12px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:1em;line-height:2.4em;">
                    <span style="color:var(--text-secondary);">Toplam =</span>
                    <span id="ss1" style="padding:4px 13px;border-radius:8px;background:var(--bg-tertiary);border:1.5px dashed var(--border-color);color:var(--text-secondary);font-weight:700;">a²</span>
                    <span style="color:var(--text-secondary);">+</span>
                    <span id="ss2" style="padding:4px 13px;border-radius:8px;background:var(--bg-tertiary);border:1.5px dashed var(--border-color);color:var(--text-secondary);font-weight:700;">ab</span>
                    <span style="color:var(--text-secondary);">+</span>
                    <span id="ss3" style="padding:4px 13px;border-radius:8px;background:var(--bg-tertiary);border:1.5px dashed var(--border-color);color:var(--text-secondary);font-weight:700;">ab</span>
                    <span style="color:var(--text-secondary);">+</span>
                    <span id="ss4" style="padding:4px 13px;border-radius:8px;background:var(--bg-tertiary);border:1.5px dashed var(--border-color);color:var(--text-secondary);font-weight:700;">b²</span>
                </div>
                <div id="simplLine" style="display:none;margin-top:8px;padding:8px 14px;border-radius:8px;background:rgba(0,212,255,.08);border:1.5px solid var(--border-color);">
                    <span style="color:var(--text-secondary);">⟹</span>
                    <span style="margin-left:8px;font-size:1.1em;font-weight:700;color:var(--text-accent);">a² + 2ab + b²</span>
                </div>
            </div>
            <div style="margin-top:14px;">
                <p style="font-size:.9em;color:var(--text-secondary);">Benzer terimleri sadeleştirince ne elde edersiniz?</p>
                <div style="margin-top:10px;background:var(--bg-tertiary);border:2px solid var(--border-color);border-radius:12px;padding:14px;text-align:center;">
                    <input type="text" id="sumInput" readonly placeholder="Buraya yazın"
                        style="width:100%;background:transparent;border:none;outline:none;font-size:1.4em;font-weight:700;color:var(--text-accent);text-align:center;cursor:pointer;">
                </div>
                <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;" id="sumKeyboard">
                    ${['a', 'b', '2', '²', '+'].map(k => `<button class="sq-key2" data-val="${k}" style="padding:8px 14px;border-radius:8px;background:var(--button-bg);border:1.5px solid var(--border-color);color:var(--button-text);cursor:pointer;font-size:1.05em;font-weight:700;">${k}</button>`).join('')}
                    <button class="sq-key2" data-val="⌫" style="padding:8px 14px;border-radius:8px;background:rgba(239,68,68,.2);border:1.5px solid #ef4444;color:#ef4444;cursor:pointer;font-size:1.05em;font-weight:700;">⌫</button>
                </div>
                <div style="text-align:center;margin-top:10px;">
                    <button class="action-button" id="sumCheckBtn">Kontrol Et</button>
                </div>
                <div id="sumFeedback" style="margin-top:8px;"></div>
            </div>
        </div>

        <div id="formulaReveal" style="display:none;" class="instruction-box">
            <p style="font-size:.95em;">Geometri tahtasındaki büyük karenin <strong>kenar uzunluğunun a + b</strong> olduğunu gördünüz.</p>
            <p style="margin-top:6px;font-size:.95em;">O zaman bu büyük karenin <strong>alanı</strong> nasıl yazılır?</p>
            <div style="margin-top:8px;padding:10px 14px;background:rgba(0,212,255,.07);border-radius:8px;border:1px solid var(--border-color);text-align:center;font-size:.95em;color:var(--text-secondary);">
                Alan = kenar × kenar = <strong style="color:var(--text-accent);">(a + b) ∙ (a + b)</strong> = ?
            </div>
            <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;" id="squareKeyboard">
                ${['(', 'a', '+', 'b', ')', '²'].map(k => `<button class="sq-key3" data-val="${k}" style="padding:8px 14px;border-radius:8px;background:var(--button-bg);border:1.5px solid var(--border-color);color:var(--button-text);cursor:pointer;font-size:1.05em;font-weight:700;">${k}</button>`).join('')}
                <button class="sq-key3" data-val="⌫" style="padding:8px 14px;border-radius:8px;background:rgba(239,68,68,.2);border:1.5px solid #ef4444;color:#ef4444;cursor:pointer;font-size:1.05em;font-weight:700;">⌫</button>
            </div>
            <div style="margin-top:10px;background:var(--bg-tertiary);border:2px solid var(--border-color);border-radius:12px;padding:14px;text-align:center;">
                <input type="text" id="squareInput" readonly placeholder="Alanı yazın"
                    style="width:100%;background:transparent;border:none;outline:none;font-size:1.4em;font-weight:700;color:var(--text-accent);text-align:center;cursor:pointer;">
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="squareCheckBtn">Kontrol Et</button>
            </div>
            <div id="squareFeedback" style="margin-top:8px;"></div>
        </div>

        <div id="identityReveal" style="display:none;" class="instruction-box">
            <p style="font-size:.95em;font-weight:600;">Büyük karenin alanını iki farklı yoldan buldunuz:</p>
            <div style="margin-top:10px;padding:16px;background:rgba(0,212,255,.07);border:2px solid var(--border-color);border-radius:12px;">
                <div style="font-size:.9em;color:var(--text-secondary);text-align:center;">
                    Parçalar: <span style="color:#f97316;font-weight:700;">a²</span> + <span style="color:#eab308;font-weight:700;">ab</span> + <span style="color:#22c55e;font-weight:700;">ab</span> + <span style="color:#3b82f6;font-weight:700;">b²</span> = <span style="color:var(--text-accent);font-weight:700;">a² + 2ab + b²</span>
                </div>
                <div style="text-align:center;font-size:1.4em;color:var(--text-secondary);margin:2px 0;">=</div>
                <div style="font-size:.9em;color:var(--text-secondary);text-align:center;">
                    Büyük kare: <span style="color:var(--text-accent);font-weight:700;">(a + b)²</span>
                </div>
                <div style="margin-top:12px;padding-top:10px;border-top:1.5px solid var(--border-color);text-align:center;">
                    <span style="font-size:1.25em;font-weight:800;color:var(--text-accent);">(a + b)² = a² + 2ab + b²</span>
                </div>
            </div>
            <div style="margin-top:10px;" class="explain-box">
                <p>Geometri tahtasında bizzat keşfettiğiniz bu eşitlik <strong>tamkare özdeşliği</strong>dir!</p>
            </div>
        </div>
        <div style="text-align:center;display:none;" id="app1s5NextArea"><button class="action-button" id="app1s5Btn">Devam Et</button></div>`;
                $('#boardHint').text('✏️ Dört bölgenin alanlarını toplayarak sadeleştirin');
                // Bölge renklerini animasyonlu vurgula
                setTimeout(() => {
                    const colors = ['#f97316', '#eab308', '#3b82f6', '#22c55e']; // turuncu,sarı,mavi,yeşil
                    const ids = ['ss1', 'ss2', 'ss3', 'ss4'];
                    ids.forEach((id, i) => {
                        setTimeout(() => {
                            $('#' + id).css({ background: colors[i] + '33', borderColor: colors[i], color: colors[i], fontWeight: '700' });
                        }, i * 300);
                    });
                }, 200);
                break;

            /* Adım 6: Ölçme ve Değerlendirme */
            case 6:
                html += `<div class="instruction-box">
            <h3>📝 Ölçme ve Değerlendirme</h3>
            <p><strong>Görev:</strong> a = 3 ve b = 2 için geometri tahtası üzerinde <strong>(a + b)²</strong> tamkare açılımını oluşturunuz.</p>
            <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">💡 Önceki adımlardan farklı olarak 4 bölgeyi farklı lastiklerle oluşturunuz:<br>
            a² (3×3 kare) + ab (3×2 dikdörtgen) + ab (2×3 dikdörtgen) + b² (2×2 kare)</p>
            <div id="assess6Status" style="margin-top:10px;padding:8px;background:var(--bg-tertiary);border-radius:7px;font-size:.88em;color:var(--text-secondary);">
                ⬡ Henüz şekil oluşturulmadı
            </div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app1s6BuildBtn" disabled>Devam Et</button></div>

        <div id="assess6QuestionArea" style="display:none;" class="instruction-box">
            <p style="font-size:.95em;">Geometri tahtasında oluşan şekli inceleyiniz.</p>
            <p style="margin-top:8px;font-size:.95em;">Aşağıdaki soruyu geometri tahtasında oluşan şekle göre cevaplayınız:</p>
            <p style="font-weight:700;margin-top:10px;font-size:1em;">$(a + b)^2$ ifadesinde $a=3, b=2$ olduğunda sonuç kaç olur?</p>
            <input type="text" id="app1AssessInput" class="input-field" placeholder="Cevabınızı girin" inputmode="decimal" style="margin-top:8px;">
            <div id="app1AssessFeedback" style="margin-top:8px;"></div>
        </div>
        <div style="display:none;text-align:center;" id="app1s6NextArea"><button class="action-button" id="app1FinishBtn">Uygulama 2'ye Geç</button></div>`;
                clearBoard();
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                $('[data-tab="app2"]').prop('disabled', false);
                break;
        }

        $('#contentArea').html(html);
        if (window.MathJax) MathJax.typesetPromise();

        /* Olay bağlamaları */
        switch (step) {
            case 0: $('#app1s0Btn').on('click', () => renderApp1Step(1)); break;
            case 1:
                let correctSelections = new Set();
                const CORRECT_SQUARES = new Set([1, 4, 9]);
                $(document).off('click.numgrid').on('click.numgrid', '.num-btn', function () {
                    if ($(this).prop('disabled')) return;
                    const n = parseInt($(this).data('num'));
                    if (CORRECT_SQUARES.has(n)) {
                        $(this).addClass('correct').prop('disabled', true);
                        correctSelections.add(n);
                        $('#numFeedback').text(`${correctSelections.size}/3 doğru seçim`).css('color', 'var(--success-bg)');
                        if (correctSelections.size === 3) {
                            $('#app1s1Btn').prop('disabled', false);
                            $('#numFeedback').text('✓ Doğru! 1, 4 ve 9 tamkare sayılardır.').css('color', 'var(--success-bg)');
                            $(document).off('click.numgrid');
                        }
                    } else {
                        $(this).addClass('incorrect');
                        setTimeout(() => $(this).removeClass('incorrect'), 800);
                        $('#numFeedback').text('💡 İpucu: Karekökü tam sayı olan sayıları dene!').css('color', 'var(--error-bg)');
                    }
                });
                $('#app1s1Btn').on('click', () => { $(document).off('click.numgrid'); renderApp1Step(2); });
                break;
            case 2:
                $(document).off('elasticAdded.app1s2').on('elasticAdded.app1s2', function (e, data) {
                    const last = elastics[elastics.length - 1];
                    if (last && last.closed && last.pins.length === 4) {
                        if (isValidSquare(last.pins)) {
                            $('#squareStatus').html('✓ 2×2 kare oluşturuldu! Şimdi aşağıdaki soruyu yanıtlayın.').css('color', 'var(--success-bg)');
                            $('#edgeQuestion').show();
                            $(document).off('elasticAdded.app1s2');
                        } else {
                            $('#squareStatus').text('⚠ Lütfen tam olarak 2×2 boyutunda bir kare çizin.').css('color', 'var(--error-bg)');
                        }
                    }
                });
                $(document).off('pinSelected.app1s2').on('pinSelected.app1s2', function (e, data) {
                    $('#squareStatus').text(`${data.count} pin seçildi — İlk pine geri dönerek kapatın`).css('color', 'var(--text-secondary)');
                });
                // Kenar uzunluğu sorusu
                $(document).off('click.edgeQ').on('click.edgeQ', '#edgeQuestion .option-button', function () {
                    if ($(this).prop('disabled')) return;
                    const ans = $(this).data('ans');
                    if (ans === 'right') {
                        $(this).addClass('correct');
                        $('#edgeQuestion .option-button').prop('disabled', true);
                        $('#edgeFeedback').html('✓ Doğru! Kenar uzunluğu <strong>2 birim</strong>dir. Bu uzunluğu bundan sonra <strong>a</strong> olarak adlandırıyoruz.').css('color', 'var(--success-bg)');
                        $('#app1s2Btn').prop('disabled', false);
                        $(document).off('click.edgeQ');
                    } else {
                        $(this).addClass('incorrect');
                        setTimeout(() => $(this).removeClass('incorrect'), 800);
                        $('#edgeFeedback').text('Kaç birim? Pinleri sayın.').css('color', 'var(--error-bg)');
                    }
                });
                $('#app1s2Btn').on('click', () => { $(document).off('elasticAdded.app1s2 pinSelected.app1s2 click.edgeQ'); renderApp1Step(3); });
                break;
            case 3:
                // 3×3 tamamlama kontrolü
                // elastics[0] = adım 3/8'de çizilen 2×2 kare (korunuyor)
                // Kullanıcı 2 yeni farklı renkli kapalı şekil eklemelidir ve
                // tüm elastikler birlikte tam 3×3 boyutunda bir kareyi kapsamalıdır.

                // Yardımcı: verilen elastikler toplamda 3×3 boyutunu kapsıyor mu?
                // Pozisyondan bağımsız — sadece span 3 birim olmalı
                function covers3x3(elList) {
                    const allPins = elList.flatMap(e => e.pins);
                    if (allPins.length === 0) return false;
                    const rs = allPins.map(p => p.r), cs = allPins.map(p => p.c);
                    const spanR = Math.max(...rs) - Math.min(...rs);
                    const spanC = Math.max(...cs) - Math.min(...cs);
                    return spanR === 3 && spanC === 3;
                }

                $(document).off('elasticAdded.app1s3').on('elasticAdded.app1s3', function () {
                    // İlk elastik (index 0) = önceki adımdan gelen 2×2 kare
                    const addedElastics = elastics.slice(1); // yeni eklenenler
                    if (addedElastics.length < 2) {
                        $('#completeStatus')
                            .text(`${addedElastics.length}/2 lastik eklendi — 1 tane daha ekleyin`)
                            .css('color', 'var(--text-secondary)');
                        return;
                    }
                    // Son 2 yeni lastiği al
                    const last2 = addedElastics.slice(-2);
                    // Renk kontrolü: 2 yeni lastiğin rengi birbirleriyle farklı olmalı
                    const baseColor = elastics[0] ? elastics[0].color : null;
                    const c1 = last2[0].color, c2 = last2[1].color;
                    if (c1 === c2) {
                        $('#completeStatus')
                            .text('⚠ İki yeni lastiğin rengi birbirinden farklı olmalıdır!')
                            .css('color', 'var(--error-bg)');
                        return;
                    }
                    if (baseColor && (c1 === baseColor || c2 === baseColor)) {
                        $('#completeStatus')
                            .text('⚠ Yeni lastiklerin rengi ilk karedekinden farklı olmalıdır!')
                            .css('color', 'var(--error-bg)');
                        return;
                    }
                    // 3×3 kaplama kontrolü — tüm elastiklerin pin aralığı 3 birim olmalı
                    if (!covers3x3(elastics)) {
                        $('#completeStatus')
                            .text('⚠ Lastikler henüz 3×3 kareyi tam olarak tamamlamıyor.')
                            .css('color', 'var(--error-bg)');
                        return;
                    }
                    // Başarı!
                    $('#completeStatus')
                        .html('✓ (a+b)×(a+b) kare tamamlandı!')
                        .css('color', 'var(--success-bg)');
                    $('#abEdgeReveal').show();
                    $('#app1s3Btn').prop('disabled', false);
                    $(document).off('elasticAdded.app1s3');
                });
                $('#app1s3Btn').on('click', () => { $(document).off('elasticAdded.app1s3'); renderApp1Step(4); });
                break;
            case 4:
                let activeAreaInput = null;
                const areaLabels = { area1: '2×2 Kare', area2: '1×2 Dikdörtgen', area3: '2×1 Dikdörtgen', area4: '1×1 Kare' };
                const areaBorderColors = { area1: '#ef4444', area2: '#eab308', area3: '#22c55e', area4: '#3b82f6' };
                $(document).on('click.sqkey', 'button.sq-key', function () {
                    if (!activeAreaInput) return;
                    const val = $(this).data('val');
                    if (val === '⌫') activeAreaInput.value = activeAreaInput.value.slice(0, -1);
                    else activeAreaInput.value += val;
                });
                // Panel inputlarına tıklanınca klavye açılır
                $(document).on('click.areaovl', '.area-panel-input', function () {
                    // Önceki aktifin kenarlık rengini geri yükle
                    if (activeAreaInput) {
                        activeAreaInput.style.boxShadow = '';
                        activeAreaInput.style.borderColor = areaBorderColors[activeAreaInput.id] || 'var(--border-color)';
                    }
                    activeAreaInput = this;
                    this.style.boxShadow = `0 0 0 3px ${areaBorderColors[this.id] || 'var(--border-color)'}55`;
                    $('#activeAreaLabel').text(areaLabels[this.id] || '');
                    $('#panelKeyboard').show();
                });
                $('#app1s4CheckBtn').on('click', function () {
                    const get = id => (document.getElementById(id) || { value: '' }).value.replace(/\s/g, '').toLowerCase();
                    const vals = { area1: get('area1'), area2: get('area2'), area3: get('area3'), area4: get('area4') };
                    const correct = {
                        area1: ['a²', 'a^2', 'a*a', 'a·a', 'a2'],
                        area2: ['ab', 'a·b', 'a*b', 'ba', 'b·a', 'a×b', 'b×a'],
                        area3: ['ab', 'a·b', 'a*b', 'ba', 'b·a', 'a×b', 'b×a'],
                        area4: ['b²', 'b^2', 'b*b', 'b·b', 'b2'],
                    };
                    const fieldNames = { area1: '2×2 Kare', area2: '1×2 Dikdörtgen', area3: '2×1 Dikdörtgen', area4: '1×1 Kare' };
                    const wrongFields = [];
                    Object.keys(correct).forEach(key => {
                        const ok = correct[key].some(v => vals[key] === v);
                        if (!ok) wrongFields.push(fieldNames[key]);
                        const el = document.getElementById(key);
                        if (el) el.style.borderColor = ok ? 'var(--success-bg)' : 'var(--error-bg)';
                    });
                    if (wrongFields.length === 0) {
                        $(document).off('click.sqkey click.areaovl');
                        $('#areaFeedback').html('<div class="success-message">✓ Tüm bölgeler doğru! a², ab, ab, b²</div>');
                        $('#app1s4NextArea').show();
                        $('#app1s4CheckBtn').hide();
                        $('#panelKeyboard').hide();
                    } else {
                        $('#areaFeedback').html(`<div class="error-message">✗ Yanlış: ${wrongFields.join(', ')} — Sembolik ifade girin (a², ab, b²)</div>`);
                    }
                });
                $('#app1s4Btn').on('click', () => { $(document).off('click.sqkey click.areaovl'); renderApp1Step(5); });
                break;
            case 5:
                $(document).on('click.sqkey2', 'button.sq-key2', function () {
                    const inp = document.getElementById('sumInput');
                    if (!inp) return;
                    const val = $(this).data('val');
                    if (val === '⌫') inp.value = inp.value.slice(0, -1);
                    else inp.value += val;
                });
                $(document).on('click.sqkey3', 'button.sq-key3', function () {
                    const inp = document.getElementById('squareInput');
                    if (!inp) return;
                    const val = $(this).data('val');
                    if (val === '⌫') inp.value = inp.value.slice(0, -1);
                    else inp.value += val;
                });
                $('#sumCheckBtn').on('click', function () {
                    const raw = $('#sumInput').val().replace(/\s/g, '').toLowerCase();
                    const sumCorrect = ['a²+2ab+b²', 'a^2+2ab+b^2', 'a2+2ab+b2'];
                    if (sumCorrect.some(v => raw === v)) {
                        $(document).off('click.sqkey2');
                        $('#sumKeyboard').hide();
                        $('#sumCheckBtn').prop('disabled', true);
                        $('#simplLine').css('display', 'block');
                        $('#sumFeedback').html('<div class="success-message">✓ Doğru! Şimdi geometri tahtasındaki büyük karenin alanını bulunuz.</div>');
                        setTimeout(() => {
                            $('#formulaReveal').show();
                        }, 400);
                    } else {
                        $('#sumFeedback').html('<div class="error-message">✗ Henüz tam değil. İpucu: ab + ab = 2ab olarak yazılır.</div>');
                    }
                });
                $('#squareCheckBtn').on('click', function () {
                    const raw = $('#squareInput').val().replace(/\s/g, '').toLowerCase();
                    const sqCorrect = ['(a+b)²', '(a+b)^2', '(a+b)2'];
                    if (sqCorrect.some(v => raw === v)) {
                        $(document).off('click.sqkey3');
                        $('#squareKeyboard').hide();
                        $('#squareCheckBtn').prop('disabled', true);
                        $('#squareFeedback').html('<div class="success-message">✓ Doğru! Büyük karenin alanı (a+b)²</div>');
                        setTimeout(() => { $('#identityReveal').show(); $('#app1s5NextArea').show(); }, 400);
                    } else {
                        $('#squareFeedback').html('<div class="error-message">✗ İpucu: kenar uzunluğu (a+b), alan = kenar² şeklinde yazılır.</div>');
                    }
                });
                $('#app1s5Btn').on('click', () => { $(document).off('click.sqkey2 click.sqkey3'); renderApp1Step(6); });
                break;
            case 6:
                // Doğru şekil kontrolü: 4 elastik, belirli konumlar ve boyutlar
                function isValidAssess6() {
                    if (elastics.length < 4) return false;
                    const allPins = elastics.flatMap(e => e.pins);
                    const rs = allPins.map(p => p.r), cs = allPins.map(p => p.c);
                    const spanR = Math.max(...rs) - Math.min(...rs);
                    const spanC = Math.max(...cs) - Math.min(...cs);
                    // (a+b) = 5 birim → span 5
                    return spanR === 5 && spanC === 5 && elastics.length >= 4;
                }
                $(document).off('elasticAdded.app1s6 pinSelected.app1s6')
                    .on('elasticAdded.app1s6', function () {
                        if (isValidAssess6()) {
                            $('#assess6Status').html('✓ Şekil tamamlandı! Devam edebilirsiniz.').css('color', 'var(--success-bg)');
                            $('#app1s6BuildBtn').prop('disabled', false);
                            $(document).off('elasticAdded.app1s6 pinSelected.app1s6');
                        } else {
                            const n = elastics.length;
                            $('#assess6Status').text(n + ' bölge oluşturuldu — ' + (4 - n < 0 ? 0 : 4 - n) + ' tane daha ekleyin').css('color', 'var(--text-secondary)');
                        }
                    })
                    .on('pinSelected.app1s6', function (e, data) {
                        $('#assess6Status').text(data.count + ' pin seçildi...').css('color', 'var(--text-secondary)');
                    });
                $('#app1s6BuildBtn').on('click', function () {
                    $(this).hide();
                    $('#assess6QuestionArea').show();
                    if (window.MathJax) MathJax.typesetPromise();
                    // Soru alanında Kontrol Et bağla
                    $('#assess6QuestionArea').find('button').remove();
                    const checkBtn = $('<button class="action-button" id="app1s6CheckBtn" style="margin-top:8px;display:block;width:100%;text-align:center;">Kontrol Et</button>');
                    $('#assess6QuestionArea').append(checkBtn);
                    $('#app1s6CheckBtn').on('click', function () {
                        const val = $('#app1AssessInput').val().trim().replace(',', '.');
                        if (val === '25') {
                            $('#app1AssessFeedback').html(`
                        <div class="success-message" style="text-align:left;line-height:1.8;">
                            ✓ <strong>Doğru!</strong><br>
                            <span style="font-size:.95em;">
                            (2 + 3)² = 2² + 2 · 2 · 3 + 3² = 4 + 12 + 9 = <strong>25</strong>
                            </span><br>
                            <span style="font-size:.88em;opacity:.85;">ya da kısaca: (2 + 3)² = 5² = 25</span>
                        </div>
                    `);
                            if (window.MathJax) MathJax.typesetPromise();
                            $('#app1s6NextArea').show();
                            $(this).hide();
                        } else {
                            $('#app1AssessFeedback').html('<div class="error-message">✗ Yanlış. Tahtadaki büyük karenin kenar uzunluğu (2+3) = 5, o hâlde alanı kaçtır?</div>');
                        }
                    });
                });
                $('#app1FinishBtn').on('click', () => $('[data-tab="app2"]').prop('disabled', false).click());
                break;
        }
    }

    /* ══ UYGULAMA 2: π'yi Görelim ══════════════════════════════════ */
    function loadApp2() {
        clearBoard();
        boardMode = 'draw';
        renderApp2Step(0);
    }

    function renderApp2Step(step) {
        clearBoard();
        boardMode = 'draw';
        const totalSteps = 6;
        const pct = Math.round(((step + 1) / totalSteps) * 100);
        let html = `<div class="progress-container">
        <div class="progress-label"><span>Uygulama 2 — π'yi Görelim</span><span>${step + 1}/${totalSteps}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

        switch (step) {
            case 0:
                html += `<div class="instruction-box">
            <h3>🔵 π'yi Görelim</h3>
            <h4>Hedef</h4>
            <p>İrrasyonel bir sayının (<strong>π</strong>) geometrik yorumunu yapabilmek.</p>
            <h4>Hedeflenen Beceriler</h4>
            <ul>
                <li>İlişkilendirme</li>
                <li>Akıl Yürütme</li>
                <li>İletişim</li>
                <li>Matematiksel Modelleme</li>                
            </ul>
        </div>
        <div class="instruction-box" style="background:rgba(0,212,255,0.08);border-color:var(--border-color);margin-top:8px;">
            <p style="font-size:.93em;color:var(--text-secondary);">📋 <em>Geometri tahtasında çemberlerin olduğu yüz kullanılacaktır.</em></p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app2s0Btn">Başla</button></div>`;
                setTimeout(() => {
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }
                }, 500);
                $('#boardHint').text('🔵 Çemberlerin olduğu arka yüz — π keşfedilecek');
                break;

            case 1:
                html += `<div class="instruction-box">
            <h3>⭕ Çember İnceleme</h3>
            <p>Geometri tahtasının <strong>arka yüzünde</strong> 12 ve 24 pinli çemberler bulunmaktadır.</p>
            <p style="margin-top:8px;">Sağ panelde iki farklı çember gösterilmektedir. Her birini seçerek inceleyebilirsiniz.</p>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <button class="circle-select-btn selected" id="smallCircleBtn">Küçük Çember (12 pin)</button>
                <button class="circle-select-btn" id="bigCircleBtn">Büyük Çember (24 pin)</button>
            </div>
        </div>
        <div style="text-align:center;margin-top:10px;"><button class="action-button" id="app2s1Btn">Devam Et</button></div>`;
                setTimeout(() => {
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }
                }, 300);
                $('#boardHint').text('⭕ Çemberleri seçerek inceleyin');
                break;

            case 2:
                if (typeof window.app2subStep === 'undefined') window.app2subStep = 0;

                if (window.app2subStep === 0) {
                    // ── Diyalog: Formül sorusu
                    html += `<div class="instruction-box">
                <h3>🔵 Büyük Kare ve Çember</h3>
                <p>Hazırlanıyor...</p>
            </div>`;
                    setTimeout(() => {
                        // Sağ paneli çember yüzüne çevir
                        if (threeCamera && threeControls) {
                            threeCamera.position.set(0, 0, -9);
                            threeCamera.lookAt(0, 0, 0);
                            threeControls.target.set(0, 0, 0);
                            threeControls.update();
                        }
                        clearBoard();
                        // Formül diyaloğunu aç
                        $('#app2FormulaDialog').remove();
                        const dlg = `<div class="dialog-overlay" id="app2FormulaDialog" style="display:flex;">
                    <div class="dialog-content" style="max-width:480px;">
                        <h2>⭕ Daire Alanı Formülü</h2>
                        <svg id="formulaSVG" viewBox="0 0 220 220" width="220" height="220"
                            style="display:block;margin:0 auto 14px;background:var(--bg-tertiary);border-radius:50%;border:2px solid var(--border-color);">
                            <circle cx="110" cy="110" r="4" fill="#ffd700"/>
                            <text x="116" y="107" fill="#ffd700" font-size="15" font-family="Segoe UI">O</text>
                            <line x1="110" y1="110" x2="216" y2="110" stroke="#c084fc" stroke-width="2.5" stroke-dasharray="6,3"/>
                            <text x="150" y="105" fill="#c084fc" font-size="15" font-family="Segoe UI">r</text>
                        </svg>
                        <p style="text-align:center;font-size:.95em;margin-bottom:10px;">Yukarıdaki dairenin alan formülünü yazınız:</p>
                        <div style="display:flex;align-items:center;gap:6px;justify-content:center;flex-wrap:wrap;">
                            <span style="font-size:1.1em;font-weight:700;color:var(--text-accent);">A =</span>
                            <input id="formulaInput" type="text" class="input-field"
                                placeholder="Formülü girin..." readonly
                                style="width:170px;text-align:center;font-size:1.1em;cursor:default;"/>
                            <button id="formulaClearBtn" style="padding:6px 10px;border-radius:7px;background:var(--bg-tertiary);border:1.5px solid var(--border-color);color:var(--text-primary);cursor:pointer;font-size:13px;">⌫</button>
                        </div>
                        <!-- Özel klavye -->
                        <div style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:12px;">
                            ${['π', 'r', '²', '(', ')', '+', '-', '·', '0', '1', '2', '3', '4', '5'].map(k =>
                            `<button class="formula-key action-button" data-key="${k}"
                                    style="padding:7px 13px;font-size:1em;min-width:40px;">${k}</button>`
                        ).join('')}
                        </div>
                        <div id="formulaFeedback" style="margin-top:10px;text-align:center;"></div>
                        <div class="dialog-btn-row" style="gap:10px;">
                            <button class="action-button" id="formulaCheckBtn">Kontrol Et</button>
                            <button class="action-button" id="formulaContinueBtn" style="display:none;background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                        </div>
                    </div>
                </div>`;
                        $('body').append(dlg);
                        // Klavye
                        $(document).off('click.fkey').on('click.fkey', '.formula-key', function () {
                            const k = $(this).data('key');
                            $('#formulaInput').val($('#formulaInput').val() + k);
                        });
                        $('#formulaClearBtn').on('click', function () {
                            const v = $('#formulaInput').val();
                            $('#formulaInput').val(v.slice(0, -1));
                        });
                        $('#formulaCheckBtn').on('click', function () {
                            const raw = $('#formulaInput').val().replace(/\s/g, '').toLowerCase();
                            // Kabul: πr², pi*r^2, π·r², πr2 vb.
                            const ok = /^π?pi?[·*]?r[\^²2]?2?$/.test(raw) || raw === 'πr²' || raw === 'πr2' || raw === 'π·r²' || raw === 'π*r²' || raw === 'pir²' || raw === 'pir2';
                            if (ok) {
                                $('#formulaFeedback').html('<div class="success-message">✓ Harika! Daire alanı A = πr² formülüdür.</div>');
                                $('#formulaCheckBtn').hide();
                                $('#formulaContinueBtn').show();
                            } else {
                                $('#formulaFeedback').html('<div class="error-message">✗ Tekrar deneyin. İpucu: π, r ve ² kullanın.</div>');
                            }
                        });
                        $('#formulaContinueBtn').on('click', function () {
                            $(document).off('click.fkey');
                            $('#app2FormulaDialog').remove();
                            window.app2subStep = 1;
                            renderApp2Step(2);
                        });
                    }, 300);
                    $('#boardHint').text('⭕ Çember yüzü — daire alanı formülünü bulun');

                } else if (window.app2subStep === 1) {
                    // ── Büyük kareyi lastikle oluştur (rehber kesikli çizgi)
                    html += `<div class="instruction-box">
                <h3>🔵 Adım 1 — Büyük Kareyi Oluşturun</h3>
                <p>Geometri tahtası üzerinde <strong>büyük kareyi</strong> lastikle çeviriniz.</p>
                <p style="margin-top:8px;font-size:.92em;color:var(--text-secondary);">
                    Kesikli çizgi üzerindeki köşe pinlerini sırasıyla seçip başlangıç pinine dönerek kareyi kapatınız.
                </p>
                <div class="explain-box" style="margin-top:10px;">
                    <p>💡 <strong>[!] Yarıçap uzunluğu: 2 birim</strong></p>
                </div>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app2s2Btn" disabled style="opacity:.4;">Devam Et</button>
            </div>`;
                    // Hedef köşeler (6×6 grid, 0-indexli, köşe pinler = r0c0, r0c5, r5c5, r5c0)
                    window.app2TargetSquare = [{ r: 0, c: 0 }, { r: 0, c: 5 }, { r: 5, c: 5 }, { r: 5, c: 0 }];
                    setTimeout(() => {
                        // Arka yüze (çember yüzü) döndür
                        if (threeCamera && threeControls) {
                            threeCamera.position.set(0, 0, -9);
                            threeCamera.lookAt(0, 0, 0);
                            threeControls.target.set(0, 0, 0);
                            threeControls.update();
                        }
                        clearBoard();

                        // Çember pinlerini tam görünürlüğe döndür
                        backGroup && backGroup.children.forEach(ch => {
                            if (!ch.userData || !ch.userData.isCirclePin) return;
                            ch.material.opacity = 1.0;
                            ch.material.transparent = false;
                        });

                        // 3D rehber: backGroup'a kesikli sarı kare (çember yüzü köşe pinleri arası)
                        if (backGroup && THREE) {
                            // Eski rehberleri temizle
                            backGroup.children
                                .filter(c => c.userData && c.userData.isGuide)
                                .forEach(g => backGroup.remove(g));

                            // Köşe pinleriyle aynı koordinatlar (buildBack'teki corners ile birebir)
                            const half = BOARD3D_SIZE / 2 - 0.25; // = 2.5
                            const bz = -(BOARD3D_THICK / 2 + 0.22);
                            const guideCorners = [
                                new THREE.Vector3(-half, half, bz),
                                new THREE.Vector3(half, half, bz),
                                new THREE.Vector3(half, -half, bz),
                                new THREE.Vector3(-half, -half, bz),
                            ];

                            // Kesikli çizgi (kareyi kapat)
                            const pts = [...guideCorners, guideCorners[0]];
                            const geo = new THREE.BufferGeometry().setFromPoints(pts);
                            const mat = new THREE.LineDashedMaterial({
                                color: 0xffd700, dashSize: 0.18, gapSize: 0.10, linewidth: 2
                            });
                            const line = new THREE.Line(geo, mat);
                            line.computeLineDistances();
                            line.userData.isGuide = true;
                            backGroup.add(line);
                        }
                    }, 400);
                    $('#boardHint').text('📐 Sarı kesikli çizgideki kareyi lastikle oluşturun');

                } else if (window.app2subStep === 2) {
                    html += `<div class="instruction-box">
                <h3>⭕ Adım 2 — İçten Teğet Çemberi Ekleyin</h3>
                <p>Büyük kareye <strong>içten teğet çemberi</strong> lastikle çeviriniz.</p>
                <p style="margin-top:8px;font-size:.92em;color:var(--text-secondary);">Çember, büyük karenin her kenarına tam ortadan değmektedir.</p>
            </div>
            <div style="text-align:center;margin-top:10px;"><button class="action-button" id="app2s2Btn">Devam Et</button></div>`;
                    setTimeout(() => {
                        const circPins = [];
                        for (let i = 0; i < 16; i++) {
                            const a = i * Math.PI / 8;
                            const r = Math.round(3 + 3 * Math.sin(a));
                            const c = Math.round(3 + 3 * Math.cos(a));
                            if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) circPins.push({ r, c });
                        }
                        const uCirc = [];
                        circPins.forEach(p => { if (!uCirc.some(u => u.r === p.r && u.c === p.c)) uCirc.push(p); });
                        if (uCirc.length >= 4) elastics.push({ pins: uCirc, color: '#c084fc', closed: true });
                        if (typeof updateElastics3D === 'function') updateElastics3D();
                    }, 300);
                    $('#boardHint').text('⭕ İçten teğet çemberi (mor) ekleyin');

                } else {
                    html += `<div class="instruction-box">
                <h3>🔷 Adım 3 — İç Kareyi Ekleyin</h3>
                <p>Büyük çember içinde <strong>köşeleri çemberin üzerinde olan kareyi</strong> lastikle çeviriniz.</p>
                <p style="margin-top:8px;font-size:.92em;color:var(--text-secondary);">İç karenin köşeleri tam olarak çember üzerindedir.</p>
            </div>
            <div style="text-align:center;margin-top:10px;"><button class="action-button" id="app2s2Btn">Devam Et</button></div>`;
                    setTimeout(() => {
                        const inSq = [{ r: 0, c: 3 }, { r: 3, c: 6 }, { r: 6, c: 3 }, { r: 3, c: 0 }];
                        elastics.push({ pins: inSq, color: '#3b82f6', closed: true });
                        if (typeof updateElastics3D === 'function') updateElastics3D();
                    }, 300);
                    $('#boardHint').text('📐 Büyük kare (cyan), çember (mor), iç kare (mavi)');
                }
                break;

            case 3:
                html += `<div class="instruction-box">
            <h3>📐 Alan Hesabı ve Eşitsizlik</h3>
            <p>Oluşan şekillerin alanlarını hesaplayınız ve eşitsizlik kullanarak yazınız.</p>
            <div class="explain-box" style="margin-top:10px;">
                <p>💡 <strong>[!] Alan (küçük kare) &lt; Alan (daire) &lt; Alan (büyük kare)</strong></p>
            </div>
            <p style="margin-top:10px;font-size:.93em;">Bilinen değerler:</p>
            <ul style="margin-top:6px;font-size:.92em;">
                <li>Büyük karenin kenar uzunluğu = <strong>4 birim</strong></li>
                <li>Dairenin yarıçap uzunluğu = <strong>2 birim</strong></li>
                <li>Küçük karenin kenar uzunluğu = <strong>2√2 birim</strong></li>
            </ul>
            <p style="margin-top:10px;font-size:.92em;">Bu durumda öğrencilerin ulaşması beklenen sonuç:</p>
            <div style="background:var(--bg-tertiary);border-radius:8px;padding:10px 14px;margin-top:6px;font-size:.95em;line-height:2.2;">
                <div>(2√2)² &lt; 4π &lt; 4²</div>
                <div>8 &lt; 4π &lt; 16</div>
                <div style="color:var(--text-accent);font-weight:700;">∴ <strong>2 &lt; π &lt; 4</strong></div>
            </div>
            <p style="margin-top:10px;font-size:.9em;color:var(--text-secondary);">π sayısının 2 ile 4 sayıları arasında bulunduğu geometri tahtası uygulamasıyla görülmüştür.</p>
            <p style="margin-top:6px;font-size:.9em;color:var(--text-secondary);">📚 <em>Arşimed'in π sayısını hesapladığı çalışmasını araştırınız.</em></p>
        </div>
        <div style="text-align:center;margin-top:10px;"><button class="action-button" id="app2s3Btn">Devam Et</button></div>`;
                $('#boardHint').text('📐 Alan (küçük kare) < Alan (daire) < Alan (büyük kare)');
                break;

            case 4:
                html += `<div class="instruction-box">
            <h3>📏 Ölçme ve Değerlendirme</h3>
            <p><strong>Soru:</strong> Yarıçap uzunluğu 5 birim olan dairenin alanı hangi <strong>tam sayılar arasında</strong> yer almalıdır?</p>
            <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">Cevabınızı "küçük sayı-büyük sayı" formatında yazınız. (Örn: 50-100)</p>
            <input type="text" id="app2AssessInput" class="input-field" placeholder="Örn: 50-100" style="margin-top:8px;">
            <div id="app2AssessFeedback" style="margin-top:6px;"></div>
            <div id="app2AssessNextArea" style="display:none;margin-top:10px;">
                <div class="explain-box">
                    <p>✓ <strong>Çözüm:</strong><br>
                    Alan = πr² = 25π<br>
                    2 &lt; π &lt; 4 eşitsizliği kullanılarak:<br>
                    <strong>50 &lt; 25π &lt; 100</strong><br>
                    Alan 50 ile 100 arasında yer alır.</p>
                </div>
            </div>
        </div>
        <div style="text-align:center;margin-top:10px;">
            <button class="action-button" id="app2AssessCheckBtn">Kontrol Et</button>
            <div id="app2FinishArea" style="display:none;margin-top:10px;">
                <button class="action-button" id="app2FinishBtn" style="background:var(--success-bg);border-color:var(--success-bg);">✓ Uygulama 2 Tamamlandı — Kazanımları Gör</button>
            </div>
        </div>`;
                $('#boardHint').text('🔢 Yarıçap=5 birim → Alan hangi tam sayılar arasında?');
                break;

            case 5:
                html += `<div class="success-message" style="padding:16px;text-align:center;">
            Uygulama 2 Tamamlandı!
        </div>
        <div class="instruction-box" style="margin-top:10px;">
            <h3>🎯 Bu Uygulamada Neler Öğrendik?</h3>
            <ul style="margin-top:8px;line-height:1.9;">
                <li>İrrasyonel bir sayı olan <strong>π'nin geometrik yorumunu</strong> yaptık.</li>
                <li>Geometri tahtasının arka yüzündeki <strong>çemberli yüzü</strong> inceledik (12 ve 24 pin).</li>
                <li>Büyük kare, içten teğet daire ve köşeleri daire üzerinde olan küçük kare oluşturarak <strong>2 &lt; π &lt; 4</strong> sonucuna ulaştık.</li>
                <li>Alan eşitsizliği kullanarak daire alanının sınırlarını hesapladık.</li>
                <li><strong>Arşimed'in π hesabı</strong> hakkında araştırma yaptık.</li>
            </ul>
        </div>
        <div style="text-align:center;margin-top:12px;">
            <button class="action-button" id="app2ToApp3Btn" style="font-size:15px;padding:12px 28px;">
                Uygulama 3'e Geç →
            </button>
        </div>`;
                $('#boardHint').text('🎯 Uygulama 2 tamamlandı!');
                break;
        }

        $('#contentArea').html(html);
        if (window.MathJax) MathJax.typesetPromise();

        switch (step) {
            case 0:
                $('#app2s0Btn').on('click', function () {
                    $('#app2DikkatDialog').remove();
                    const dialogHtml = `
            <div class="dialog-overlay" id="app2DikkatDialog" style="display:flex;">
                <div class="dialog-content" style="max-width:600px;">
                    <h2>🔵 π Şeklini İnceleyelim</h2>
                    <div style="text-align:center;margin-bottom:14px;">
                        <img src="images/uygulama2_dikkat.png" alt="π Dikkat Görseli"
                            style="max-width:100%;max-height:260px;border-radius:12px;border:2px solid var(--border-color);box-shadow:0 0 16px var(--border-glow);object-fit:contain;">
                    </div>
                    <p style="line-height:1.8;font-size:.93em;">Üstteki görselde rakamlar bir dairenin etrafına eş aralıklarla yazılmıştır. 3'ten 1'e bir çizgi çizilmiş ardından 1'den 4'e, 4'ten 1'e, 1'den 5'e, 5'ten 9'a, 9'dan 2'ye, 2'den 6'ya, 6'dan 5'e, 5'ten 3'e devamında da π sayısının diğer basamaklarındaki rakama göre çizgiler çizilmeye devam edilmiştir.</p>
                    <div class="instruction-box" style="margin-top:10px;">
                        <p style="font-size:.9em;">🔍 Bu şekli dikkatlice inceleyiniz. π sayısının basamaklarındaki rakamların daire üzerindeki noktaları nasıl birleştirdiğini gözlemleyiniz. Oluşan geometrik deseni keşfetmeye çalışınız.</p>
                    </div>
                    <div class="dialog-btn-row">
                        <button class="action-button" id="app2DikkatDevamBtn">Devam Et</button>
                    </div>
                </div>
            </div>`;
                    $('body').append(dialogHtml);
                    $('#app2DikkatDevamBtn').on('click', function () {
                        $('#app2DikkatDialog').remove();
                        renderApp2Step(1);
                    });
                });
                break;

            case 1:
                $('#smallCircleBtn').on('click', function () {
                    $(this).addClass('selected');
                    $('#bigCircleBtn').removeClass('selected');
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }
                    // YENİ: Küçük çemberi vurgula, büyüğü solar
                    backGroup && backGroup.children.forEach(ch => {
                        if (!ch.userData || !ch.userData.isCirclePin) return;
                        const isMine = ch.userData.circleType === 'small';
                        ch.material.opacity = isMine ? 1.0 : 0.15;
                        ch.material.transparent = true;
                    });
                });
                $('#bigCircleBtn').on('click', function () {
                    $(this).addClass('selected');
                    $('#smallCircleBtn').removeClass('selected');
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }
                    // YENİ: Büyük çemberi vurgula, küçüğü solar
                    backGroup && backGroup.children.forEach(ch => {
                        if (!ch.userData || !ch.userData.isCirclePin) return;
                        const isMine = ch.userData.circleType === 'big';
                        ch.material.opacity = isMine ? 1.0 : 0.15;
                        ch.material.transparent = true;
                    });
                });
                $('#app2s1Btn').on('click', () => renderApp2Step(2));
                break;

            case 2:
                if (window.app2subStep === 1) {
                    $(document).off('elasticAdded.bigSquare').on('elasticAdded.bigSquare', function () {
                        const target = window.app2TargetSquare;
                        if (!target) return;
                        const found = elastics.some(el => {
                            if (!el.closed || el.pins.length !== 4) return false;
                            return target.every(tp => el.pins.some(p => p.r === tp.r && p.c === tp.c));
                        });
                        if (found) {
                            $(document).off('elasticAdded.bigSquare');
                            window.app2TargetSquare = null;
                            // 3D rehber çizgiyi kaldır
                            if (frontGroup) frontGroup.children.filter(c => c.userData && c.userData.isGuide).forEach(g => frontGroup.remove(g));
                            $('#app2s2Btn').prop('disabled', false).css('opacity', '1');
                            $('#boardHint').text('✅ Harika! Büyük kare oluşturuldu. Devam edebilirsiniz.');
                        }
                    });
                }
                $('#app2s2Btn').on('click', () => {
                    $(document).off('elasticAdded.bigSquare');
                    window._app2RebuildHook = null;
                    if (window.app2subStep === 0) {
                        // subStep 0 → diyalog kendi içinde ilerliyor, buraya gelmemeli
                    } else if (window.app2subStep < 3) {
                        window.app2subStep++;
                        renderApp2Step(2);
                    } else {
                        window.app2subStep = undefined;
                        window.app2TargetSquare = null;
                        renderApp2Step(3);
                    }
                });
                break;

            case 3:
                $('#app2s3Btn').on('click', () => renderApp2Step(4));
                break;

            case 4:
                $('#app2AssessCheckBtn').on('click', function () {
                    const raw = $('#app2AssessInput').val().replace(/\s/g, '');
                    const ok = raw === '50,100' || raw === '50-100' || raw === '50ile100' || (raw.includes('50') && raw.includes('100'));
                    if (ok) {
                        $('#app2AssessFeedback').html('<div class="success-message">✓ Doğru! Alan=25π, 2&lt;π&lt;4 → 50&lt;25π&lt;100</div>');
                        $('#app2AssessNextArea').show();
                        $('#app2FinishArea').show();
                        $(this).hide();
                    } else {
                        $('#app2AssessFeedback').html('<div class="error-message">✗ Yanlış. Alan=πr²=25π. 2&lt;π&lt;4 kullanarak sınırları bul.</div>');
                    }
                });
                $('#app2FinishBtn').on('click', () => renderApp2Step(5));
                break;

            case 5:
                $('#app2ToApp3Btn').on('click', () => {
                    $('[data-tab="app3"]').prop('disabled', false).click();
                });
                break;
        }
    }

    function drawCircleOnBoard(type) {
        elastics = [];
        const cx = 2, cy = 2;
        if (type === 'small' || type === 'both') {
            // Küçük çember: r≈1.5, 8 nokta
            const pins = [];
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4;
                const r = Math.round(cy + 1.5 * Math.sin(angle));
                const c = Math.round(cx + 1.5 * Math.cos(angle));
                if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) pins.push({ r, c });
            }
            if (pins.length >= 4) elastics.push({ pins, color: '#ef4444', closed: true });
        }
        if (type === 'big' || type === 'both') {
            // Büyük çember: r≈2.2, 12 nokta
            const pins = [];
            for (let i = 0; i < 12; i++) {
                const angle = i * Math.PI / 6;
                const r = Math.round(2.5 + 2.2 * Math.sin(angle));
                const c = Math.round(2.5 + 2.2 * Math.cos(angle));
                if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) pins.push({ r, c });
            }
            const unique = [];
            pins.forEach(p => { if (!unique.some(u => u.r === p.r && u.c === p.c)) unique.push(p); });
            if (unique.length >= 4) elastics.push({ pins: unique, color: '#22c55e', closed: true });
        }
        rebuildBoard();
    }

    /* ══ UYGULAMA 3: Konveks Çokgenlerde Açıların Gizemi ═══════════ */
    function loadApp3() {
        clearBoard();
        boardMode = 'draw';
        renderApp3Step(0);
    }

    function renderApp3Step(step) {
        clearBoard();
        boardMode = 'draw';
        const totalSteps = 7;
        const pct = Math.round(((step + 1) / totalSteps) * 100);
        let html = `<div class="progress-container">
        <div class="progress-label"><span>Uygulama 3</span><span>${step + 1}/${totalSteps}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

        switch (step) {
            case 0:
                html += `<div class="instruction-box">
            <h3>🔺 Konveks Çokgenlerde Açıların Gizemi</h3>
            <h4>Hedeflenen Beceriler</h4>
            <ul><li>Akıl Yürütme</li><li>Matematiksel Modelleme</li><li>İletişim</li></ul>
            <h4>Hedefler</h4>
            <p>Çokgenlerin iç açılarının toplamını veren formülü elde edebilmek; kenar sayısı, açı ölçüleri ve köşegen sayısı arasındaki ilişkiyi bulabilmek.</p>
            <h4>Uygulama Aşaması</h4>
            <p>Dersin sonunda konunun derinleşme sürecinde kullanılabilir.</p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3s0Btn">Başla</button></div>`;
                $('#boardHint').text('🔺 Geometri tahtasını hazırlayın');
                break;

            case 1:
                html += `<div class="instruction-box">
            <p>"Bir beşgenin bir köşesinden çizilebilecek <strong>en çok kaç köşegen vardır</strong>?"</p>
            <div id="app3DiagChoices" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                ${[1, 2, 3, 4, 5].map(n => `<button class="num-btn" data-diag="${n}">${n}</button>`).join('')}
            </div>
            <div id="app3DiagFeedback" style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">Seçim yapınız</div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3s1Btn" disabled>Devam Et</button></div>`;
                $('#boardHint').text('Beşgenin bir köşesinden kaç köşegen çizilir?');
                // Beşgen göster
                setTimeout(() => {
                    const pentagon = [{ r: 0, c: 2 }, { r: 1, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 1 }, { r: 2, c: 0 }];
                    elastics.push({ pins: pentagon, color: '#00d4ff', closed: true });
                    rebuildBoard();
                }, 300);
                break;

            case 2:
                html += `<div class="instruction-box">
            <h3>🔺 Üçgen Oluşturma — Dar Açılı</h3>
            <p>Geometri tahtasında <strong>dar açılı bir üçgen</strong> oluşturun.</p>
            <ul>
                <li>Üçgenin bir kenarına <strong>paralel</strong>, o kenarla çakışacak şekilde uzun bir doğru parçası çizin.</li>
                <li>Bu doğru parçasına paralel olan ve <strong>diğer köşesinden geçen</strong> başka bir doğru parçası çizin.</li>
            </ul>
            <p style="margin-top:8px;font-size:.88em;color:var(--text-secondary);">Üç paralel doğruyu üç farklı renkte çiziniz.</p>
            <p style="margin-top:8px;">Üçgenin iç açıları toplamı kaçtır?</p>
            <input type="text" id="triAngleSum" class="input-field" placeholder="Derece cinsinden" inputmode="decimal">
            <div id="triAngleFeedback" style="margin-top:8px;"></div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3s2CheckBtn">Kontrol Et</button></div>
        <div style="display:none;text-align:center;" id="app3s2NextArea"><button class="action-button" id="app3s2Btn">Devam Et</button></div>`;
                setTimeout(() => {
                    // Dar açılı üçgen
                    const tri = [{ r: 0, c: 1 }, { r: 4, c: 0 }, { r: 4, c: 3 }];
                    elastics.push({ pins: tri, color: '#ef4444', closed: true });
                    // Paralel çizgi (üst kenar ile paralel)
                    elastics.push({ pins: [{ r: 4, c: 0 }, { r: 4, c: 5 }], color: '#eab308', closed: false });
                    // Başka paralel
                    elastics.push({ pins: [{ r: 0, c: 1 }, { r: 0, c: 5 }], color: '#22c55e', closed: false });
                    rebuildBoard();
                }, 300);
                $('#boardHint').text('🔺 Dar açılı üçgen — paralel doğrular');
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                break;

            case 3:
                html += `<div class="instruction-box">
            <h3>⬜ Çokgen İç Açı Toplamları</h3>
            <p>Geometri tahtasında sırasıyla <strong>dörtgen, beşgen ve altıgen</strong> oluşturun ve iç açılar toplamını bulun.</p>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <button class="circle-select-btn" id="showQuadBtn">Dörtgen</button>
                    <button class="circle-select-btn" id="showPentBtn">Beşgen</button>
                    <button class="circle-select-btn" id="showHexBtn">Altıgen</button>
                </div>
            </div>
            <div class="area-grid" style="margin-top:12px;">
                <div class="area-cell"><label>Dörtgen (n=4)</label><input type="text" id="quad4" placeholder="?°"></div>
                <div class="area-cell"><label>Beşgen (n=5)</label><input type="text" id="pent5" placeholder="?°"></div>
                <div class="area-cell area-total"><label>Altıgen (n=6)</label><input type="text" id="hex6" placeholder="?°"></div>
            </div>
            <div id="app3s3Feedback" style="margin-top:8px;"></div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3s3CheckBtn">Kontrol Et</button></div>
        <div style="display:none;text-align:center;" id="app3s3NextArea"><button class="action-button" id="app3s3Btn">Devam Et</button></div>`;
                setTimeout(() => {
                    // Dörtgen varsayılan
                    const quad = [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }];
                    elastics.push({ pins: quad, color: '#3b82f6', closed: true });
                    rebuildBoard();
                }, 300);
                $('#boardHint').text('⬜ Çokgenlerin iç açı toplamlarını bulun');
                break;

            case 4:
                html += `<div class="instruction-box">
            <h3>📐 Köşegen Sayısı ve Açı Formülü</h3>
            <p>Bir <strong>n-gon</strong> için:</p>
            <div class="formula-card">
                <div class="formula-text">İç açılar toplamı $= (n-2) \\times 180°$</div>
            </div>
            <p style="margin-top:8px;">Bir köşeden çizilebilecek köşegen sayısı: $(n - 3)$</p>
            <p>Toplam köşegen sayısı: $\\dfrac{n(n-3)}{2}$</p>
            <p style="margin-top:10px;font-weight:700;">Beşgen için köşegen sayısını hesaplayın:</p>
            <input type="text" id="diagCount" class="input-field" placeholder="Cevabınızı girin" inputmode="decimal">
            <div id="diagFeedback" style="margin-top:8px;"></div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3s4CheckBtn">Kontrol Et</button></div>
        <div style="display:none;text-align:center;" id="app3s4NextArea"><button class="action-button" id="app3s4Btn">Devam Et</button></div>`;
                // Beşgen + köşegenler
                setTimeout(() => {
                    const pent = [{ r: 0, c: 2 }, { r: 1, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 1 }, { r: 2, c: 0 }];
                    elastics.push({ pins: pent, color: '#00d4ff', closed: true });
                    // Köşegenler (5 adet)
                    const diagPairs = [[0, 2], [0, 3], [1, 3], [1, 4], [2, 4]];
                    diagPairs.forEach(([i, j]) => {
                        elastics.push({ pins: [pent[i], pent[j]], color: '#ef4444', closed: false });
                    });
                    rebuildBoard();
                }, 300);
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                $('#boardHint').text('🔷 Beşgen ve köşegenleri inceleyin');
                break;

            case 5:
                html += `<div class="instruction-box">
            <h3>📊 Tablo Tamamlama</h3>
            <p>Aşağıdaki tabloyu doldurun:</p>
            <table style="width:100%;border-collapse:collapse;font-size:.85em;margin-top:10px;">
                <tr style="background:var(--bg-tertiary);">
                    <th style="padding:6px;border:1px solid var(--border-color);">n</th>
                    <th style="padding:6px;border:1px solid var(--border-color);">Köşegen</th>
                    <th style="padding:6px;border:1px solid var(--border-color);">İç Açı Toplamı</th>
                </tr>
                ${[[3, '—', '180°'], [4, '2', '360°'], [5, '5', '540°'], [6, '9', '720°']].map(([n, d, a]) => `
                <tr>
                    <td style="padding:6px;border:1px solid var(--border-color);text-align:center;font-weight:700;">${n}</td>
                    <td style="padding:6px;border:1px solid var(--border-color);text-align:center;">${d}</td>
                    <td style="padding:6px;border:1px solid var(--border-color);text-align:center;">${a}</td>
                </tr>`).join('')}
                <tr>
                    <td style="padding:6px;border:1px solid var(--border-color);text-align:center;font-weight:700;">8</td>
                    <td style="padding:6px;border:1px solid var(--border-color);text-align:center;"><input type="text" id="diag8" style="width:60px;background:var(--input-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;padding:3px;text-align:center;" placeholder="?"></td>
                    <td style="padding:6px;border:1px solid var(--border-color);text-align:center;"><input type="text" id="angle8" style="width:60px;background:var(--input-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;padding:3px;text-align:center;" placeholder="?°"></td>
                </tr>
            </table>
            <div id="tableFeedback" style="margin-top:8px;"></div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3s5CheckBtn">Kontrol Et</button></div>
        <div style="display:none;text-align:center;" id="app3s5NextArea"><button class="action-button" id="app3s5Btn">Devam Et</button></div>`;
                // Altıgen göster
                setTimeout(() => {
                    const hex = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                    const validHex = hex.filter(p => p.r >= 0 && p.r < GRID_N && p.c >= 0 && p.c < GRID_N);
                    if (validHex.length >= 4) elastics.push({ pins: validHex, color: '#a855f7', closed: true });
                    rebuildBoard();
                }, 300);
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                break;

            case 6:
                html += `<div class="success-message" style="padding:18px;font-size:1.05em;">Tebrikler! Uygulama 3 tamamlandı!</div>
        <div class="instruction-box">
            <h3>Öğrendikleriniz</h3>
            <ul>
                <li>Konveks bir n-genin iç açıları toplamı: <strong>$(n-2)×180°$</strong></li>
                <li>Bir köşeden çizilebilecek köşegen sayısı: <strong>$n-3$</strong></li>
                <li>Toplam köşegen sayısı: <strong>$\\dfrac{n(n-3)}{2}$</strong></li>
                <li>Geometri tahtası üzerinde çokgenler modellediniz.</li>
            </ul>
        </div>
        <div style="text-align:center;"><button class="action-button" id="app3FinishBtn">Derinleştirme'ye Geç</button></div>`;
                clearBoard();
                setTimeout(() => {
                    const hex = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                    const validHex = hex.filter(p => p.r >= 0 && p.r < GRID_N && p.c >= 0 && p.c < GRID_N);
                    if (validHex.length >= 4) elastics.push({ pins: validHex, color: '#00d4ff', closed: true });
                    const diagPairs3 = [[0, 2], [0, 3], [0, 4], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 5]];
                    diagPairs3.forEach(([i, j]) => {
                        if (validHex[i] && validHex[j]) elastics.push({ pins: [validHex[i], validHex[j]], color: '#ef4444', closed: false });
                    });
                    rebuildBoard();
                }, 300);
                $('[data-tab="deep"]').prop('disabled', false);
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                break;
        }

        $('#contentArea').html(html);
        if (window.MathJax) MathJax.typesetPromise();

        switch (step) {
            case 0: $('#app3s0Btn').on('click', () => renderApp3Step(1)); break;
            case 1:
                $(document).off('click.app3diag').on('click.app3diag', '#app3DiagChoices .num-btn', function () {
                    const n = parseInt($(this).data('diag'));
                    if (n === 2) {
                        $(this).addClass('correct');
                        $('#app3DiagChoices .num-btn').prop('disabled', true);
                        $('#app3DiagFeedback').html('✓ Doğru! Beşgenin bir köşesinden <strong>2</strong> köşegen çizilebilir (n-3 = 5-3 = 2)').css('color', 'var(--success-bg)');
                        $('#app3s1Btn').prop('disabled', false);
                        $(document).off('click.app3diag');
                    } else {
                        $(this).addClass('incorrect');
                        setTimeout(() => $(this).removeClass('incorrect'), 800);
                        $('#app3DiagFeedback').text('İpucu: Kendi köşesi ve komşu 2 köşe hariç kaç köşeye çizilir?').css('color', 'var(--error-bg)');
                    }
                });
                $('#app3s1Btn').on('click', () => { $(document).off('click.app3diag'); renderApp3Step(2); });
                break;
            case 2:
                $('#app3s2CheckBtn').on('click', function () {
                    const v = parseFloat($('#triAngleSum').val().replace(',', '.'));
                    if (v === 180) {
                        $('#triAngleFeedback').html('<div class="success-message">✓ Doğru! Üçgenin iç açıları toplamı 180°</div>');
                        $('#app3s2NextArea').show(); $(this).hide();
                    } else {
                        $('#triAngleFeedback').html('<div class="error-message">✗ Yanlış. Üçgenin iç açıları toplamı kaç derecedir?</div>');
                    }
                });
                $('#app3s2Btn').on('click', () => renderApp3Step(3));
                break;
            case 3:
                $('#showQuadBtn').on('click', function () {
                    $(this).addClass('selected'); $('#showPentBtn,#showHexBtn').removeClass('selected');
                    clearBoard();
                    setTimeout(() => { elastics.push({ pins: [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }], color: '#3b82f6', closed: true }); rebuildBoard(); }, 200);
                });
                $('#showPentBtn').on('click', function () {
                    $(this).addClass('selected'); $('#showQuadBtn,#showHexBtn').removeClass('selected');
                    clearBoard();
                    setTimeout(() => { elastics.push({ pins: [{ r: 0, c: 2 }, { r: 1, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 1 }, { r: 2, c: 0 }], color: '#22c55e', closed: true }); rebuildBoard(); }, 200);
                });
                $('#showHexBtn').on('click', function () {
                    $(this).addClass('selected'); $('#showQuadBtn,#showPentBtn').removeClass('selected');
                    clearBoard();
                    setTimeout(() => {
                        const h = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                        const vh = h.filter(p => p.r >= 0 && p.r < GRID_N && p.c >= 0 && p.c < GRID_N);
                        if (vh.length >= 4) elastics.push({ pins: vh, color: '#a855f7', closed: true }); rebuildBoard();
                    }, 200);
                });
                $('#app3s3CheckBtn').on('click', function () {
                    const q = parseInt($('#quad4').val());
                    const p = parseInt($('#pent5').val());
                    const h = parseInt($('#hex6').val());
                    if (q === 360 && p === 540 && h === 720) {
                        $('#app3s3Feedback').html('<div class="success-message">✓ Doğru! 360°, 540°, 720°</div>');
                        $('#app3s3NextArea').show(); $(this).hide();
                    } else {
                        $('#app3s3Feedback').html('<div class="error-message">✗ Kontrol edin. Formül: (n-2)×180°</div>');
                    }
                });
                $('#app3s3Btn').on('click', () => renderApp3Step(4));
                break;
            case 4:
                $('#app3s4CheckBtn').on('click', function () {
                    const v = parseInt($('#diagCount').val());
                    if (v === 5) {
                        $('#diagFeedback').html('<div class="success-message">✓ Doğru! n(n-3)/2 = 5×2/2 = 5 köşegen</div>');
                        $('#app3s4NextArea').show(); $(this).hide();
                    } else {
                        $('#diagFeedback').html('<div class="error-message">✗ Yanlış. Formül: n(n-3)/2, n=5 için hesaplayın.</div>');
                    }
                });
                $('#app3s4Btn').on('click', () => renderApp3Step(5));
                break;
            case 5:
                $('#app3s5CheckBtn').on('click', function () {
                    const d8 = parseInt($('#diag8').val());
                    const a8 = parseInt($('#angle8').val());
                    if (d8 === 20 && a8 === 1080) {
                        $('#tableFeedback').html('<div class="success-message">✓ Doğru! 8-gen: köşegen=8×5/2=20, açı=(8-2)×180=1080°</div>');
                        $('#app3s5NextArea').show(); $(this).hide();
                    } else {
                        $('#tableFeedback').html('<div class="error-message">✗ Yanlış. n=8: köşegen=n(n-3)/2=20, iç açı toplamı=(n-2)×180=1080°</div>');
                    }
                });
                $('#app3s5Btn').on('click', () => renderApp3Step(6));
                break;
            case 6:
                $('#app3FinishBtn').on('click', () => $('[data-tab="deep"]').prop('disabled', false).click());
                break;
        }
    }

    /* ══ DERİNLEŞTİRME ═══════════════════════════════════════════ */
    function loadDeep() {
        clearBoard();
        boardMode = 'draw';
        let html = `<div class="instruction-box">
        <h3>🔍 Derinleştirme</h3>
        <p>Öğrencilerin öğrenmiş oldukları kazanımları kullanarak alt kazanımlar elde etmeleri, kavramsal anlama yeteneklerini geliştirmeleri ve pekiştirmeleri hedeflenir.</p>
        <h4>Serbest Keşif</h4>
        <p>Aşağıdaki soruları araştırın ve geometri tahtasını kullanarak modeller oluşturun.</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
        <button class="option-button" id="deepQ1Btn">1. $(a-b)^2$ özdeşliğini geometri tahtasında gösterin.</button>
        <button class="option-button" id="deepQ2Btn">2. Bir 10-genin iç açılar toplamı ve köşegen sayısını hesaplayın.</button>
        <button class="option-button" id="deepQ3Btn">3. Çapı 10 birim olan dairenin alanı kaç ile kaç arasındadır?</button>
    </div>
    <div id="deepAnswer" style="margin-top:12px;"></div>`;

        $('#contentArea').html(html);
        if (window.MathJax) MathJax.typesetPromise();

        $('#deepQ1Btn').on('click', function () {
            clearBoard();
            setTimeout(() => {
                // (a-b)² görselleştirme: a=3, b=1 → (3-1)²=4 = 2×2 kare
                drawSquare(0, 0, 3, '#3b82f6');   // a²
                drawSquare(0, 2, 1, '#ef4444');   // b² (çıkartılacak köşe)
                elastics.push({ pins: [{ r: 0, c: 0 }, { r: 0, c: 2 }, { r: 2, c: 2 }, { r: 2, c: 0 }], color: '#22c55e', closed: true }); // (a-b)²
                rebuildBoard();
            }, 300);
            $('#deepAnswer').html(`<div class="explain-box"><p>
            $(a-b)^2 = a^2 - 2ab + b^2$<br>
            Büyük kare $a^2$'den dikdörtgenler çıkartılınca küçük kare kalır.<br>
            a=3, b=1 → $(3-1)^2 = 4 = 2^2$ ✓
        </p></div>`);
            if (window.MathJax) MathJax.typesetPromise();
        });
        $('#deepQ2Btn').on('click', function () {
            clearBoard();
            $('#deepAnswer').html(`<div class="explain-box"><p>
            <strong>10-gen:</strong><br>
            İç açılar toplamı = $(10-2) \\times 180° = 1440°$<br>
            Köşegen sayısı = $\\dfrac{10 \\times (10-3)}{2} = \\dfrac{70}{2} = 35$
        </p></div>`);
            if (window.MathJax) MathJax.typesetPromise();
        });
        $('#deepQ3Btn').on('click', function () {
            clearBoard();
            setTimeout(() => {
                const cp = [];
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    const r = Math.round(2 + 2 * Math.sin(a)), c = Math.round(2 + 2 * Math.cos(a));
                    if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) cp.push({ r, c });
                }
                if (cp.length >= 4) elastics.push({ pins: cp, color: '#a855f7', closed: true });
                rebuildBoard();
            }, 300);
            $('#deepAnswer').html(`<div class="explain-box"><p>
            Çap = 10 birim → yarıçap r = 5 birim<br>
            Alan = $\\pi r^2 = 25\\pi$<br>
            $2 &lt; \\pi &lt; 4$ olduğundan: $50 &lt; 25\\pi &lt; 100$<br>
            <strong>Alan 50 ile 100 arasındadır.</strong>
        </p></div>`);
            if (window.MathJax) MathJax.typesetPromise();
        });

        // Sağ panelde serbest çizim
        $('#boardHint').text('📌 Serbest keşif — pinlere tıklayarak şekil oluşturun');
    }

    function renderDeepStep(step) {
        clearBoard();
        const totalSteps = 3;
        const pct = Math.round(((step + 1) / totalSteps) * 100);
        let html = `<div class="progress-container">
        <div class="progress-label"><span>Derinleştirme</span><span>${step + 1}/${totalSteps}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

        switch (step) {
            case 0:
                html += `<div class="instruction-box">
            <h3>🔬 Derinleştirme</h3>
            <p>Öğrencilerin öğrenmiş oldukları kazanımları kullanarak <strong>alt kazanımlar</strong> elde etmeleri, kavramsal anlama yeteneklerini geliştirmeleri ve pekiştirmeleri hedeflenir.</p>
            <h4>Öneriler</h4>
            <ul>
                <li>Farklı çokgenler deneyin</li>
                <li>$(a-b)^2$ özdeşliğini modelleyin</li>
                <li>π'yi farklı çemberlerle doğrulayın</li>
            </ul>
            <p style="margin-top:8px;font-size:.88em;color:var(--text-secondary);">Sağ paneldeki tahta <strong>serbesttir</strong> — istediğiniz şekli oluşturabilirsiniz.</p>
        </div>
        <div style="text-align:center;"><button class="action-button" id="deepS0Btn">Başla</button></div>`;
                $('#boardHint').text('📌 Serbest keşif — istediğiniz şekli çizin');
                break;
            case 1:
                html += `<div class="instruction-box">
            <h3>🎨 Serbest Keşif</h3>
            <p>Geometri tahtası üzerinde <strong>istediğiniz şekli</strong> oluşturun.</p>
            <p style="margin-top:8px;">Pinlere tıklayarak şekil oluşturabilir, lastik rengini sol araç çubuğundan seçebilirsiniz.</p>
            <div style="margin-top:12px;padding:8px;background:var(--bg-tertiary);border-radius:7px;">
                <strong>Dene:</strong> $(a-b)^2 = a^2 - 2ab + b^2$
                <br><span style="font-size:.85em;color:var(--text-secondary);">Büyük bir kareden iki dikdörtgen çıkarıp küçük kare ekleyin.</span>
            </div>
        </div>
        <div style="text-align:center;"><button class="action-button" id="deepS1Btn">Devam Et</button></div>`;
                boardMode = 'draw';
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                break;
            case 2:
                html += `<div class="instruction-box">
            <h3>📝 Ek Soru</h3>
            <p>$(a + b)^2 - 4ab$ ifadesinin eşiti nedir?</p>
        </div>
        <div id="deepChoices" style="margin-top:8px;">
            <button class="option-button" data-dc="1">$(a - b)^2$</button>
            <button class="option-button" data-dc="2">$(a + b)^2$</button>
            <button class="option-button" data-dc="3">$4ab$</button>
            <button class="option-button" data-dc="4">$a^2 + b^2$</button>
        </div>
        <div id="deepFeedback" style="margin-top:8px;"></div>
        <div style="display:none;text-align:center;" id="deepFinishArea">
            <div class="success-message" style="margin-top:12px;">Tüm etkinlikler tamamlandı!</div>
            <button class="action-button" id="deepFinishBtn" style="margin-top:10px;">Başa Dön</button>
        </div>`;
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
                break;
        }

        $('#contentArea').html(html);
        if (window.MathJax) MathJax.typesetPromise();

        switch (step) {
            case 0: $('#deepS0Btn').on('click', () => renderDeepStep(1)); break;
            case 1: $('#deepS1Btn').on('click', () => renderDeepStep(2)); break;
            case 2:
                $(document).off('click.dc').on('click.dc', '[data-dc]', function () {
                    if ($(this).prop('disabled')) return;
                    const dc = parseInt($(this).data('dc'));
                    if (dc === 1) {
                        $(this).addClass('correct');
                        $('[data-dc]').prop('disabled', true);
                        $('#deepFeedback').html('<div class="explain-box"><p>✓ Doğru!<br>$(a+b)^2 - 4ab = a^2 + 2ab + b^2 - 4ab = a^2 - 2ab + b^2 = (a-b)^2$</p></div>');
                        if (window.MathJax) MathJax.typesetPromise();
                        $('#deepFinishArea').show();
                        $(document).off('click.dc');
                    } else {
                        $(this).addClass('incorrect');
                        setTimeout(() => $(this).removeClass('incorrect'), 800);
                        $('#deepFeedback').html('<div class="error-message">✗ İpucu: $(a+b)^2$ açıp $4ab$ çıkarın.</div>');
                        if (window.MathJax) MathJax.typesetPromise();
                    }
                });
                $('#deepFinishBtn').on('click', function () {
                    $(document).off('click.dc');
                    clearBoard();
                    boardMode = 'draw';
                    $('.tab-button').removeClass('active');
                    $('[data-tab="intro"]').addClass('active');
                    loadTab('intro');
                });
                break;
        }
    }

    /* ══ MOBİL TOOLBAR TOGGLE ══════════════════════════════════════ */
    const $tbToggle = $('#tbToggleBtn');
    const $toolbar = $('#sideToolbar');

    function checkMobile() {
        if (window.innerWidth <= 640) {
            $tbToggle.show();
        } else {
            $tbToggle.hide();
            $toolbar.removeClass('tb-visible');
            $tbToggle.removeClass('tb-open');
        }
    }
    checkMobile();
    $(window).on('resize', checkMobile);

    $tbToggle.on('click', function () {
        const isOpen = $toolbar.hasClass('tb-visible');
        $toolbar.toggleClass('tb-visible', !isOpen);
        $tbToggle.toggleClass('tb-open', !isOpen);
    });

    /* ══ MOBİL TOOLBAR TOGGLE ════════════════════════════════════ */
    $('#tbToggleBtn').on('click', function () {
        $(this).toggleClass('tb-open');
        $('#sideToolbar').toggleClass('tb-visible');
    });
    $(document).on('click', function (e) {
        if (window.innerWidth <= 640) {
            if (!$(e.target).closest('#sideToolbar,#tbToggleBtn').length) {
                $('#sideToolbar').removeClass('tb-visible');
                $('#tbToggleBtn').removeClass('tb-open');
            }
        }
    });

    /* ══ THREE.JS 3D TAHTA MODELİ ══════════════════════════════════════════ */
    let boardGroup = null;   // tek grup: ön+arka yüz birlikte
    let boardMesh3D = null;   // tahta gövdesi (döndürmek için referans)

    /* ── 3D Pin seçim durumu ── */
    let pins3DObjects = [];   // [{mesh, r, c}]
    let selected3DPins = [];   // [{r,c}, ...]
    let elastics3D = [];   // [{pins:[{r,c},...], color, tubeGroup}]
    let raycaster3D = new THREE.Raycaster();
    let mouse3D = new THREE.Vector2();
    let isDragging3D = false;
    let mouseDownPos3D = { x: 0, y: 0 };

    const BOARD_SIZE_3D = 5;
    const BOARD_THICK = 0.35;
    const PIN_ROWS = 6;
    const PIN_COLS = 6;

    function getThemeColors() {
        const dark = currentTheme === 'dark';
        return {
            board: dark ? 0x1a3a6b : 0x2563eb,
            boardEdge: dark ? 0x0d2244 : 0x1d4ed8,
            pin: dark ? 0x4a9fd4 : 0x93c5fd,
            bg: dark ? '#0a0e27' : '#e8eef5',
        };
    }

    /* ── Three.js başlatma ── */
    /* ══ THREE.JS — 3D GEOMETRİ TAHTASI ════════════════════════════ */
    let threeRenderer = null, threeScene = null, threeCamera = null, threeControls = null;
    let threeAnimId = null;
    let currentFace = 'front'; // 'front' | 'back'
    let frontGroup = null, backGroup = null;
    let pinMeshes = []; // 3D'deki pin mesh'leri
    let elasticMeshes = []; // 3D'deki lastik mesh'leri
    let is3DPinSelectMode = false; // Pin seçim modu aktif mi
    let dragStarted = false; // OrbitControls drag algılama

    const GRID3D_N = 6;
    const PIN3D_GAP = 1.0;
    const PIN3D_R = 0.08;
    const BOARD3D_SIZE = 5.5;
    const BOARD3D_THICK = 0.18;

    function initThreeJS() {
        if (threeRenderer) return; // Zaten başlatıldı

        const container = document.getElementById('threeContainer');
        const canvas = document.getElementById('threeCanvas');

        // Renderer
        threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        threeRenderer.setPixelRatio(window.devicePixelRatio);
        threeRenderer.setSize(container.clientWidth, container.clientHeight);
        threeRenderer.shadowMap.enabled = true;

        // Scene
        threeScene = new THREE.Scene();
        threeScene.background = new THREE.Color(currentTheme === 'dark' ? 0x0a0e27 : 0xf0f4f8);

        // Camera
        threeCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        threeCamera.position.set(0, 0, 9);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        threeScene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 8, 6);
        dirLight.castShadow = true;
        threeScene.add(dirLight);
        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
        fillLight.position.set(-4, -3, 4);
        threeScene.add(fillLight);

        // OrbitControls
        threeControls = new THREE.OrbitControls(threeCamera, canvas);
        threeControls.enableDamping = true;
        threeControls.dampingFactor = 0.08;
        threeControls.rotateSpeed = 0.7;
        threeControls.zoomSpeed = 1.0;
        threeControls.minDistance = 4;
        threeControls.maxDistance = 20;
        threeControls.addEventListener('start', () => { dragStarted = false; });
        threeControls.addEventListener('change', () => { dragStarted = true; });

        // Board groups
        frontGroup = new THREE.Group();
        backGroup = new THREE.Group();
        threeScene.add(frontGroup);
        threeScene.add(backGroup);

        buildFront();
        buildBack();

        // Resize observer
        const ro = new ResizeObserver(() => {
            const w = container.clientWidth, h = container.clientHeight;
            threeCamera.aspect = w / h;
            threeCamera.updateProjectionMatrix();
            threeRenderer.setSize(w, h);
        });
        ro.observe(container);

        // Animate
        function animate() {
            threeAnimId = requestAnimationFrame(animate);
            threeControls.update();
            // Tahtanın hangi yüzünün kameraya baktığını otomatik algıla
            autoDetectFace();
            threeRenderer.render(threeScene, threeCamera);
        }
        animate();

        // Raycasting ile pin tıklama — drag ile çakışmasın
        let _ptrDownPos = { x: 0, y: 0 };
        canvas.addEventListener('pointerdown', (e) => { _ptrDownPos = { x: e.clientX, y: e.clientY }; dragStarted = false; });
        canvas.addEventListener('pointerup', (e) => {
            const dx = e.clientX - _ptrDownPos.x, dy = e.clientY - _ptrDownPos.y;
            if (Math.sqrt(dx * dx + dy * dy) < 12) onThreePinClick(e);
        });
    }

    function autoDetectFace() {
        // Kameranın z yönüne göre ön/arka yüzü belirle (board z ekseninde döner)
        // frontGroup z=0.09, backGroup z=-0.09 (board merkezi)
        // Kamera z > 0 ise ön yüz görünür, z < 0 ise arka yüz
        if (!threeCamera || !frontGroup || !backGroup) return;
        const camZ = threeCamera.position.z;
        // Board'ın dünya z'si (group rotation'a göre)
        // Basit yöntem: frontGroup normal vektörünü hesapla
        const normal = new THREE.Vector3(0, 0, 1);
        normal.applyQuaternion(frontGroup.parent ? frontGroup.parent.quaternion : new THREE.Quaternion());
        const dot = normal.dot(threeCamera.position.clone().normalize());
        // dot > 0 → ön yüz kameraya bakıyor
        currentFace = dot >= 0 ? 'front' : 'back';
    }

    function buildFront() {
        // Eski içeriği temizle
        while (frontGroup.children.length) frontGroup.remove(frontGroup.children[0]);
        pinMeshes = [];

        const boardColor = currentTheme === 'dark' ? 0x1a3a6b : 0x2563eb;
        const pinColor = currentTheme === 'dark' ? 0x4a9fd4 : 0x93c5fd;

        // Ana tahta (ön yüz)
        const boardGeo = new THREE.BoxGeometry(BOARD3D_SIZE, BOARD3D_SIZE, BOARD3D_THICK);
        const boardMat = new THREE.MeshPhongMaterial({ color: boardColor, shininess: 40, side: THREE.DoubleSide });
        const boardMesh = new THREE.Mesh(boardGeo, boardMat);
        boardMesh.receiveShadow = true;
        frontGroup.add(boardMesh);

        // Kenarlık (çerçeve)
        const edgeMat = new THREE.MeshPhongMaterial({ color: 0x00d4ff, emissive: 0x003366, shininess: 80 });
        const frameGeo = new THREE.BoxGeometry(BOARD3D_SIZE + 0.12, BOARD3D_SIZE + 0.12, BOARD3D_THICK - 0.04);
        const frameMesh = new THREE.Mesh(frameGeo, new THREE.MeshPhongMaterial({
            color: 0x1155aa, wireframe: false, transparent: true, opacity: 0.0
        }));
        frontGroup.add(frameMesh);

        // Kenar çizgileri
        const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD3D_SIZE, BOARD3D_SIZE, BOARD3D_THICK));
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, linewidth: 2 });
        const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
        frontGroup.add(edgeLines);

        // 6×6 pin grid
        const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
        const pinGeo = new THREE.CylinderGeometry(PIN3D_R, PIN3D_R * 0.8, 0.22, 12);

        for (let r = 0; r < GRID3D_N; r++) {
            for (let c = 0; c < GRID3D_N; c++) {
                const mat = new THREE.MeshPhongMaterial({ color: pinColor, shininess: 60, emissive: 0x001122 });
                const pin = new THREE.Mesh(pinGeo, mat);
                const x = offset + c * PIN3D_GAP;
                const y = -(offset + r * PIN3D_GAP); // y ekseni ters (satır aşağı gider)
                pin.position.set(x, y, BOARD3D_THICK / 2 + 0.08);
                pin.rotation.x = Math.PI / 2;
                pin.castShadow = true;
                pin.userData = { r, c, isPinMesh: true };
                frontGroup.add(pin);
                pinMeshes.push(pin);
            }
        }

        // Mevcut elastikleri 3D'ye çiz
        updateElastics3D();
    }

    function buildBack() {
        // Eski içeriği temizle
        while (backGroup.children.length) backGroup.remove(backGroup.children[0]);

        const boardColor = currentTheme === 'dark' ? 0x1a3a6b : 0x2563eb;

        // Arka tahta
        const boardGeo = new THREE.BoxGeometry(BOARD3D_SIZE, BOARD3D_SIZE, BOARD3D_THICK);
        const boardMat = new THREE.MeshPhongMaterial({ color: boardColor, shininess: 40 });
        const boardMesh = new THREE.Mesh(boardGeo, boardMat);
        boardMesh.position.z = -0.001; // Çok az arkada
        boardMesh.receiveShadow = true;
        boardMesh.userData.isBoard = true;
        backGroup.add(boardMesh);

        // Kenar çizgileri
        const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD3D_SIZE, BOARD3D_SIZE, BOARD3D_THICK));
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x00d4ff });
        const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
        backGroup.add(edgeLines);

        // Arka yüz pinleri: köşelerde 4 pin
        const cornerPinColor = 0x93c5fd;
        const cornerPinGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.22, 12);
        const corners = [
            [-BOARD3D_SIZE / 2 + 0.25, BOARD3D_SIZE / 2 - 0.25],
            [BOARD3D_SIZE / 2 - 0.25, BOARD3D_SIZE / 2 - 0.25],
            [BOARD3D_SIZE / 2 - 0.25, -BOARD3D_SIZE / 2 + 0.25],
            [-BOARD3D_SIZE / 2 + 0.25, -BOARD3D_SIZE / 2 + 0.25],
        ];
        corners.forEach(([x, y]) => {
            const mat = new THREE.MeshPhongMaterial({ color: cornerPinColor });
            const pin = new THREE.Mesh(cornerPinGeo, mat);
            pin.position.set(x, y, -(BOARD3D_THICK / 2 + 0.08));
            pin.rotation.x = Math.PI / 2;
            backGroup.add(pin);
        });

        // İç çember (12 pin → r=1.2)
        drawCircleBack(12, 1.2, 0xef4444);
        // Dış çember (24 pin → r=2.2)
        drawCircleBack(24, 2.2, 0x22c55e);
    }

    function drawCircleBack(pinCount, radius, color) {
        const pinGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.20, 10);
        const mat = new THREE.MeshPhongMaterial({ color, emissive: 0x001100, shininess: 50 });
        // Çizgi (halka)
        const ringPoints = [];
        for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            ringPoints.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, -(BOARD3D_THICK / 2 + 0.01)));
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
        const ringMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        backGroup.add(new THREE.Line(ringGeo, ringMat));
        // Pinler
        for (let i = 0; i < pinCount; i++) {
            const a = (i / pinCount) * Math.PI * 2;
            const pin = new THREE.Mesh(pinGeo, mat.clone());
            pin.position.set(Math.cos(a) * radius, Math.sin(a) * radius, -(BOARD3D_THICK / 2 + 0.08));
            pin.rotation.x = Math.PI / 2;
            pin.userData = { isCirclePin: true, circleType: pinCount === 24 ? 'big' : 'small', idx: i, baseColor: color };
            backGroup.add(pin);
        }
    }

    /* 3D'de lastikleri güncelle */
    function updateElastics3D() {
        if (!frontGroup) return;
        // Önceki lastik mesh'lerini kaldır
        elasticMeshes.forEach(m => frontGroup.remove(m));
        elasticMeshes = [];

        const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
        function pin3DPos(r, c) {
            return new THREE.Vector3(
                offset + c * PIN3D_GAP,
                -(offset + r * PIN3D_GAP),
                BOARD3D_THICK / 2 + 0.18
            );
        }

        elastics.forEach(el => {
            if (el.pins.length < 2) return;
            const points = el.pins.map(p => pin3DPos(p.r, p.c));
            if (el.closed && el.pins.length >= 3) points.push(points[0].clone());

            // TubeGeometry ile gerçekçi lastik
            const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
            const tubeGeo = new THREE.TubeGeometry(curve, Math.max(points.length * 4, 20), 0.028, 8, false);
            const color = parseInt(el.color.replace('#', ''), 16);
            const tubeMat = new THREE.MeshPhongMaterial({
                color, shininess: 80, emissive: color,
                emissiveIntensity: 0.15, transparent: true, opacity: 0.92
            });
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            tube.castShadow = true;
            frontGroup.add(tube);
            elasticMeshes.push(tube);

            // Pinlerde parlama efekti
            el.pins.forEach(p => {
                const idx = p.r * GRID3D_N + p.c;
                if (pinMeshes[idx]) {
                    pinMeshes[idx].material.emissive.setHex(color);
                    pinMeshes[idx].material.emissiveIntensity = 0.25;
                }
            });
        });

        // Seçili pinleri vurgula
        selectedPins.forEach(p => {
            const idx = p.r * GRID3D_N + p.c;
            if (pinMeshes[idx]) {
                pinMeshes[idx].material.color.setHex(0xffd700);
                pinMeshes[idx].material.emissive.setHex(0x664400);
                pinMeshes[idx].material.emissiveIntensity = 0.5;
                pinMeshes[idx].scale.setScalar(1.4);
            }
        });
    }

    /* 3D pin tıklama — raycasting: hem ön yüz grid pinleri hem arka yüz çember pinleri */
    function onThreePinClick(e) {
        if (!threeRenderer) return;

        const canvas = document.getElementById('threeCanvas');
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const ray = new THREE.Raycaster();
        ray.setFromCamera(mouse, threeCamera);

        // Ön yüz grid pinleri
        const frontHits = ray.intersectObjects(pinMeshes, false);
        if (frontHits.length > 0) {
            const pin = frontHits[0].object;
            const { r, c } = pin.userData;
            animatePinSelect(pin);
            handleGridPinClick3D(r, c);
            return;
        }

        // Arka yüz çember pinleri
        const backPinMeshes = backGroup.children.filter(ch => ch.isMesh && ch.userData.isCirclePin);
        const backHits = ray.intersectObjects(backPinMeshes, false);
        if (backHits.length > 0) {
            const pin = backHits[0].object;
            handleCirclePinClick3D(pin);
            return;
        }
    }

    /* Seçili pin listesi ve lastik için ortak state */
    let selected3DPinsAll = []; // [{type:'grid',r,c,mesh,key} | {type:'circle',circleType,idx,mesh,key}]

    function handleGridPinClick3D(r, c) {
        const key = `grid-${r}-${c}`;

        // İlk pine geri dönüş → kapalı çokgen oluştur (3+ pin varsa)
        if (selected3DPinsAll.length >= 3) {
            const first = selected3DPinsAll[0];
            if (first.type === 'grid' && first.r === r && first.c === c) {
                _commitGridPolygon(true);
                return;
            }
        }

        const existIdx = selected3DPinsAll.findIndex(p => p.type === 'grid' && p.r === r && p.c === c);
        if (existIdx >= 0) {
            // Zaten seçili → kaldır
            selected3DPinsAll.splice(existIdx, 1);
            updatePinSelectionColors();
            updatePreview3D();
            return;
        }
        // Limit kontrolü: yeni lastik başlatılacaksa (henüz pin seçili değilse) limit dolu mu?
        if (selected3DPinsAll.length === 0 && getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) {
            const colorName = ELASTIC_COLORS.find(c => c.hex === currentElasticColor)?.name;
            showLimitToast(colorName);
            return;
        }
        const mesh = pinMeshes.find(m => m.userData.r === r && m.userData.c === c);
        selected3DPinsAll.push({ type: 'grid', r, c, mesh, key });
        updatePinSelectionColors();
        updatePreview3D();
        // pinSelected olayını tetikle (adım 3/8 durumu güncellemesi için)
        $(document).trigger('pinSelected', { r, c, count: selected3DPinsAll.length });
    }

    function handleCirclePinClick3D(pinMesh) {
        const { circleType, idx } = pinMesh.userData;
        const key = `circle-${circleType}-${idx}`;

        const existIdx = selected3DPinsAll.findIndex(p => p.key === key);
        if (existIdx >= 0) {
            selected3DPinsAll.splice(existIdx, 1);
            pinMesh.material.color.setHex(pinMesh.userData.baseColor || 0xef4444);
            pinMesh.material.emissive && pinMesh.material.emissive.setHex(0x000000);
            pinMesh.material.emissiveIntensity = 0;
            pinMesh.scale.setScalar(1.0);
            return;
        }

        selected3DPinsAll.push({ type: 'circle', circleType, idx, mesh: pinMesh, key });

        // Seçilen pini hemen sarıya boya (animasyon sonrası kaybolmasın)
        pinMesh.material.color.setHex(0xffd700);
        pinMesh.material.emissive && pinMesh.material.emissive.setHex(0xaa6600);
        pinMesh.material.emissiveIntensity = 0.5;
        pinMesh.scale.setScalar(1.3);

        // İki pin seçildi → kesikli rehber çizgiyi kaldır, lastik ekle
        if (selected3DPinsAll.length === 2) {
            const [pinA, pinB] = selected3DPinsAll;

            // backGroup'taki kesikli rehber çizgileri kaldır
            backGroup.children
                .filter(ch => ch.userData && ch.userData.isGuide)
                .forEach(g => backGroup.remove(g));

            // İki pin arasına lastik tüp ekle
            const posA = getPinWorldPos(pinA);
            const posB = getPinWorldPos(pinB);
            try {
                const curve = new THREE.CatmullRomCurve3([posA, posB], false, 'catmullrom', 0);
                const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.025, 8, false);
                const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
                const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
                const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
                const tube = new THREE.Mesh(tubeGeo,
                    new THREE.MeshPhongMaterial({ color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444 })
                );
                tube.userData.isElastic = true;
                backGroup.add(tube);
            } catch (e) { console.warn(e); }

            selected3DPinsAll = [];
            updatePinSelectionColors();
            return;
        }
    }


    /* Grid pinlerinden kapalı/açık TubeGeometry lastik yap */
    function _commitGridPolygon(closed) {
        if (selected3DPinsAll.length < 2) return;
        const gridPins = selected3DPinsAll.filter(p => p.type === 'grid');
        if (gridPins.length < 2) return;
        // Limit kontrolü
        if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) {
            const colorName = ELASTIC_COLORS.find(c => c.hex === currentElasticColor)?.name;
            showLimitToast(colorName);
            selected3DPinsAll = [];
            updatePinSelectionColors();
            if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
            return;
        }

        const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
        const ez = BOARD3D_THICK / 2 + 0.18;
        const pts3D = gridPins.map(p => new THREE.Vector3(
            offset + p.c * PIN3D_GAP,
            -(offset + p.r * PIN3D_GAP),
            ez
        ));
        if (closed && pts3D.length >= 3) pts3D.push(pts3D[0].clone());

        try {
            const curve = new THREE.CatmullRomCurve3(pts3D, false, 'catmullrom', 0.1);
            const tubeGeo = new THREE.TubeGeometry(curve, Math.max(pts3D.length * 6, 20), 0.025, 8, false);
            const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
            const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
            const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
            const mat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444
            });
            const tube = new THREE.Mesh(tubeGeo, mat);
            tube.userData.isElastic = true;
            frontGroup.add(tube);
            elasticMeshes.push(tube);

            // Kapalı dolgu
            if (closed && gridPins.length >= 3) {
                const shape = new THREE.Shape();
                gridPins.forEach((p, i) => {
                    const x = offset + p.c * PIN3D_GAP;
                    const y = -(offset + p.r * PIN3D_GAP);
                    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
                });
                shape.closePath();
                const fillMesh = new THREE.Mesh(
                    new THREE.ShapeGeometry(shape),
                    new THREE.MeshBasicMaterial({ color: new THREE.Color(rc, gc, bc), transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
                );
                fillMesh.position.z = ez - 0.01;
                fillMesh.userData.isElastic = true;
                frontGroup.add(fillMesh);
            }

            // elastics dizisine ekle (isValidSquare ve elasticAdded için)
            const elObj = { pins: gridPins.map(p => ({ r: p.r, c: p.c })), color: currentElasticColor, closed };
            elastics.push(elObj);

            // Olayları tetikle
            incrementElasticUse(currentElasticColor);
            updateSwatchBadges();
            $(document).trigger('elasticAdded', { count: elastics.length });
        } catch (e) { console.warn('_commitGridPolygon error:', e); }

        selected3DPinsAll = [];
        updatePinSelectionColors();
        if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
    }

    /* Çember pinlerinden kapalı/açık lastik yap */
    function _commitCirclePolygon(closed) {
        if (selected3DPinsAll.length < 2) return;
        const circlePins = selected3DPinsAll.filter(p => p.type === 'circle');
        if (circlePins.length < 2) return;
        // Limit kontrolü
        if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) {
            const colorName = ELASTIC_COLORS.find(c => c.hex === currentElasticColor)?.name;
            showLimitToast(colorName);
            selected3DPinsAll = [];
            updatePinSelectionColors();
            if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
            return;
        }

        const pts3D = circlePins.map(p => getPinWorldPos(p));
        if (closed && pts3D.length >= 3) pts3D.push(pts3D[0].clone());

        try {
            const curve = new THREE.CatmullRomCurve3(pts3D, false, 'catmullrom', 0.1);
            const tubeGeo = new THREE.TubeGeometry(curve, Math.max(pts3D.length * 6, 20), 0.025, 8, false);
            const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
            const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
            const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
            const mat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444
            });
            const tube = new THREE.Mesh(tubeGeo, mat);
            tube.userData.isElastic = true;
            backGroup.add(tube);
        } catch (e) { console.warn('_commitCirclePolygon error:', e); }

        selected3DPinsAll = [];
        updatePinSelectionColors();
        if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
    }

    function getPinWorldPos(pinEntry) {
        if (pinEntry.type === 'grid') {
            const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
            return new THREE.Vector3(
                offset + pinEntry.c * PIN3D_GAP,
                -(offset + pinEntry.r * PIN3D_GAP),
                BOARD3D_THICK / 2 + 0.18
            );
        } else {
            // circle pin — back face
            const radius = pinEntry.circleType === 'big' ? 2.2 : 1.2;
            const count = pinEntry.circleType === 'big' ? 24 : 12;
            const a = (pinEntry.idx / count) * Math.PI * 2;
            return new THREE.Vector3(
                Math.cos(a) * radius,
                Math.sin(a) * radius,
                -(BOARD3D_THICK / 2 + 0.18)
            );
        }
    }

    function updatePinSelectionColors() {
        // Grid pinleri
        const pinColor = currentTheme === 'dark' ? 0x4a9fd4 : 0x93c5fd;
        const guidePins = window.app2TargetSquare || [];
        pinMeshes.forEach(m => {
            const sel = selected3DPinsAll.find(p => p.type === 'grid' && p.r === m.userData.r && p.c === m.userData.c);
            const isGuidePin = guidePins.some(p => p.r === m.userData.r && p.c === m.userData.c);
            if (sel) {
                m.material.color.setHex(0xffd700);
                m.material.emissive.setHex(0xaa6600);
                m.material.emissiveIntensity = 0.5;
                m.scale.setScalar(1.4);
            } else if (isGuidePin) {
                m.material.color.setHex(0xffd700);
                m.material.emissive.setHex(0xaa6600);
                m.material.emissiveIntensity = 0.3;
                m.scale.setScalar(1.2);
            } else {
                m.material.color.setHex(pinColor);
                m.material.emissive && m.material.emissive.setHex(0x000000);
                m.material.emissiveIntensity = 0;
                m.scale.setScalar(1.0);
            }
        });

        // Circle pinleri (backGroup)
        if (backGroup) {
            backGroup.children.forEach(ch => {
                if (!ch.isMesh || !ch.userData.isCirclePin) return;
                const sel = selected3DPinsAll.find(p =>
                    p.type === 'circle' &&
                    p.circleType === ch.userData.circleType &&
                    p.idx === ch.userData.idx
                );
                if (sel) {
                    ch.material.color.setHex(0xffd700);
                    ch.material.emissive && ch.material.emissive.setHex(0xaa6600);
                    ch.material.emissiveIntensity = 0.5;
                    ch.scale.setScalar(1.3);
                } else {
                    ch.material.color.setHex(ch.userData.baseColor || 0x4a9fd4);
                    ch.material.emissive && ch.material.emissive.setHex(0x000000);
                    ch.material.emissiveIntensity = 0;
                    ch.scale.setScalar(1.0);
                }
            });
        }
    }

    function animatePinSelect(pinMesh) {
        pinMesh.material.color.setHex(0xffd700);
        pinMesh.material.emissive.setHex(0xaa6600);
        pinMesh.material.emissiveIntensity = 0.8;
        const origScale = pinMesh.scale.x;
        pinMesh.scale.setScalar(1.8);
        let t = 0;
        const anim = setInterval(() => {
            t += 0.1;
            const s = 1.8 - 0.8 * Math.min(t, 1);
            pinMesh.scale.setScalar(s);
            if (t >= 1) {
                clearInterval(anim);
                pinMesh.scale.setScalar(1.0);
                // Eğer pin hâlâ seçiliyse sarı rengini koru
                const stillSelected = selected3DPinsAll.some(p =>
                    p.type === 'circle' &&
                    p.circleType === pinMesh.userData.circleType &&
                    p.idx === pinMesh.userData.idx
                );
                if (!stillSelected) {
                    pinMesh.material.color.setHex(pinMesh.userData.baseColor || 0x4a9fd4);
                    pinMesh.material.emissive && pinMesh.material.emissive.setHex(0x000000);
                    pinMesh.material.emissiveIntensity = 0;
                }
            }
        }, 16);
    }

    /* 3D otomatik başlat — 2D geçiş butonları kaldırıldı */
    setTimeout(() => {
        initThreeJS();
        if (threeScene) threeScene.background = new THREE.Color(currentTheme === 'dark' ? 0x0a0e27 : 0xf0f4f8);
    }, 80);

    /* Tema değişince 3D'yi yeniden oluştur */
    $('#themeToggle').off('click').on('click', function () {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        $('html').attr('data-theme', currentTheme);
        $('#themeIcon').text(currentTheme === 'dark' ? '☀' : '🌙');
        if (threeScene) {
            threeScene.background = new THREE.Color(currentTheme === 'dark' ? 0x0a0e27 : 0xf0f4f8);
            buildFront();
            buildBack();
        }
    });


    function onThreeResize() {
        if (!threeRenderer) return;
        const c = document.getElementById('threeContainer');
        const W = c.clientWidth, H = c.clientHeight;
        threeCamera.aspect = W / H;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(W, H);
    }

    /* ── Tahta + her iki yüz tek seferde inşa edilir ── */
    function build3DBoard() {
        // Grubu temizle
        while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
        pins3DObjects = [];
        elastics3D = [];

        const colors = getThemeColors();
        const half = BOARD_SIZE_3D / 2;

        /* Gövde */
        const bodyGeo = new THREE.BoxGeometry(BOARD_SIZE_3D, BOARD_SIZE_3D, BOARD_THICK);
        const bodyMats = [
            new THREE.MeshPhongMaterial({ color: colors.boardEdge, shininess: 40 }),
            new THREE.MeshPhongMaterial({ color: colors.boardEdge, shininess: 40 }),
            new THREE.MeshPhongMaterial({ color: colors.boardEdge, shininess: 40 }),
            new THREE.MeshPhongMaterial({ color: colors.boardEdge, shininess: 40 }),
            new THREE.MeshPhongMaterial({ color: colors.board, shininess: 60 }), // ön (+z)
            new THREE.MeshPhongMaterial({ color: colors.board, shininess: 60 }), // arka (-z)
        ];
        const body = new THREE.Mesh(bodyGeo, bodyMats);
        body.castShadow = body.receiveShadow = true;
        boardGroup.add(body);
        boardMesh3D = body;

        /* Kenar çerçeve — ön yüz */
        const framePts = [
            new THREE.Vector3(-half, -half, BOARD_THICK / 2 + 0.01),
            new THREE.Vector3(half, -half, BOARD_THICK / 2 + 0.01),
            new THREE.Vector3(half, half, BOARD_THICK / 2 + 0.01),
            new THREE.Vector3(-half, half, BOARD_THICK / 2 + 0.01),
            new THREE.Vector3(-half, -half, BOARD_THICK / 2 + 0.01),
        ];
        boardGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(framePts),
            new THREE.LineBasicMaterial({ color: 0x00d4ff })
        ));

        /* Kenar çerçeve — arka yüz */
        const framePtsB = framePts.map(p => new THREE.Vector3(p.x, p.y, -BOARD_THICK / 2 - 0.01));
        boardGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(framePtsB),
            new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 })
        ));

        /* Grid çizgileri — ön yüz */
        const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 });
        const step = BOARD_SIZE_3D / (PIN_COLS - 1);
        const zF = BOARD_THICK / 2 + 0.005;
        for (let i = 0; i < PIN_COLS; i++) {
            const x = -half + i * step;
            boardGroup.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -half, zF), new THREE.Vector3(x, half, zF)]),
                gridMat
            ));
        }
        for (let j = 0; j < PIN_ROWS; j++) {
            const y = -half + j * step;
            boardGroup.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-half, y, zF), new THREE.Vector3(half, y, zF)]),
                gridMat
            ));
        }

        /* ÖN YÜZ: 6×6 = 36 pin */
        const z0 = BOARD_THICK / 2 + 0.02;
        for (let r = 0; r < PIN_ROWS; r++) {
            for (let c = 0; c < PIN_COLS; c++) {
                const x = -half + c * step;
                const y = half - r * step;
                const pinGroup = makePinFull(x, y, z0, colors.pin);
                boardGroup.add(pinGroup);
                // Raycaster için gövde mesh'ini kaydet
                pinGroup.children.forEach(child => {
                    if (child.geometry instanceof THREE.CylinderGeometry ||
                        child.geometry instanceof THREE.SphereGeometry) {
                        child.userData = { isPin: true, r, c };
                        pins3DObjects.push({ mesh: child, r, c });
                    }
                });
            }
        }

        /* ARKA YÜZ: çemberler (z negatif taraf) */
        const zB = -BOARD_THICK / 2 - 0.02;
        buildBackFace();

        /* 2D elastikleri 3D'ye yansıt */
        sync2DElasticsTo3D();
    }

    function makePinFull(x, y, z, color) {
        const g = new THREE.Group();
        // Gövde (silindir)
        const cyl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.065, 0.05, 0.20, 12),
            new THREE.MeshPhongMaterial({ color, shininess: 80, specular: 0xffffff })
        );
        cyl.rotation.x = Math.PI / 2;
        cyl.position.set(x, y, z + 0.10);
        cyl.castShadow = true;
        // Kafa (küre)
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.078, 12, 12),
            new THREE.MeshPhongMaterial({ color, shininess: 120, specular: 0xffffff })
        );
        head.position.set(x, y, z + 0.20);
        g.add(cyl);
        g.add(head);
        return g;
    }

    /* 3D pin tıklamasını 2D tahta mantığına bağla + lastik animasyonu */
    function handle3DPinClick(r, c) {
        // Önce 2D tahta mantığını çalıştır
        handlePinClick(r, c);

        // Kısa süre sonra 3D görünümü güncelle (lastik animasyonu)
        setTimeout(() => {
            if (!boardGroup) return;

            const step2D = BOARD_SIZE_3D / (PIN_COLS - 1);
            const half2D = BOARD_SIZE_3D / 2;
            const ez = BOARD_THICK / 2 + 0.13;

            // Önceki elastik çizgilerini temizle (sadece Line tipindeki elastikler)
            const toRemove = [];
            boardGroup.traverse(obj => {
                if (obj.userData && obj.userData.isElastic) toRemove.push(obj);
            });
            toRemove.forEach(obj => boardGroup.remove(obj));

            // Mevcut seçili pinleri önizleme olarak çiz (lastik uzaması animasyonu)
            if (selectedPins.length >= 1) {
                const previewPts = selectedPins.map(p => new THREE.Vector3(
                    -half2D + p.c * step2D,
                    half2D - p.r * step2D,
                    ez
                ));
                if (previewPts.length >= 2) {
                    const previewGeo = new THREE.BufferGeometry().setFromPoints(previewPts);
                    const previewMat = new THREE.LineBasicMaterial({
                        color: new THREE.Color(currentElasticColor),
                        linewidth: 3,
                        transparent: true,
                        opacity: 0.75
                    });
                    const previewLine = new THREE.Line(previewGeo, previewMat);
                    previewLine.userData.isElastic = true;
                    boardGroup.add(previewLine);

                    // Lastik "gerilme" animasyonu
                    animateElasticStretch(previewLine, previewPts);
                }
            }

            // Tamamlanmış elastikleri çiz
            elastics.forEach(el => {
                if (el.pins.length < 2) return;
                const hexColor = el.color || '#ef4444';
                const color3 = new THREE.Color(hexColor);
                const pts = el.pins.map(p => new THREE.Vector3(
                    -half2D + p.c * step2D,
                    half2D - p.r * step2D,
                    ez
                ));
                if (el.closed && pts.length >= 3) pts.push(pts[0].clone());

                const mat = new THREE.LineBasicMaterial({ color: color3, linewidth: 3 });
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
                line.userData.isElastic = true;
                boardGroup.add(line);

                // Kapalı şekil dolgu
                if (el.closed && el.pins.length >= 3) {
                    const shape = new THREE.Shape();
                    el.pins.forEach((p, i) => {
                        const x = -half2D + p.c * step2D;
                        const y = half2D - p.r * step2D;
                        i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
                    });
                    shape.closePath();
                    const shapeGeo = new THREE.ShapeGeometry(shape);
                    const rv = parseInt(hexColor.slice(1, 3), 16) / 255;
                    const gv = parseInt(hexColor.slice(3, 5), 16) / 255;
                    const bv = parseInt(hexColor.slice(5, 7), 16) / 255;
                    const shapeMat = new THREE.MeshBasicMaterial({
                        color: new THREE.Color(rv, gv, bv),
                        transparent: true, opacity: 0.18,
                        side: THREE.DoubleSide, depthWrite: false
                    });
                    const shapeMesh = new THREE.Mesh(shapeGeo, shapeMat);
                    shapeMesh.position.z = ez - 0.005;
                    shapeMesh.userData.isElastic = true;
                    boardGroup.add(shapeMesh);
                }
            });

            // Seçili pin renk güncellemesi
            boardGroup.traverse(obj => {
                if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry') {
                    const wx = obj.position.x, wy = obj.position.y;
                    const bestMatch = selectedPins.find(p => {
                        const px = -half2D + p.c * step2D;
                        const py = half2D - p.r * step2D;
                        return Math.sqrt((wx - px) ** 2 + (wy - py) ** 2) < 0.05;
                    });
                    if (!bestMatch) {
                        const colors = getThemeColors();
                        obj.material.color.set(colors.pin);
                        obj.scale.set(1, 1, 1);
                    }
                }
            });
        }, 30);
    }

    /* Lastik gerilme animasyonu */
    function animateElasticStretch(lineMesh, targetPts) {
        if (targetPts.length < 2) return;
        const start = targetPts[targetPts.length - 2].clone();
        const end = targetPts[targetPts.length - 1].clone();
        const dur = 220;   // ms
        const t0 = performance.now();

        function step(now) {
            const t = Math.min((now - t0) / dur, 1);
            // Ease-out elastic eğrisi (hafif titreşim efekti)
            const ease = 1 - Math.pow(2, -8 * t) * Math.cos(t * Math.PI * 3.5);
            const cur = new THREE.Vector3().lerpVectors(start, end, ease);

            // Son noktayı güncelle
            const newPts = [...targetPts.slice(0, -1), cur];
            const geo = new THREE.BufferGeometry().setFromPoints(newPts);
            lineMesh.geometry.dispose();
            lineMesh.geometry = geo;

            if (t < 1 && lineMesh.parent) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /* ── 2D elastikleri 3D yüzeye senkronize et ── */
    function sync2DElasticsTo3D() {
        if (!boardGroup) return;
        // Önceki lastik gruplarını kaldır
        elastics3D.forEach(e => { if (e.group) boardGroup.remove(e.group); });
        elastics3D = [];

        const step = BOARD_SIZE_3D / (PIN_COLS - 1);
        const half = BOARD_SIZE_3D / 2;
        const ez = BOARD_THICK / 2 + 0.15;

        elastics.forEach(el => {
            if (el.pins.length < 2) return;
            const group = new THREE.Group();

            const pts3D = el.pins.map(p => new THREE.Vector3(
                -half + p.c * step,
                half - p.r * step,
                ez
            ));
            if (el.closed && pts3D.length >= 3) pts3D.push(pts3D[0].clone());

            // Tüp lastik (TubeGeometry için CatmullRomCurve3)
            const curve = new THREE.CatmullRomCurve3(pts3D, false, 'catmullrom', 0.1);
            try {
                const tubeGeo = new THREE.TubeGeometry(curve, pts3D.length * 8, 0.025, 8, false);
                const r = parseInt(el.color.slice(1, 3), 16) / 255;
                const g = parseInt(el.color.slice(3, 5), 16) / 255;
                const b = parseInt(el.color.slice(5, 7), 16) / 255;
                const tubeMat = new THREE.MeshPhongMaterial({
                    color: new THREE.Color(r, g, b),
                    shininess: 80, specular: 0x444444
                });
                group.add(new THREE.Mesh(tubeGeo, tubeMat));

                // Dolgu (kapalı şekil)
                if (el.closed && el.pins.length >= 3) {
                    const shape = new THREE.Shape();
                    el.pins.forEach((p, i) => {
                        const x = -half + p.c * step, y = half - p.r * step;
                        i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
                    });
                    shape.closePath();
                    const fillMesh = new THREE.Mesh(
                        new THREE.ShapeGeometry(shape),
                        new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
                    );
                    fillMesh.position.z = ez - 0.01;
                    group.add(fillMesh);
                }
            } catch (e) { }

            boardGroup.add(group);
            elastics3D.push({ el, group });
        });
    }

    /* ── Pin seçim animasyonu: seçili pini altın rengi yap ── */
    function update3DPinColors() {
        const step = BOARD_SIZE_3D / (PIN_COLS - 1);
        const half = BOARD_SIZE_3D / 2;
        const colors = getThemeColors();

        pins3DObjects.forEach(({ mesh, r, c }) => {
            const isSel = selected3DPins.some(p => p.r === r && p.c === c);
            const color = isSel ? 0xffd700 : colors.pin;
            if (mesh.material) mesh.material.color.setHex(color);
        });
    }

    /* ── Preview lastik (seçili pinler arası kesik çizgi) ── */
    let previewLine3D = null;
    function updatePreview3D() {
        if (previewLine3D) { frontGroup && frontGroup.remove(previewLine3D); previewLine3D = null; }
        const gridSel = selected3DPinsAll.filter(p => p.type === 'grid');
        if (gridSel.length < 1) return;

        const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
        const ez = BOARD3D_THICK / 2 + 0.15;
        const pts = gridSel.map(p => new THREE.Vector3(
            offset + p.c * PIN3D_GAP,
            -(offset + p.r * PIN3D_GAP),
            ez
        ));

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const previewMat = new THREE.LineDashedMaterial({ color: new THREE.Color(currentElasticColor), dashSize: 0.12, gapSize: 0.07, linewidth: 2, depthTest: false });
        previewLine3D = new THREE.Line(geo, previewMat);
        previewLine3D.computeLineDistances();
        previewLine3D.renderOrder = 999; // Her zaman üstte görün
        if (frontGroup) frontGroup.add(previewLine3D);
    }

    /* ── Mouse / Touch olayları ── */
    function getCanvasXY(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: ((clientX - rect.left) / rect.width) * 2 - 1,
            y: -((clientY - rect.top) / rect.height) * 2 + 1
        };
    }

    function getPinUnderMouse(canvas, event) {
        const xy = getCanvasXY(event, canvas);
        raycaster3D.setFromCamera(xy, threeCamera);
        const meshes = pins3DObjects.map(p => p.mesh);
        const hits = raycaster3D.intersectObjects(meshes, false);
        if (!hits.length) return null;
        const hitMesh = hits[0].object;
        return pins3DObjects.find(p => p.mesh === hitMesh) || null;
    }

    function on3DMouseDown(e) {
        mouseDownPos3D = { x: e.clientX, y: e.clientY };
        isDragging3D = false;
    }
    function on3DMouseMove(e) {
        const dx = e.clientX - mouseDownPos3D.x, dy = e.clientY - mouseDownPos3D.y;
        if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging3D = true;
        // Pin üzerine gelindiğinde cursor'ı pointer yap
        const pin = getPinUnderMouse(e.target, e);
        e.target.style.cursor = pin ? 'pointer' : (isDragging3D ? 'grabbing' : 'grab');
    }
    function on3DMouseUp(e) {
        if (isDragging3D) { isDragging3D = false; return; }
        const pin = getPinUnderMouse(e.target, e);
        if (pin) handle3DPinClick(pin.r, pin.c);
    }
    function on3DTouchStart(e) {
        mouseDownPos3D = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isDragging3D = false;
    }
    function on3DTouchEnd(e) {
        if (isDragging3D) { isDragging3D = false; return; }
        // changedTouches kullan
        const t = e.changedTouches[0];
        const fakeE = { clientX: t.clientX, clientY: t.clientY, target: e.target };
        const pin = getPinUnderMouse(e.target, fakeE);
        if (pin) handle3DPinClick(pin.r, pin.c);
    }

    /* ── 3D pin tıklama mantığı ── */
    function handle3DPinClick(r, c) {
        // İlk pine geri dön → elastiği kapat
        if (selected3DPins.length >= 3) {
            const first = selected3DPins[0];
            if (first.r === r && first.c === c) {
                // Elastik ekle
                elastics.push({ pins: [...selected3DPins], color: currentElasticColor, closed: true });
                selected3DPins = [];
                if (previewLine3D) { boardGroup.remove(previewLine3D); previewLine3D = null; }
                update3DPinColors();
                sync2DElasticsTo3D();
                rebuildBoard(); // 2D tahta da güncelle
                // Lastik geçirme animasyonu
                animateElasticSnap();
                return;
            }
        }
        // Zaten seçili ise çıkar
        const idx = selected3DPins.findIndex(p => p.r === r && p.c === c);
        if (idx >= 0) { selected3DPins.splice(idx, 1); update3DPinColors(); updatePreview3D(); return; }

        // Yeni pin ekle
        selected3DPins.push({ r, c });
        update3DPinColors();
        updatePreview3D();

        // Pin seçim efekti
        animatePinSelect(r, c);
    }

    /* ── Pin seçim animasyonu (küçük zıplama) ── */
    function animatePinSelect(r, c) {
        const step = BOARD_SIZE_3D / (PIN_COLS - 1), half = BOARD_SIZE_3D / 2;
        const targetZ = BOARD_THICK / 2 + 0.20 + 0.12;
        const pinObjs = pins3DObjects.filter(p => p.r === r && p.c === c);
        if (!pinObjs.length) return;

        let t = 0;
        const dur = 180; // ms
        const start = performance.now();
        function anim(now) {
            t = (now - start) / dur;
            if (t > 1) t = 1;
            const bounce = Math.sin(t * Math.PI) * 0.12;
            pinObjs.forEach(({ mesh }) => {
                if (mesh.position) mesh.position.z = (mesh.userData.baseZ || mesh.position.z) + bounce;
            });
            if (t < 1) requestAnimationFrame(anim);
        }
        // baseZ kaydet
        pinObjs.forEach(({ mesh }) => { mesh.userData.baseZ = mesh.position.z; });
        requestAnimationFrame(anim);
    }

    /* ── Lastik geçirme snap animasyonu ── */
    function animateElasticSnap() {
        if (!elastics3D.length) return;
        const last = elastics3D[elastics3D.length - 1];
        if (!last || !last.group) return;

        let t = 0;
        const start = performance.now();
        function anim(now) {
            t = (now - start) / 300;
            if (t > 1) t = 1;
            // Scale z ekseni üzerinde 0→1 geçişi (lastik germe efekti)
            const s = 0.2 + 0.8 * t + 0.1 * Math.sin(t * Math.PI * 3) * (1 - t);
            last.group.children.forEach(child => {
                if (child.isMesh) child.scale.set(1, 1, s);
            });
            if (t < 1) requestAnimationFrame(anim);
            else last.group.children.forEach(child => { if (child.isMesh) child.scale.set(1, 1, 1); });
        }
        requestAnimationFrame(anim);
    }

    /* ══ AÇILIŞ DİYALOĞU ════════════════════════════════════════ */
  
    $('#introDialog').show();
    $('#introContinueBtn').on('click',function(){
        $('#introDialog').hide();
        loadTab('intro');
    });
  


    /**
     * TEST MODU: Uygulama 2'yi görseldeki (Step 1/8) durumla başlatır.
     * Sol panelde hedefler, sağ panelde ise kırmızı beşgen benzeri lastik görünür.
     */
    // TEST MODU: Uygulama 2'yi doğrudan başlat

    /*
    (function () {
        $('#introDialog').hide();
        $('[data-tab="app2"]').prop('disabled', false);
        $('.tab-button').removeClass('active');
        $('[data-tab="app2"]').addClass('active');
        loadTab('app2');
    })();
    */

});
