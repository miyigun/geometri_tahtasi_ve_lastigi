/* ══ UYGULAMA ADIMLARI, AKIŞLARI VE ŞABLONLARI ════════════════════════════ */

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

function isDrawingAllowed() {
    const tab = typeof $ !== 'undefined' ? ($('.tab-button.active').data('tab') || 'intro') : 'intro';
    
    if (tab === 'intro') {
        return false;
    }
    if (tab === 'app1') {
        const step = window.currentApp1Step;
        return (step === 2 || step === 3);
    }
    if (tab === 'app2') {
        const step = window.currentApp2Step;
        return (step === 2 && (window.app2subStep === 1 || window.app2subStep === 2));
    }
    if (tab === 'app3') {
        const step = window.currentApp3Step;
        return (step >= 1 && step <= 5);
    }
    if (tab === 'deep') {
        return true;
    }
    if (tab === 'free') {
        return true;
    }
    return false;
}

function updateToolbarStatus() {
    if (typeof $ === 'undefined') return;
    const drawAllowed = isDrawingAllowed();
    $('#paletteToggleBtn, #clearBoardBtn, #undoBtn, #resetBoardBtn').prop('disabled', !drawAllowed).css({
        'opacity': drawAllowed ? '1' : '0.35',
        'pointer-events': drawAllowed ? 'auto' : 'none'
    });
}

/* ── Sekme Yükleyici ── */
function loadTab(name) {
    window.currentApp3Step = null;
    window.currentApp1Step = 0;
    window.currentApp2Step = 0;
    $('#contentArea').empty();

    // Yüz seçimi ve kamera pozisyonlama
    if (threeCamera && threeControls) {
        const isMobile = window.innerWidth <= 640;
        if (name === 'app2') {
            threeCamera.position.set(0, 0, isMobile ? -13 : -9);
            if (typeof setLockedFace === 'function') setLockedFace('back');
            else window.lockedFace = 'back';
        } else if (name === 'free') {
            threeCamera.position.set(0, 0, isMobile ? 13 : 9);
            if (typeof setLockedFace === 'function') setLockedFace(null);
            else window.lockedFace = null;
        } else {
            threeCamera.position.set(0, 0, isMobile ? 13 : 9);
            if (typeof setLockedFace === 'function') setLockedFace('front');
            else window.lockedFace = 'front';
        }
        threeCamera.lookAt(0, 0, 0);
        threeControls.target.set(0, 0, 0);
        threeControls.update();
    } else {
        if (name === 'app2') {
            window.lockedFace = 'back';
        } else if (name === 'free') {
            window.lockedFace = null;
        } else {
            window.lockedFace = 'front';
        }
    }

    if (name === 'intro') loadIntro();
    else if (name === 'app1') loadApp1();
    else if (name === 'app2') loadApp2();
    else if (name === 'app3') loadApp3();
    else if (name === 'deep') loadDeep();
    else if (name === 'free') loadFree();

    updateToolbarStatus();
}

/* ── Tanıtım Sekmesi ── */
function loadIntro() {
    renderIntroStep(0);
}

function renderIntroStep(step) {
    clearBoard();
    boardMode = 'draw';
    const totalSteps = 2;
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
        case 1: $('#introFinishBtn').on('click', () => { $('[data-tab="app1"]').click(); }); break;
    }
}

/* ── Uygulama 1: Tamkare İfade Elde Edelim! ── */
function loadApp1() {
    clearBoard();
    if (frontGroup) updateElastics3D();
    boardMode = 'draw';
    renderApp1Step(0);
}

function renderApp1Step(step) {
    window.currentApp1Step = step;
    updateToolbarStatus();
    if (step < 3) clearBoard();
    boardMode = 'draw';
    const totalSteps = 8;
    const pct = Math.round(((step + 1) / totalSteps) * 100);
    let html = `<div class="progress-container">
    <div class="progress-label"><span>Uygulama 1</span><span>${step + 1}/${totalSteps}</span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
</div>`;

    switch (step) {
        case 0:
            html += `<div class="instruction-box">
                    <h3>Tamkare İfade Elde Edelim!</h3>
                    <p>Bu uygulamada geometri tahtasını kullanarak <strong>(a+b)² = a² + 2ab + b²</strong> tamkare özdeşliğini görsel olarak keşfedeceksiniz.</p>
                    <p style="margin-top:8px;">Tamkare sayıları tanıyacak, kare bölgelerini tahtada oluşturacak ve özdeşliği parçalara ayırarak <strong>geometrik olarak kanıtlayacaksınız</strong>.</p>
                </div>
                <div style="text-align:center;"><button class="action-button" id="app1s0Btn">Başla</button></div>`;
            $('#boardHint').text('🟦 Geometri tahtasını hazırlayın');
            break;

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

        case 2:
            clearBoard();
            if (frontGroup) updateElastics3D();
            html += `<div class="instruction-box">
        <p>Geometri tahtası üzerinde <strong>tek bir lastikle 2×2\'lik bir kare oluşturunuz.</strong></p>
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

        case 3:
            html += `<div class="instruction-box">
        <p>Karenin kenarını <strong>a</strong> olarak adlandırdık. Şimdi kareyi 2×2’den 3×3 olacak şekilde büyütmek için sağa ve aşağıya <strong>1 birimlik parçalar ekleyerek büyük kareyi tamamlayınız.</strong></p>
        <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">💡 Eklediğiniz bu yeni parçaların kenar uzunluğunu <strong>b</strong> olarak adlandıracağız.</p>
        <p style="margin-top:8px;font-size:.9em;color:var(--text-secondary);">Yeni kenar uzunluğu <strong>a + b</strong> olacaktır. Bunu oluşturmak için <strong>farklı renkte 2 yeni lastik</strong> ekleyiniz.</p>
        <div id="completeStatus" style="margin-top:10px;padding:8px;background:var(--bg-tertiary);border-radius:7px;font-size:.88em;color:var(--text-secondary);">
            ⬡ Henüz (a+b)∙(a+b) kare tamamlanmadı
        </div>
    </div>
    <div id="abEdgeReveal" style="display:none;" class="instruction-box">
        <p>Oluşan büyük karenin kenar uzunluğu <strong>a + b</strong>\'dir.</p>
        <p style="margin-top:6px;">Peki bu karenin alanı nedir?</p>
    </div>
    <div style="text-align:center;"><button class="action-button" id="app1s3Btn" disabled>Devam Et</button></div>`;
            $('#boardHint').text('🔳 2 yeni farklı renkli lastik ekleyerek 3×3 kareyi tamamlayın');
            break;

        case 4:
            html += `<div class="instruction-box">
        <p>Oluşturduğunuz şekilde <strong>büyük karenin kenar uzunluğu a = 2 birim</strong>, <strong>sonradan eklenen genişletme kenarı b = 1 birim</strong>\'dir.</p>
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
            ${['a', 'b', '(',  '+',  ')', '²'].map(k => `<button class="sq-key3" data-val="${k}" style="padding:8px 14px;border-radius:8px;background:var(--button-bg);border:1.5px solid var(--border-color);color:var(--button-text);cursor:pointer;font-size:1.05em;font-weight:700;">${k}</button>`).join('')}
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
                const colors = ['#f97316', '#eab308', '#3b82f6', '#22c55e'];
                const ids = ['ss1', 'ss2', 'ss3', 'ss4'];
                ids.forEach((id, i) => {
                    setTimeout(() => {
                        $('#' + id).css({ background: colors[i] + '33', borderColor: colors[i], color: colors[i], fontWeight: '700' });
                    }, i * 300);
                });
            }, 200);
            break;

        case 6:
            html += `<div class="instruction-box">
        <h3>Ölçme ve Değerlendirme</h3>
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
            <div style="display:none;text-align:center;" id="app1s6NextArea">
                <div class="instruction-box" style="margin-top:12px;text-align:left;">
                    <h3>Bu Bölümde Neler Öğrendik?</h3>
                    <ul style="margin-top:8px;line-height:1.9;">
                        <li>Tamkare sayıların ne olduğunu keşfettik (1, 4, 9...).</li>
                        <li>Geometri tahtasında <strong>2×2 kare</strong> oluşturduk ve kenar uzunluğunu <strong>a</strong> olarak adlandırdık.</li>
                        <li>Kareyi genişleterek <strong>(a+b)×(a+b)</strong> büyük karesini 4 bölgeye ayırdık.</li>
                        <li>Bölge alanlarını <strong>a², ab, ab, b²</strong> olarak ifade ettik.</li>
                        <li>Toplamı sadeleştirerek <strong>a² + 2ab + b²</strong> elde ettik.</li>
                        <li><strong>Tamkare özdeşliğini</strong> geometrik olarak kanıtladık: (a+b)² = a² + 2ab + b²</li>
                    </ul>
                </div>
                <button class="action-button" id="app1FinishBtn" style="margin-top:8px;">Uygulama 2'ye Geç</button>
            </div>`;
            clearBoard();
            if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
            $('[data-tab="app2"]').prop('disabled', false);
            break;
    }

    $('#contentArea').html(html);
    if (window.MathJax) MathJax.typesetPromise();

    /* Event bindings for App 1 */
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
            // Edge question click handler
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
            function covers3x3(elList) {
                const allPins = elList.flatMap(e => e.pins);
                if (allPins.length === 0) return false;
                const rs = allPins.map(p => p.r), cs = allPins.map(p => p.c);
                const spanR = Math.max(...rs) - Math.min(...rs);
                const spanC = Math.max(...cs) - Math.min(...cs);
                return spanR === 3 && spanC === 3;
            }

            $(document).off('elasticAdded.app1s3').on('elasticAdded.app1s3', function () {
                const addedElastics = elastics.slice(1); // new ones
                if (addedElastics.length < 2) {
                    $('#completeStatus')
                        .text(`${addedElastics.length}/2 lastik eklendi — 1 tane daha ekleyin`)
                        .css('color', 'var(--text-secondary)');
                    return;
                }
                const last2 = addedElastics.slice(-2);
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
                if (!covers3x3(elastics)) {
                    $('#completeStatus')
                        .text('⚠ Lastikler henüz 3×3 kareyi tam olarak tamamlamıyor.')
                        .css('color', 'var(--error-bg)');
                    return;
                }
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
            $(document).on('click.areaovl', '.area-panel-input', function () {
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
            function isValidAssess6() {
                if (elastics.length < 4) return false;
                const allPins = elastics.flatMap(e => e.pins);
                const rs = allPins.map(p => p.r), cs = allPins.map(p => p.c);
                const spanR = Math.max(...rs) - Math.min(...rs);
                const spanC = Math.max(...cs) - Math.min(...cs);
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

/* ── Uygulama 2: π\'yi Görelim ── */
function loadApp2() {
    clearBoard();
    boardMode = 'draw';
    renderApp2Step(0);
}

function renderApp2Step(step) {
    window.currentApp2Step = step;
    updateToolbarStatus();
    if (!(step === 2 && window.app2subStep === 2) && step < 3) {
        clearBoard();
    }
    boardMode = 'draw';
    window.app2LockedPins = null;
    window.app2AllowedPins = null;

    const totalSteps = 9;
    const pct = Math.round(((step + 1) / totalSteps) * 100);
    let html = `<div class="progress-container">
    <div class="progress-label"><span>Uygulama 2 — π'yi Görelim</span><span>${step + 1}/${totalSteps}</span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
</div>`;

    switch (step) {
        case 0:
            html += `<div class="instruction-box">
                    <h3>π'yi Görelim</h3>
                    <p>Bu uygulamada geometri tahtasının <strong>çember yüzünü</strong> kullanarak π sayısının ne anlama geldiğini geometrik olarak keşfedeceksiniz.</p>
                    <p style="margin-top:8px;">Çemberin çevresi ile çapı arasındaki ilişkiyi inceleyerek <strong>π ≈ 3,14…</strong> değerine nasıl ulaşıldığını göreceksiniz.</p>
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
        <h3>Çember İnceleme</h3>
        <p>Geometri tahtasının <strong>arka yüzünde</strong> 12 ve 24 pinli çemberler bulunmaktadır.</p>
        <p style="margin-top:8px;">Sağ panelde iki farklı çember gösterilmektedir. Her birini seçerek inceleyebilirsiniz.</p>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button class="circle-select-btn" id="smallCircleBtn">Küçük Çember (12 pin)</button>
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
                html += `<div class="instruction-box">
            <h3>Büyük Kare ve Çember</h3>
            <p>Hazırlanıyor...</p>
        </div>`;
                setTimeout(() => {
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }
                    clearBoard();
                    $('#app2FormulaDialog').remove();
                    const dlg = `<div class="dialog-overlay" id="app2FormulaDialog" style="display:flex;">
                <div class="dialog-content" style="max-width:480px;">
                    <h2>⭕ Daire Alanı Formülü</h2>
                    <svg id="formulaSVG" viewBox="0 0 220 220" width="220" height="220"
                        style="display:block;margin:0 auto 14px;background:var(--bg-tertiary);border-radius:50%;border:2px solid var(--border-color);">
                        <circle cx="110" cy="110" r="4" fill="#ffd700"/>
                        <text x="110" y="100" fill="#ffd700" font-size="15" font-family="Segoe UI">O</text>
                        <line x1="110" y1="110" x2="216" y2="110" stroke="#c084fc" stroke-width="2.5" stroke-dasharray="6,3"/>
                        <text x="150" y="105" fill="#c084fc" font-size="15" font-family="Segoe UI">r</text>
                    </svg>
                    <p style="text-align:center;font-size:.95em;margin-bottom:10px; font-weight: bold;">Yukarıdaki dairenin alan formülünü yazınız:</p>
                    <div style="display:flex;align-items:center;gap:6px;justify-content:center;flex-wrap:wrap;">
                        <span style="font-size:1.1em;font-weight:700;color:var(--text-accent);">A =</span>
                        <input id="formulaInput" type="text" class="input-field"
                            placeholder="Formülü girin..." readonly
                            style="width:170px;text-align:center;font-size:1.1em;cursor:default;"/>
                        <button id="formulaClearBtn" style="padding:6px 10px;border-radius:7px;background:var(--bg-tertiary);border:1.5px solid var(--border-color);color:var(--text-primary);cursor:pointer;font-size:13px;">⌫</button>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:12px;">
                        ${['π', '(', 'r', ')', '+', '²', '-', '·', '0', '1', '2', '3', '4', '5'].map(k =>
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
                html += `<div class="instruction-box">
            <h3>Büyük Kare Oluşturma</h3>
            <p>Geometri tahtası üzerinde <strong>büyük kareyi</strong> lastikle çeviriniz.</p>
            <p style="margin-top:8px;font-size:.92em;color:var(--text-secondary);">
                Kesikli çizgi üzerindeki köşe pinlerini sırasıyla seçip başlangıç pinine dönerek kareyi kapatınız.
            </p>
        </div>
        <div style="text-align:center;margin-top:10px;">
            <button class="action-button" id="app2s2Btn" disabled style="opacity:.4;">Devam Et</button>
        </div>`;
                window.app2TargetSquare = [{ r: 0, c: 0 }, { r: 0, c: 5 }, { r: 5, c: 5 }, { r: 5, c: 0 }];
                setTimeout(() => {
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }
                    clearBoard();

                    backGroup && backGroup.children.forEach(ch => {
                        if (!ch.userData || !ch.userData.isCirclePin) return;
                        ch.material.opacity = 1.0;
                        ch.material.transparent = false;
                    });

                    if (backGroup && THREE) {
                        backGroup.children
                            .filter(c => c.userData && c.userData.isGuide)
                            .forEach(g => backGroup.remove(g));

                        const half = 2.2 * 0.985;
                        const bz = -(BOARD3D_THICK / 2 + 0.22);
                        const guideCorners = [
                            new THREE.Vector3(-half, half, bz),
                            new THREE.Vector3(half, half, bz),
                            new THREE.Vector3(half, -half, bz),
                            new THREE.Vector3(-half, -half, bz),
                        ];

                        const cornerKeys = ['circle-corner-0','circle-corner-1','circle-corner-2','circle-corner-3'];
                        const mat = new THREE.LineDashedMaterial({
                            color: 0xffd700, dashSize: 0.18, gapSize: 0.10, linewidth: 2
                        });
                        for (let i = 0; i < 4; i++) {
                            const geo = new THREE.BufferGeometry().setFromPoints([
                                guideCorners[i], guideCorners[(i + 1) % 4]
                            ]);
                            const seg = new THREE.Line(geo, mat.clone());
                            seg.computeLineDistances();
                            seg.userData.isGuide = true;
                            seg.userData.segKey = `${cornerKeys[i]}-${cornerKeys[(i + 1) % 4]}`;
                            backGroup.add(seg);
                        }
                    }
                }, 400);
                $('#boardHint').text('📐 Sarı kesikli çizgideki kareyi lastikle oluşturun');

             } else if (window.app2subStep === 2) {
                html += `<div class="instruction-box">
                    <h3>Adım 2 — İçten Teğet Kareyi Lastikle Çizin</h3>
                    <p>Sarı kesikli çizgiyle gösterilen <strong>iç kareyi</strong> lastikle çeviriniz.</p>
                    <p style="margin-top:8px;font-size:.92em;color:var(--text-secondary);">Yalnızca kesikli karenin <strong>dört köşesindeki pinler</strong> seçilebilir. Sırasıyla seçip başlangıç pinine dönerek kareyi kapatınız.</p>
                </div>
                    <div style="text-align:center;margin-top:10px;"><button class="action-button" id="app2s2Btn" disabled style="opacity:.4;">Devam Et</button></div>`;
                setTimeout(() => {
                    if (threeCamera && threeControls) {
                        threeCamera.position.set(0, 0, -9);
                        threeCamera.lookAt(0, 0, 0);
                        threeControls.target.set(0, 0, 0);
                        threeControls.update();
                    }

                    window.app2TargetInnerSquare = true;

                    const insetPos = 2.2 / Math.sqrt(2);
                    const cornerPositions = [
                        [-insetPos,  insetPos],
                        [ insetPos,  insetPos],
                        [ insetPos, -insetPos],
                        [-insetPos, -insetPos],
                    ];
                    const bzPin = -(BOARD3D_THICK / 2 + 0.08);
                    backGroup && backGroup.children.forEach(ch => {
                        if (!ch.isMesh || !ch.userData.isCirclePin || ch.userData.circleType !== 'corner') return;
                        const [nx, ny] = cornerPositions[ch.userData.idx];
                        ch.position.set(nx, ny, bzPin);
                    });

                    if (backGroup && THREE) {
                        backGroup.children
                            .filter(c => c.userData && c.userData.isGuide)
                            .forEach(g => backGroup.remove(g));

                        const inset = 2.2 / Math.sqrt(2);
                        const bz = -(BOARD3D_THICK / 2 + 0.22);
                        const innerCorners = [
                            new THREE.Vector3(-inset,  inset, bz),
                            new THREE.Vector3( inset,  inset, bz),
                            new THREE.Vector3( inset, -inset, bz),
                            new THREE.Vector3(-inset, -inset, bz),
                        ];
                        const cornerKeys2 = ['circle-corner-0','circle-corner-1','circle-corner-2','circle-corner-3'];
                        const mat2 = new THREE.LineDashedMaterial({ color: 0xffd700, dashSize: 0.18, gapSize: 0.10, linewidth: 2 });
                        for (let i = 0; i < 4; i++) {
                            const geo = new THREE.BufferGeometry().setFromPoints([
                                innerCorners[i], innerCorners[(i + 1) % 4]
                            ]);
                            const seg = new THREE.Line(geo, mat2.clone());
                            seg.computeLineDistances();
                            seg.userData.isGuide = true;
                            seg.userData.segKey = `${cornerKeys2[i]}-${cornerKeys2[(i + 1) % 4]}`;
                            backGroup.add(seg);
                        }
                    }
                }, 300);
                $('#boardHint').text('📐 Sarı kesikli çizgideki küçük kareyi lastikle oluşturun');
            } else {
                html += `<div class="instruction-box">
            <h3>Adım 3 — İç Kareyi Ekleyin</h3>
            <p>Büyük çember içinde <strong>köşeleri çemberin üzerinde olan kareyi</strong> lastikle çeviriniz.</p>
            <p style="margin-top:8px;font-size:.92em;color:var(--text-secondary);">İc karenin köşeleri tam olarak çember üzerindedir.</p>
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
            <h3>Adım 3 — Büyük Dairenin Alanını Bulalım</h3>
            <p>Geometri tahtasındaki <strong>yeşil (büyük) dairenin yarıçapı 2 birimdir.</strong></p>
            <p style="margin-top:8px;"><strong>Büyük dairenin alanını</strong> hesaplayınız.</p>
        </div>
        <div class="instruction-box" style="margin-top:8px;">
            <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;">
                Büyük dairenin alanı: ($r = 2$ birim)
            </label>
            <input type="text" id="app2RadiusInput" class="input-field" placeholder="Cevabınız..."
                inputmode="none" readonly style="margin-bottom:4px;cursor:pointer;">
            <div id="app2MiniKeyboard" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                ${['1','2','3','4','π','⌫'].map(k => `<button type="button" class="num-btn app2key" data-key="${k}" style="min-width:44px;padding:6px 10px;font-size:1.1em;">${k}</button>`).join('')}
            </div>
            <div id="app2RadiusFeedback" style="margin-top:4px;"></div>
        </div>
        <div style="text-align:center;margin-top:10px;">
            <button class="action-button" id="app2RadiusCheckBtn" disabled style="opacity:.4;">Kontrol Et</button>
            <div id="app2RadiusNextArea" style="display:none;margin-top:8px;">
                <button class="action-button" id="app2s3Btn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
            </div>
        </div>`;
            $('#boardHint').text('📐 Yeşil dairenin yarıçapı kaç birim?');
            setTimeout(() => {
                if (!backGroup || !THREE) return;
                backGroup.children
                    .filter(c => c.userData && c.userData.isUnitGuide)
                    .forEach(g => backGroup.remove(g));

                const bz = -(BOARD3D_THICK / 2 + 0.22);
                const dashedMat = new THREE.LineDashedMaterial({
                    color: 0x22c55e,
                    dashSize: 0.15,
                    gapSize: 0.08,
                    linewidth: 2,
                    transparent: true,
                    opacity: 1.0,
                    depthTest: false
                });

                const accentHex = (getComputedStyle(document.documentElement)
                .getPropertyValue('--text-accent') || '#00d4ff').trim();
                const accent = new THREE.Color(accentHex);

                function makeTextSprite(text, hexColor) {
                    const c = document.createElement('canvas');
                    c.width = 256;
                    c.height = 96;
                    const g = c.getContext('2d');
                    g.clearRect(0, 0, c.width, c.height);
                    g.fillStyle = hexColor;
                    g.font = 'bold 46px "Segoe UI", Arial';
                    g.textAlign = 'center';
                    g.textBaseline = 'middle';
                    g.fillText(text, c.width / 2, c.height / 2);
                    const t = new THREE.CanvasTexture(c);
                    t.needsUpdate = true;
                    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false });
                    return new THREE.Sprite(m);
                }

                const centerDot = new THREE.Mesh(
                    new THREE.CircleGeometry(0.08, 24),
                    new THREE.MeshBasicMaterial({
                        color: accent,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 1.0,
                        depthTest: false
                    })
                );
                centerDot.position.set(0, 0, bz + 0.002);
                centerDot.userData.isUnitGuide = true;
                backGroup.add(centerDot);

                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 128;
                labelCanvas.height = 64;
                const ctx = labelCanvas.getContext('2d');
                ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
                ctx.fillStyle = accentHex;
                ctx.font = 'bold 44px "Segoe UI", Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('O', labelCanvas.width / 2, labelCanvas.height / 2);

                const tex = new THREE.CanvasTexture(labelCanvas);
                tex.needsUpdate = true;
                const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
                const zeroSprite = new THREE.Sprite(spriteMat);
                zeroSprite.position.set(0, -0.28, bz + 0.001);
                zeroSprite.scale.set(0.55, 0.275, 1);
                zeroSprite.userData.isUnitGuide = true;
                backGroup.add(zeroSprite);

                const bigR = 2.2;
                const diamGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-bigR, 0, bz),
                    new THREE.Vector3( bigR, 0, bz)
                ]);
                const diamLine = new THREE.Line(diamGeo, dashedMat);
                diamLine.computeLineDistances();
                diamLine.userData.isUnitGuide = true;
                backGroup.add(diamLine);

                const br1a = makeTextSprite('1 br', accentHex);
                br1a.position.set(0.55, -0.20, bz + 0.01);
                br1a.scale.set(0.75, 0.28, 1);
                br1a.userData.isUnitGuide = true;
                backGroup.add(br1a);

                const br1b = makeTextSprite('1 br', accentHex);
                br1b.position.set(1.70, -0.20, bz + 0.01);
                br1b.scale.set(0.75, 0.28, 1);
                br1b.userData.isUnitGuide = true;
                backGroup.add(br1b);

                const radiusGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0,    0, bz),
                    new THREE.Vector3(bigR, 0, bz)
                ]);
                const solidMat = new THREE.LineBasicMaterial({
                    color: 0x22c55e,
                    linewidth: 2,
                    transparent: true,
                    opacity: 1.0,
                    depthTest: false
                });
                const radiusLine = new THREE.Line(radiusGeo, solidMat);
                radiusLine.userData.isUnitGuide = true;
                backGroup.add(radiusLine);
            }, 300);
            break;

        case 4:
            html += `<div class="instruction-box">
        <h3>Küçük Karenin Kenar Uzunluğu</h3>
        <p>Geometri tahtasında oluşturduğunuz <strong>küçük karenin kenar uzunluğu</strong> kaç birimdir?</p>
        <p style="margin-top:6px;font-size:.9em;color:var(--text-secondary);">İpucu: Küçük karenin köşeleri büyük dairenin üzerindedir. Büyük dairenin yarıçapı 2 birimdir.</p>
    </div>
    <div class="instruction-box" style="margin-top:8px;">
        <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;">Kenar uzunluğu:</label>
        <input type="text" id="app2SmallSideInput" class="input-field" placeholder="Cevabınız..."
            inputmode="none" readonly style="margin-bottom:4px;cursor:pointer;">
        <div id="app2SmallSideKeyboard" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${['1','2','√2','2√2','⌫'].map(k => {
                let label = k;
                if (k === '√2') label = '\\(\\sqrt{2}\\)';
                if (k === '2√2') label = '\\(2\\sqrt{2}\\)';
                return `<button type="button" class="num-btn app2skey" data-key="${k}" style="min-width:44px;padding:6px 10px;font-size:1em;">${label}</button>`;
            }).join('')}
        </div>
        <div id="app2SmallSideFeedback" style="margin-top:4px;"></div>
    </div>
    <div style="text-align:center;margin-top:10px;">
        <button class="action-button" id="app2SmallSideCheckBtn" disabled style="opacity:.4;">Kontrol Et</button>
    </div>
    <div id="app2SmallAreaSection" style="display:none;" class="instruction-box" style="margin-top:8px;">
        <p style="margin-top:4px;"><strong>Bu kenar uzunluğunu kullanarak küçük karenin alanını</strong> hesaplayınız.</p>
        <label style="font-size:.9em;color:var(--text-secondary);display:block;margin:8px 0 4px;">Küçük karenin alanı:</label>
        <input type="text" id="app2SmallAreaInput" class="input-field" placeholder="Cevabınız..."
            inputmode="none" readonly style="margin-bottom:4px;cursor:pointer;">
        <div id="app2SmallAreaKeyboard" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${['1','2','4','8','√2','⌫'].map(k => {
                let label = k;
                if (k === '√2') label = '\\(\\sqrt{2}\\)';
                return `<button type="button" class="num-btn app2sakey" data-key="${k}" style="min-width:44px;padding:6px 10px;font-size:1em;">${label}</button>`;
            }).join('')}
        </div>
        <div id="app2SmallAreaFeedback" style="margin-top:4px;"></div>
        <div style="text-align:center;margin-top:10px;">
            <button class="action-button" id="app2SmallAreaCheckBtn" disabled style="opacity:.4;">Kontrol Et</button>
            <div id="app2Step4NextArea" style="display:none;margin-top:8px;">
                <button class="action-button" id="app2Step4NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
            </div>
        </div>
    </div>`;
            $('#boardHint').text('📐 Küçük karenin kenar uzunluğunu bulun');
            break;

        case 5:
            html += `<div class="instruction-box">
        <h3>Büyük Karenin Alanı</h3>
        <p style="margin-top:8px;"><strong>Yeşil renkle belirtilen büyük çembere dıştan teğet olan büyük karenin alanını</strong> hesaplayınız.</p>
    </div>
    <div class="instruction-box" style="margin-top:8px;">
        <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;">Büyük karenin alanı:</label>
        <input type="text" id="app2BigAreaInput" class="input-field" placeholder="Cevabınız..."
            inputmode="none" readonly style="margin-bottom:4px;cursor:pointer;">
        <div id="app2BigAreaKeyboard" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${['4','8','16','32','⌫'].map(k => `<button type="button" class="num-btn app2bakey" data-key="${k}" style="min-width:44px;padding:6px 10px;font-size:1em;">${k}</button>`).join('')}
        </div>
        <div id="app2BigAreaFeedback" style="margin-top:4px;"></div>
    </div>
    <div style="text-align:center;margin-top:10px;">
        <button class="action-button" id="app2BigAreaCheckBtn" disabled style="opacity:.4;">Kontrol Et</button>
        <div id="app2Step5NextArea" style="display:none;margin-top:8px;">
            <button class="action-button" id="app2Step5NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
        </div>
    </div>`;
            $('#boardHint').text('Büyük çembere dıştan teğet büyük karenin alanını hesaplayınız.');
            break;

        case 6:
            html += `<div class="instruction-box">
        <h3>Şekillerin Alanlarını Sıralayalım</h3>
        <p>Oluşturduğunuz şekillerin alanlarını eşitsizlik kullanarak sıralayınız:</p>
        <div style="margin-top:10px;padding:12px;background:rgba(0,212,255,.07);border:2px solid var(--border-color);border-radius:10px;">
            <p style="font-size:.92em;margin-bottom:6px;">Hesapladığınız alanlar:</p>
            <ul style="line-height:2;font-size:.93em;">
                <li>Küçük kare: <strong>8 birim²</strong></li>
                <li>Büyük daire (yeşil, $r=2$): <strong>$4\\pi$ birim²</strong></li>
                <li>Büyük kare: <strong>16 birim²</strong></li>
            </ul>
        </div>
        <p style="margin-top:10px;">Eşitsizlikle sıralamayı yazınız:<br>
        <span style="font-size:.9em;color:var(--text-secondary);">Alan (küçük kare) ___ Alan (büyük daire) ___ Alan (büyük kare)</span></p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            ${['8 < 4π < 16','8 > 4π > 16','4π < 8 < 16','8 < 16 < 4π'].map((opt,i) =>
                `<button class="num-btn app2sortbtn" data-val="${opt}" style="flex:1;min-width:140px;padding:8px;font-size:.92em;white-space:nowrap;">${opt}</button>`
            ).join('')}
        </div>
        <div id="app2SortFeedback" style="margin-top:8px;"></div>
    </div>
    <div id="app2PiRangeSection" style="display:none;" class="instruction-box" style="margin-top:8px;">
        <p style="margin-top:4px;"><strong>$8 &lt; 4\\pi &lt; 16$</strong> eşitsizliğinin her tarafını 4'e bölünüz. π için ne elde edersiniz?</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            ${['2 < π < 4','1 < π < 4','2 < π < 8','0 < π < 4'].map(opt =>
                `<button class="num-btn app2pibtn" data-val="${opt}" style="flex:1;min-width:120px;padding:8px;font-size:.92em;">${opt}</button>`
            ).join('')}
        </div>
        <div id="app2PiFeedback" style="margin-top:8px;"></div>
        <div id="app2Step6NextArea" style="display:none;margin-top:8px;text-align:center;">
            <button class="action-button" id="app2Step6NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
        </div>
    </div>`;
            $('#boardHint').text('📊 Şekillerin alanlarını eşitsizlikle sıralayın');
            if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 200);
            break;

        case 7:
            html += `<div class="instruction-box">
        <h3>Ölçme ve Değerlendirme</h3>
        <p>Aşağıdaki soruyu cevaplayınız.</p>
    </div>`;
            $('#boardHint').text('🔢 Yarıçap=5 birim → Alan hangi tam sayılar arasında?');
            setTimeout(() => {
                const dialogHtml = `
                <div class="dialog-overlay" id="app2AssessDialog" style="display:flex;">
                    <div class="dialog-content" style="max-width:560px;">
                        <h2>Değerlendirme Sorusu</h2>
                        <img src="images/istenen.png" alt="Değerlendirme Görseli"
                            style="max-width:100%;max-height:220px;border-radius:10px;border:2px solid var(--border-color);object-fit:contain;display:block;margin:10px auto;">
                        <p style="margin-top:10px;">Yarıçap uzunluğu <strong>5 birim</strong> olan dairenin alanı hangi <strong>tam sayılar arasında</strong> yer almalıdır?</p>
                        <p style="font-size:.9em;color:var(--text-secondary);margin-top:4px;">Cevabınızı "küçük sayı-büyük sayı" formatında yazınız.</p>
                        <input type="text" id="app2AssessInput" class="input-field" placeholder="Cevabınızı yazınız..." style="margin-top:10px;">
                        <div id="app2AssessFeedback" style="margin-top:6px;"></div>
                        <div id="app2AssessNextArea" style="display:none;margin-top:10px;">
                            <div class="explain-box">
                                <p>✓ <strong>Çözüm:</strong><br>
                                $A = \\pi r^2 = 25\\pi$<br>
                                $2 &lt; \\pi &lt; 4$ eşitsizliği kullanılarak:<br>
                                $50 &lt; 25\\pi &lt; 100$<br>
                                Alan <strong>50 ile 100</strong> arasında yer alır.</p>
                            </div>
                        </div>
                        <div class="dialog-btn-row" style="margin-top:12px;">
                            <button class="action-button" id="app2AssessCheckBtn">Kontrol Et</button>
                            <button class="action-button" id="app2AssessFinishBtn" style="display:none;background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                        </div>
                    </div>
                </div>`;
                $('body').append(dialogHtml);
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                $('#app2AssessCheckBtn').on('click', function () {
                    const raw = $('#app2AssessInput').val().replace(/\s/g, '');
                    const ok = raw === '50,100' || raw === '50-100' || raw === '50ile100' || (raw.includes('50') && raw.includes('100'));
                    if (ok) {
                        $('#app2AssessFeedback').html('<div class="success-message">✓ Doğru! Alan=25π, 2&lt;π&lt;4 → 50&lt;25π&lt;100</div>');
                        $('#app2AssessNextArea').show();
                        $('#app2AssessCheckBtn').hide();
                        $('#app2AssessFinishBtn').show();
                        if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                    } else {
                        $('#app2AssessFeedback').html('<div class="error-message">✗ Yanlış. Alan=πr²=25π. 2&lt;π&lt;4 kullanarak sınırları bul.</div>');
                    }
                });
                $('#app2AssessFinishBtn').on('click', function () {
                    $('#app2AssessDialog').remove();
                    renderApp2Step(8);
                });
            }, 300);
            break;

        case 8:
            html += `<div class="success-message" style="padding:16px;text-align:center;">
        Uygulama 2 Tamamlandı!
    </div>
    <div class="instruction-box" style="margin-top:10px;">
        <h3>Bu Uygulamada Neler Öğrendik?</h3>
        <ul style="margin-top:8px;line-height:1.9;">
            <li>Geometri tahtasının arka yüzündeki <strong>12 ve 24 pinli çemberleri</strong> inceledik.</li>
            <li><strong>Daire alanı formülünü</strong> ($A = \\pi r^2$) hatırladık ve uyguladık.</li>
            <li>Büyük dairenin alanının <strong>$4\\pi$ birim²</strong> olduğunu hesapladık.</li>
            <li>Küçük karenin kenar uzunluğunun <strong>$2\\sqrt{2}$ birim</strong>, alanının <strong>8 birim²</strong> olduğunu bulduk.</li>
            <li>Büyük karenin alanının <strong>16 birim²</strong> olduğunu hesapladık.</li>
            <li>Şekillerin alanlarını karşılaştırarak <strong>$8 &lt; 4\\pi &lt; 16$</strong> eşitsizliğine ulaştık.</li>
            <li>Bu eşitsizliği 4'e bölerek <strong>$2 &lt; \\pi &lt; 4$</strong> sonucuna geometrik olarak ulaştık.</li>
            <li>π sayısının 2 ile 4 tam sayıları arasında bulunduğunu geometri tahtası ile görülmüştür.</li>
            <li>π gibi irrasyonel sayıların <strong>geometrik yorumunu</strong> yapabildik.</li>
        </ul>
    </div>
    <div style="text-align:center;margin-top:12px;">
        <button class="action-button" id="app2ToApp3Btn" style="font-size:15px;padding:12px 28px;">
            Uygulama 3'e Geç →
        </button>
    </div>`;
            $('#boardHint').text('Uygulama 2 tamamlandı!');
            break;
    }

    $('#contentArea').html(html);
    if (window.MathJax) MathJax.typesetPromise();

    /* Event bindings for App 2 */
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
                $(document).off('elasticAdded.bigSquare').on('elasticAdded.bigSquare', function (e, data) {
                    const target = window.app2TargetSquare;
                    if (!target) return;
                    const found = (data && data.source === 'corner') || elastics.some(el => {
                        if (!el.closed || el.pins.length !== 4) return false;
                        return target.every(tp => el.pins.some(p => p.r === tp.r && p.c === tp.c));
                    });
                    if (found) {
                        $(document).off('elasticAdded.bigSquare');
                        window.app2TargetSquare = null;
                        window.app2LockedPins = [{ r: 0, c: 0 }, { r: 0, c: 5 }, { r: 5, c: 5 }, { r: 5, c: 0 }];
                        if (frontGroup) frontGroup.children.filter(c => c.userData && c.userData.isGuide).forEach(g => frontGroup.remove(g));
                        $('#app2s2Btn').prop('disabled', false).css('opacity', '1');
                        $('#boardHint').text('✅ Harika! Büyük kare oluşturuldu. Devam edebilirsiniz.');
                    }
                });
            }

            if (window.app2subStep === 2) {
                $(document).off('elasticAdded.innerSquare').on('elasticAdded.innerSquare', function (e, data) {
                    if (!window.app2TargetInnerSquare) return;
                    if (data && data.source === 'corner') {
                        $(document).off('elasticAdded.innerSquare');
                        window.app2TargetInnerSquare = null;
                        backGroup && backGroup.children
                            .filter(c => c.userData && (c.userData.isGuide || c.userData.isCornerGuide))
                            .forEach(g => backGroup.remove(g));
                        $('#app2s2Btn').prop('disabled', false).css('opacity', '1');
                        $('#boardHint').text('✅ Harika! Küçük kare oluşturuldu. Devam edebilirsiniz.');
                    }
                });
            }

            $('#app2s2Btn').on('click', () => {
                $(document).off('elasticAdded.bigSquare');
                window._app2RebuildHook = null;
                if (window.app2subStep === 0) {
                    // dialog progresses internally
                } else if (window.app2subStep === 1) {
                    window.app2subStep = 2;
                    renderApp2Step(2);
                } else if (window.app2subStep === 2) {
                    window.app2subStep = 3;
                    window.app2BoardLocked = true;
                    renderApp2Step(3);
                } else {
                    window.app2subStep = undefined;
                    window.app2TargetSquare = null;
                    renderApp2Step(3);
                }
            });
            break;

        case 3:
            window.app2BoardLocked = true;
            $(document).off('click.app2key').on('click.app2key', '.app2key', function () {
                const k = $(this).data('key');
                const $inp = $('#app2RadiusInput');
                if (k === '⌫') {
                    $inp.val($inp.val().slice(0, -1));
                } else {
                    $inp.val($inp.val() + k);
                }
                const val = $inp.val().trim();
                $('#app2RadiusCheckBtn').prop('disabled', val === '').css('opacity', val === '' ? '0.4' : '1');
            });

            $('#app2RadiusCheckBtn').on('click', function () {
                const raw = $('#app2RadiusInput').val().trim().replace(/\s/g, '').toLowerCase();
                const ok = ['4π','4pi','π4','pi4','4*π','4*pi','π*4','pi*4','4·π','4·pi'].includes(raw);
                if (ok) {
                    $('#app2RadiusFeedback').html('<div class="success-message">✓ Doğru! $A = \\pi \\times 2^2 = 4\\pi$ birim²</div>');
                    $(this).hide();
                    $('#app2RadiusNextArea').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $('#app2RadiusFeedback').html('<div class="error-message">✗ Tekrar dene. İpucu: $A = \\pi r^2$, $r = 2$. Cevabı π cinsinden yazınız.</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                }
            });
            $('#app2s3Btn').on('click', () => {
                window.app2BoardLocked = false;
                renderApp2Step(4);
            });
            break;

        case 4:
            $(document).off('click.app2skey').on('click.app2skey', '.app2skey', function () {
                const k = $(this).data('key');
                const $inp = $('#app2SmallSideInput');
                $inp.val(k === '⌫' ? $inp.val().slice(0, -1) : $inp.val() + k);
                $('#app2SmallSideCheckBtn').prop('disabled', $inp.val().trim() === '').css('opacity', $inp.val().trim() === '' ? '0.4' : '1');
            });
            $(document).off('click.app2sakey').on('click.app2sakey', '.app2sakey', function () {
                const k = $(this).data('key');
                const $inp = $('#app2SmallAreaInput');
                $inp.val(k === '⌫' ? $inp.val().slice(0, -1) : $inp.val() + k);
                $('#app2SmallAreaCheckBtn').prop('disabled', $inp.val().trim() === '').css('opacity', $inp.val().trim() === '' ? '0.4' : '1');
            });
            $('#app2SmallSideCheckBtn').on('click', function () {
                const raw = $('#app2SmallSideInput').val().trim().replace(/\s/g, '');
                const ok = raw === '2√2' || raw === '2√2' || raw === '2*√2';
                if (ok) {
                    $('#app2SmallSideFeedback').html('<div class="success-message">✓ Doğru! Küçük karenin kenar uzunluğu $2\\sqrt{2}$ birimdir.</div>');
                    $(this).hide();
                    $('#app2SmallAreaSection').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $('#app2SmallSideFeedback').html('<div class="error-message">✗ Tekrar dene. İpucu: Köşeler çemberin üzerinde, yarıçap 2 birim. Pisagor teoremini kullan.</div>');
                }
            });
            $('#app2SmallAreaCheckBtn').on('click', function () {
                const raw = $('#app2SmallAreaInput').val().trim().replace(/\s/g, '');
                if (raw === '8') {
                    $('#app2SmallAreaFeedback').html('<div class="success-message">✓ Doğru! $(2\\sqrt{2})^2 = 8$ birim²</div>');
                    $(this).hide();
                    $('#app2Step4NextArea').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $('#app2SmallAreaFeedback').html('<div class="error-message">✗ Tekrar dene. Alan = kenar² = $(2\\sqrt{2})^2$ = ?</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                }
            });
            $('#app2Step4NextBtn').on('click', () => renderApp2Step(5));
            break;

        case 5:
            $(document).off('click.app2bakey').on('click.app2bakey', '.app2bakey', function () {
                const k = $(this).data('key');
                const $inp = $('#app2BigAreaInput');
                $inp.val(k === '⌫' ? $inp.val().slice(0, -1) : $inp.val() + k);
                $('#app2BigAreaCheckBtn').prop('disabled', $inp.val().trim() === '').css('opacity', $inp.val().trim() === '' ? '0.4' : '1');
            });
            $('#app2BigAreaCheckBtn').on('click', function () {
                const raw = $('#app2BigAreaInput').val().trim();
                if (raw === '16') {
                    $('#app2BigAreaFeedback').html('<div class="success-message">✓ Doğru! $4^2 = 16$ birim²</div>');
                    $(this).hide();
                    $('#app2Step5NextArea').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $('#app2BigAreaFeedback').html('<div class="error-message">✗ Tekrar dene. Alan = kenar² = $4^2$ = ?</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                }
            });
            $('#app2Step5NextBtn').on('click', () => renderApp2Step(6));
            break;

        case 6:
            $(document).off('click.app2sort').on('click.app2sort', '.app2sortbtn', function () {
                $('.app2sortbtn').removeClass('correct incorrect');
                if ($(this).data('val') === '8 < 4π < 16') {
                    $(this).addClass('correct');
                    $('#app2SortFeedback').html('<div class="success-message">✓ Doğru! $8 &lt; 4\\pi &lt; 16$</div>');
                    $('.app2sortbtn').prop('disabled', true);
                    $('#app2PiRangeSection').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $(this).addClass('incorrect');
                    setTimeout(() => $(this).removeClass('incorrect'), 800);
                    $('#app2SortFeedback').html('<div class="error-message">✗ Tekrar dene. Alan değerlerini karşılaştır.</div>');
                }
            });
            $(document).off('click.app2pi').on('click.app2pi', '.app2pibtn', function () {
                $('.app2pibtn').removeClass('correct incorrect');
                if ($(this).data('val') === '2 < π < 4') {
                    $(this).addClass('correct');
                    $('#app2PiFeedback').html('<div class="success-message">✓ Doğru! $2 &lt; \\pi &lt; 4$</div>');
                    $('.app2pibtn').prop('disabled', true);
                    $('#app2Step6NextArea').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $(this).addClass('incorrect');
                    setTimeout(() => $(this).removeClass('incorrect'), 800);
                    $('#app2PiFeedback').html('<div class="error-message">✗ Tekrar dene. $8 &lt; 4\\pi &lt; 16$ eşitsizliğini 4\'e böl.</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                }
            });
            $('#app2Step6NextBtn').on('click', () => renderApp2Step(7));
            break;

        case 7:
            // Dialog acts internally
            break;

        case 8:
            $('#app2ToApp3Btn').on('click', () => {
                $('[data-tab="app3"]').prop('disabled', false).click();
            });
            break;
    }
}

function hasClosedElasticWithPins(targetPins) {
    return elastics.some(el => {
        if (!el.closed || el.pins.length !== targetPins.length) return false;
        return targetPins.every(tp => el.pins.some(ep => ep.r === tp.r && ep.c === tp.c));
    });
}

function hasOpenElasticWithPins(p1, p2) {
    return elastics.some(el => {
        if (el.closed || el.pins.length !== 2) return false;
        const e1 = el.pins[0], e2 = el.pins[1];
        return (e1.r === p1.r && e1.c === p1.c && e2.r === p2.r && e2.c === p2.c) ||
               (e1.r === p2.r && e1.c === p2.c && e2.r === p1.r && e2.c === p1.c);
    });
}

/* ── Uygulama 3: Konveks Çokgenlerde Açıların Gizemi ── */
function loadApp3() {
    clearBoard();
    boardMode = 'draw';
    renderApp3Step(0);
}

function renderApp3Step(step) {
    window.currentApp3Step = step;
    updateToolbarStatus();
    clearBoard();
    boardMode = 'draw';
    const totalSteps = 10;
    const pct = Math.round(((step + 1) / totalSteps) * 100);
    let html = `<div class="progress-container">
    <div class="progress-label"><span>Uygulama 3 — Açıların Gizemi</span><span>${step + 1}/${totalSteps}</span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
</div>`;

    switch (step) {
        case 0:
            html += `<div class="instruction-box">
                <h3>Konveks Çokgenlerde Açıların Gizemi</h3>
                <p>Bu uygulamada geometri tahtasını kullanarak farklı konveks çokgenler oluşturacak, bu çokgenlerin köşegen sayıları ile iç açılarının toplamı arasındaki ilişkiyi ve genel bir formülü keşfedeceksiniz.</p>
                <p style="margin-top:8px;">Uygulamaya başlamak için lütfen ekranda beliren <strong>Dikkat Çekme</strong> sorusunu yanıtlayınız.</p>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app3s0StartDialogBtn">Soruyu Göster</button>
            </div>`;
            $('#boardHint').text('Beşgenin bir köşesinden kaç köşegen çizilir?');
            setTimeout(() => {
                const pentagon = [{ r: 0, c: 2 }, { r: 1, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 1 }, { r: 2, c: 0 }];
                elastics.push({ pins: pentagon, color: '#00d4ff', closed: true });
                rebuildBoard();
                openApp3s0Dialog();
            }, 300);
            break;

        case 1:
            html += `<div class="instruction-box">
                <h3>Dar Açılı Üçgen Oluşturma</h3>
                <p>Geometri tahtası üzerinde kesikli kırmızı çizgilerle gösterilen dar açılı üçgeni lastik yardımıyla oluşturunuz.</p>
                <p style="margin-top:6px;font-size:0.88em;color:var(--text-secondary);">İpucu: Üçgenin köşelerindeki pinleri sırayla seçiniz. Son adımda ilk seçtiğiniz pine tekrar tıklayarak lastiği kapatabilirsiniz.</p>
            </div>
            <div class="instruction-box" style="margin-top:8px; display:none;" id="app3Step1FeedbackArea">
                <div id="app3Step1Feedback"></div>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app3Step1CheckBtn">Kontrol Et</button>
                <div style="display:none;margin-top:8px;" id="app3Step1NextArea">
                    <button class="action-button" id="app3Step1NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);width:100%;">Devam Et ✓</button>
                </div>
            </div>`;
            setTimeout(() => {
                const triGuide = [{ r: 2, c: 1 }, { r: 2, c: 4 }, { r: 4, c: 2 }];
                if (typeof renderGuides3D === 'function') {
                    renderGuides3D([{ pins: triGuide, color: '#ef4444', closed: true }]);
                }
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Kesikli çizgilerle gösterilen dar açılı üçgeni çizin');
            break;

        case 2:
            html += `<div class="instruction-box">
                <h3>Paralel Doğruların Çizimi</h3>
                <p>Üçgenin sol kenarı ile çakışacak şekilde, lastik yardımıyla uzun bir doğru parçası oluşturunuz.</p>
                <p style="margin-top:6px;">Ardından, bu doğru parçasına paralel olan ve üçgenin sağ köşesinden (tepe noktasından) geçen diğer paralel doğru parçasını oluşturunuz.</p>
            </div>
            <div class="instruction-box" style="margin-top:8px;" id="app3Step2FeedbackArea">
                <div id="app3Step2Feedback"></div>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app3Step2CheckBtn">Kontrol Et</button>
                <div style="display:none;margin-top:8px;" id="app3Step2NextArea">
                    <button class="action-button" id="app3Step2NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                </div>
            </div>`;
            setTimeout(() => {
                elastics.push({ pins: [{ r: 2, c: 1 }, { r: 2, c: 4 }, { r: 4, c: 2 }], color: '#ff6b00', closed: true });
                if (typeof renderGuides3D === 'function') {
                    renderGuides3D([
                        { pins: [{ r: 0, c: 0 }, { r: 4, c: 2 }], color: '#ef4444', closed: false },
                        { pins: [{ r: 0, c: 3 }, { r: 4, c: 5 }], color: '#ef4444', closed: false }
                    ]);
                }
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Üçgenin kenarına paralel çizgileri çizin');
            break;

        case 3:
            html += `<div class="instruction-box">
                <h3>Dörtgenin İç Açıları Toplamı</h3>
                <p>Geometri tahtası üzerinde mavi renkli dörtgenin kesikli kırmızı çizgi ile gösterilen köşegenini lastik yardımıyla oluşturunuz.</p>
            </div>
            <div id="app3Step3Questions" style="display:none;">
                <div class="instruction-box" style="margin-top:8px;">
                    <p style="font-weight:bold;">Oluşan şekle göre aşağıdaki soruları cevaplayınız:</p>
                </div>
                <div class="instruction-box" style="margin-top:8px;">
                    <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;font-weight:bold;">Dörtgen, çizilen bu köşegenle kaç üçgensel bölgeye ayrılmıştır?</label>
                    <input type="text" id="quadTriCount" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                    <div id="quadTriCountFeedback" style="margin-top:4px;"></div>
                </div>
                <div class="instruction-box" style="margin-top:8px;">
                    <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;font-weight:bold;">Dörtgenin iç açılarının toplamı kaç derecedir?</label>
                    <input type="text" id="quadAngleSum" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                    <div id="quadAngleSumFeedback" style="margin-top:4px;"></div>
                </div>
                <div id="app3Step3Feedback" style="margin-top:8px;"></div>
                <div style="text-align:center;margin-top:10px;">
                    <button class="action-button" id="app3Step3CheckBtn">Kontrol Et</button>
                    <div style="display:none;margin-top:8px;" id="app3Step3NextArea">
                        <button class="action-button" id="app3Step3NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                    </div>
                </div>
            </div>`;
            setTimeout(() => {
                elastics.push({ pins: [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }], color: '#3b82f6', closed: true });
                if (typeof renderGuides3D === 'function') {
                    renderGuides3D([
                        { pins: [{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }], color: '#3b82f6', closed: true },
                        { pins: [{ r: 0, c: 0 }, { r: 4, c: 4 }], color: '#ef4444', closed: false }
                    ]);
                }
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Dörtgeni ve köşegenini oluşturun');
            break;

        case 4:
            html += `<div class="instruction-box">
                <h3>Beşgenin İç Açıları Toplamı</h3>
                <p>Geometri tahtası üzerinde gösterilen yeşil beşgenin, kesikli kırmızı çizgilerle belirtilen tek bir köşesinden çizilebilecek tüm köşegenlerini lastik yardımıyla oluşturunuz.</p>
            </div>
            <div id="app3Step4Questions" style="display:none;">
                <div class="instruction-box" style="margin-top:8px;">
                    <p style="font-weight:bold;">Oluşan şekle göre aşağıdaki soruları cevaplayınız:</p>
                </div>
                <div class="instruction-box" style="margin-top:8px;">
                    <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;"><b>Beşgen, tek bir köşeden çizilen köşegenlerle kaç üçgensel bölgeye ayrılmıştır?</b></label>
                    <input type="text" id="pentTriCount" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                    <div id="pentTriCountFeedback" style="margin-top:4px;"></div>
                </div>
                <div class="instruction-box" style="margin-top:8px;">
                    <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;"><b>Beşgenin iç açılarının toplamı kaç derecedir?</b></label>
                    <input type="text" id="pentAngleSum" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                    <div id="pentAngleSumFeedback" style="margin-top:4px;"></div>
                </div>
                <div id="pentAngleFeedback" style="margin-top:8px;"></div>
                <div style="text-align:center;margin-top:10px;">
                    <button class="action-button" id="app3Step4CheckBtn">Kontrol Et</button>
                    <div style="display:none;margin-top:8px;" id="app3Step4NextArea">
                        <button class="action-button" id="app3Step4NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                    </div>
                </div>
            </div>`;
            setTimeout(() => {
                const pent = [{ r: 0, c: 2 }, { r: 1, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 1 }, { r: 2, c: 0 }];
                elastics.push({ pins: pent, color: '#22c55e', closed: true });
                incrementElasticUse('#22c55e');
                if (typeof renderGuides3D === 'function') {
                    renderGuides3D([
                        { pins: pent, color: '#22c55e', closed: true },
                        { pins: [pent[4], pent[1]], color: '#ef4444', closed: false },
                        { pins: [pent[4], pent[2]], color: '#ef4444', closed: false }
                    ]);
                }
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Beşgeni ve köşegenlerini oluşturun');
            break;

        case 5:
            html += `<div class="instruction-box">
                <h3>Altıgenin İç Açıları Toplamı</h3>
                <p>Geometri tahtası üzerinde gösterilen mor altıgenin, kesikli kırmızı çizgilerle belirtilen tek bir köşesinden çizilebilecek tüm köşegenlerini lastik yardımıyla oluşturunuz.</p>
            </div>
            <div id="app3Step5Questions" style="display:none;">
                <div class="instruction-box" style="margin-top:8px;">
                    <p style="font-weight:bold;">Oluşan şekle göre aşağıdaki soruları cevaplayınız:</p>
                </div>
                <div class="instruction-box" style="margin-top:8px;">
                    <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;"><b>Altıgen, tek bir köşeden çizilen köşegenlerle kaç üçgensel bölgeye ayrılmıştır?</b></label>
                    <input type="text" id="hexTriCount" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                    <div id="hexTriCountFeedback" style="margin-top:4px;"></div>
                </div>
                <div class="instruction-box" style="margin-top:8px;">
                    <label style="font-size:.9em;color:var(--text-secondary);display:block;margin-bottom:6px;"><b>Altıgenin iç açılarının toplamı kaç derecedir?</b></label>
                    <input type="text" id="hexAngleSum" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                    <div id="hexAngleSumFeedback" style="margin-top:4px;"></div>
                </div>
                <div id="hexAngleFeedback" style="margin-top:8px;"></div>
                <div style="text-align:center;margin-top:10px;">
                    <button class="action-button" id="app3Step5CheckBtn">Kontrol Et</button>
                    <div style="display:none;margin-top:8px;" id="app3Step5NextArea">
                        <button class="action-button" id="app3Step5NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                    </div>
                </div>
            </div>`;
            setTimeout(() => {
                const hex = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                elastics.push({ pins: hex, color: '#a855f7', closed: true });
                if (typeof renderGuides3D === 'function') {
                    renderGuides3D([
                        { pins: hex, color: '#a855f7', closed: true },
                        { pins: [hex[5], hex[1]], color: '#ef4444', closed: false },
                        { pins: [hex[5], hex[2]], color: '#ef4444', closed: false },
                        { pins: [hex[5], hex[3]], color: '#ef4444', closed: false }
                    ]);
                }
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Altıgeni ve köşegenlerini oluşturun');
            break;

        case 6:
            html += `<div class="instruction-box">
                <h3>Verileri Tabloya Aktaralım</h3>
                <p><b>Elde ettiğimiz kenar sayıları ile iç açılarının toplamları arasındaki ilişkiyi gösteren aşağıdaki tabloyu tamamlayınız.</b></p>
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Çokgen İsmi</th>
                            <th>Kenar Sayısı</th>
                            <th>İç Açı Toplamı (°)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Üçgen</td>
                            <td>3</td>
                            <td><input type="text" id="tableTri" class="table-input"></td>
                        </tr>
                        <tr>
                            <td>Dörtgen</td>
                            <td>4</td>
                            <td><input type="text" id="tableQuad" class="table-input"></td>
                        </tr>
                        <tr>
                            <td>Beşgen</td>
                            <td>5</td>
                            <td><input type="text" id="tablePent" class="table-input"></td>
                        </tr>
                        <tr>
                            <td>Altıgen</td>
                            <td>6</td>
                            <td><input type="text" id="tableHex" class="table-input"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div id="app3Step6Feedback" style="margin-top:8px;"></div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app3Step6CheckBtn">Kontrol Et</button>
                <div style="display:none;margin-top:8px;" id="app3Step6NextArea">
                    <button class="action-button" id="app3Step6NextBtn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                </div>
            </div>`;
            setTimeout(() => {
                const hex = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                elastics.push({ pins: hex, color: '#a855f7', closed: true });
                elastics.push({ pins: [{ r: 2, c: 0 }, { r: 0, c: 4 }], color: '#ef4444', closed: false });
                elastics.push({ pins: [{ r: 2, c: 0 }, { r: 2, c: 5 }], color: '#ef4444', closed: false });
                elastics.push({ pins: [{ r: 2, c: 0 }, { r: 4, c: 4 }], color: '#ef4444', closed: false });
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Tablodaki boşlukları doldurun');
            break;

        case 7:
            html += `<div class="instruction-box">
                <h3>Genel Açı Formülünü Bulalım</h3>
                <p>Çokgenlerin kenar sayısı ($n$), bölünmüş üçgensel bölge sayısı ve iç açılarının toplamı arasındaki ilişkiyi özetleyelim:</p>
                <ul style="margin-top:6px;line-height:1.7;font-size:.92em;padding-left:16px;">
                    <li>Üçgen ($n=3$): $1$ üçgensel bölge $\\implies 1 \\times 180^\\circ = 180^\\circ$</li>
                    <li>Dörtgen ($n=4$): $2$ üçgensel bölge $\\implies 2 \\times 180^\\circ = 360^\\circ$</li>
                    <li>Beşgen ($n=5$): $3$ üçgensel bölge $\\implies 3 \\times 180^\\circ = 540^\\circ$</li>
                    <li>Altıgen ($n=6$): $4$ üçgensel bölge $\\implies 4 \\times 180^\\circ = 720^\\circ$</li>
                </ul>
                <p style="margin-top:10px;">Görüldüğü gibi, tek bir köşeden çizilen köşegenlerle oluşan üçgensel bölge sayısı, her zaman kenar sayısının ($n$) 2 eksiğidir; yani $n-2$ adettir.</p>
                <p style="margin-top:8px;"><b>Buna göre konveks bir $n$-genin iç açılarının toplamını veren genel formül aşağıdakilerden hangisidir?</b></p>
            </div>
            <div class="instruction-box" style="margin-top:8px;">
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <button class="option-button app3formula-opt" data-val="1">A) \\(n \\times 180^\\circ\\)</button>
                    <button class="option-button app3formula-opt" data-val="2">B) \\((n-3) \\times 180^\\circ\\)</button>
                    <button class="option-button app3formula-opt" data-val="3">C) \\((n-2) \\times 180^\\circ\\)</button>
                    <button class="option-button app3formula-opt" data-val="4">D) \\((n-2) \\times 360^\\circ\\)</button>
                </div>
                <div id="formulaFeedback" style="margin-top:8px;"></div>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app3s6Btn" disabled style="opacity:.4;">Devam Et</button>
            </div>`;
            setTimeout(() => {
                const hex = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                elastics.push({ pins: hex, color: '#a855f7', closed: true });
                elastics.push({ pins: [{ r: 2, c: 0 }, { r: 0, c: 4 }], color: '#ef4444', closed: false });
                elastics.push({ pins: [{ r: 2, c: 0 }, { r: 2, c: 5 }], color: '#ef4444', closed: false });
                elastics.push({ pins: [{ r: 2, c: 0 }, { r: 4, c: 4 }], color: '#ef4444', closed: false });
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Çokgen iç açıları genel formülü');
            break;

        case 8:
            html += `<div class="instruction-box">
                <h3>Değerlendirme Sorusu</h3>
            </div>
            <div class="instruction-box" style="margin-top:8px;">
                <p><strong>Soru:</strong></p>
                <p style="margin-top:4px;"><b>Konveks bir sekizgenin ($n=8$) iç açılarının toplamı kaç derecedir?</b></p>
                <input type="text" id="app3AssessInput" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
                <div id="app3AssessFeedback" style="margin-top:8px;"></div>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="action-button" id="app3AssessCheckBtn">Kontrol Et</button>
                <div style="display:none;margin-top:8px;" id="app3Step8NextArea">
                    <button class="action-button" id="app3s7Btn" style="background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
                </div>
            </div>`;
            setTimeout(() => {
                const oct = [{ r: 0, c: 2 }, { r: 0, c: 3 }, { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 5, c: 3 }, { r: 5, c: 2 }, { r: 3, c: 0 }, { r: 2, c: 0 }];
                elastics.push({ pins: oct, color: '#ffd700', closed: true });
                elastics.push({ pins: [oct[0], oct[2]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[3]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[4]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[5]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[6]], color: '#ef4444', closed: false });
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Sekizgenin iç açı toplamını hesaplayınız');
            break;

        case 9:
            html += `<div class="success-message" style="padding:18px;font-size:1.05em;text-align:center;">
                Tebrikler! Uygulama 3 tamamlandı!
            </div>
            <div class="instruction-box" style="margin-top:10px;">
                <h3>Bu Uygulamada Neler Öğrendik?</h3>
                <ul style="margin-top:8px;line-height:1.9;padding-left:16px;">
                    <li>Üçgenin iç açılarının toplamının her zaman <strong>180°</strong> olduğunu geometrik olarak ispatladık.</li>
                    <li>Konveks çokgenlerde tek bir köşeden çizilen köşegenlerin oluşturduğu üçgensel bölge sayısının, kenar sayısının ($n$) 2 eksiği yani $n - 2$ olduğunu keşfettik.</li>
                    <li>Çokgenlerin iç açılarının toplamını veren genel formülün $(n - 2) \\times 180°$ olduğunu ispatladık.</li>
                    <li>Formülü kullanarak sekizgenin iç açılarının toplamının $1080°$ olduğunu hesapladık.</li>
                </ul>
            </div>
            <div style="text-align:center;margin-top:12px;">
                <button class="action-button" id="app3FinishBtn" style="font-size:15px;padding:12px 28px;">
                    Derinleştirme'ye Geç →
                </button>
            </div>`;
            clearBoard();
            setTimeout(() => {
                const oct = [{ r: 0, c: 2 }, { r: 0, c: 3 }, { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 5, c: 3 }, { r: 5, c: 2 }, { r: 3, c: 0 }, { r: 2, c: 0 }];
                elastics.push({ pins: oct, color: '#ffd700', closed: true });
                elastics.push({ pins: [oct[0], oct[2]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[3]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[4]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[5]], color: '#ef4444', closed: false });
                elastics.push({ pins: [oct[0], oct[6]], color: '#ef4444', closed: false });
                rebuildBoard();
            }, 300);
            $('#boardHint').text('Uygulama 3 tamamlandı!');
            break;
    }

    $('#contentArea').html(html);
    if (window.MathJax) MathJax.typesetPromise();

    /* Event bindings for App 3 */
    switch (step) {
        case 0:
            $('#app3s0StartDialogBtn').on('click', function () {
                openApp3s0Dialog();
            });
            break;

        case 1: {
            const checkApp3Step1 = function () {
                const isTriangleDrawn = hasClosedElasticWithPins([{ r: 2, c: 1 }, { r: 2, c: 4 }, { r: 4, c: 2 }]);
                if (isTriangleDrawn) {
                    $('#app3Step1FeedbackArea').show();
                    $('#app3Step1Feedback').html('<div class="success-message">✓ Tebrikler! Dar açılı üçgeni geometri tahtasında başarıyla oluşturdunuz.</div>');
                    $('#app3Step1CheckBtn').hide();
                    $('#app3Step1NextArea').show();
                    $('#app3Step1NextBtn').off('click').on('click', () => {
                        $(document).off('.app3step1');
                        renderApp3Step(2);
                    });
                } else {
                    $('#app3Step1CheckBtn').show();
                    $('#app3Step1NextArea').hide();
                }
            };
            
            checkApp3Step1();

            $('#app3Step1CheckBtn').off('click').on('click', function () {
                const isTriangleDrawn = hasClosedElasticWithPins([{ r: 2, c: 1 }, { r: 2, c: 4 }, { r: 4, c: 2 }]);
                if (isTriangleDrawn) {
                    checkApp3Step1();
                } else {
                    $('#app3Step1FeedbackArea').show();
                    $('#app3Step1Feedback').html('<div class="error-message">✗ Tekrar deneyiniz. Lütfen tahtadaki kesikli kırmızı çizgileri takip ederek dar açılı üçgeni kapalı bir lastik halinde oluşturunuz.</div>');
                }
            });

            $(document).off('.app3step1');
            $(document).on('elasticAdded.app3step1 boardRebuilt.app3step1', function () {
                const isTriangleDrawn = hasClosedElasticWithPins([{ r: 2, c: 1 }, { r: 2, c: 4 }, { r: 4, c: 2 }]);
                if (!isTriangleDrawn) {
                    $('#app3Step1CheckBtn').show();
                    $('#app3Step1NextArea').hide();
                    $('#app3Step1FeedbackArea').hide();
                }
            });
            break;
        }

        case 2: {
            const checkApp3Step2 = function () {
                const isLine1Drawn = hasOpenElasticWithPins({ r: 0, c: 0 }, { r: 4, c: 2 }) || hasOpenElasticWithPins({ r: 2, c: 1 }, { r: 4, c: 2 });
                const isLine2Drawn = hasOpenElasticWithPins({ r: 0, c: 3 }, { r: 4, c: 5 }) || hasOpenElasticWithPins({ r: 2, c: 4 }, { r: 4, c: 5 }) || hasOpenElasticWithPins({ r: 0, c: 3 }, { r: 2, c: 4 });
                if (isLine1Drawn && isLine2Drawn) {
                    $('#app3Step2FeedbackArea').show();
                    $('#app3Step2Feedback').html(
                        `<div class="success-message" style="margin-bottom: 8px;">✓ Tebrikler! İki paralel doğruyu başarıyla oluşturdunuz.</div>
                        <div class="explain-box" style="line-height:1.5; font-size:0.92em; border-left:4px solid var(--success-bg); padding-left:10px; margin-top:8px; text-align:left;">
                            <p><strong>Üçgenin İç Açıları Toplamının İspatı:</strong></p>
                            <p style="margin-top:4px;">Geometri tahtasında iç açıları sırasıyla <strong>a (pembe)</strong>, <strong>b (mavi)</strong> ve <strong>c (yeşil)</strong> olan bir üçgen bulunmaktadır.</p>
                            <p style="margin-top:6px;">Oluşturduğunuz paralel doğru parçaları sayesinde:</p>
                            <ul style="margin-top:4px; padding-left:16px; list-style-type:disc;">
                                <li><strong>a</strong> açısı, iç ters açılar (Z kuralı) gereği tepe noktasındaki <strong>a'</strong> açısına eşittir (yani $a = a'$ dir).</li>
                                <li><strong>b</strong> açısı da benzer şekilde iç ters açılar gereği tepe noktasındaki <strong>b'</strong> açısına eşittir (yani $b = b'$ dir).</li>
                            </ul>
                            <p style="margin-top:6px;">Böylece, tepe noktasında oluşan <strong>a', c ve b'</strong> açıları paralel doğru üzerinde yan yana gelerek bir <strong>doğru açı ($180^\\circ$)</strong> oluşturur.</p>
                            <p style="margin-top:6px; font-weight:bold;">Sonuç olarak, bir üçgenin iç açılarının toplamı:<br>$a + b + c = 180^\\circ$ olarak ispatlanır!</p>
                        </div>`
                    );
                    if (window.MathJax) MathJax.typesetPromise();
                    $('#app3Step2CheckBtn').hide();
                    $('#app3Step2NextArea').show();
                    startApp3Step2AngleAnimation();
                } else {
                    $('#app3Step2CheckBtn').show();
                    $('#app3Step2NextArea').hide();
                }
            };

            checkApp3Step2();

            $('#app3Step2CheckBtn').off('click').on('click', function () {
                const isLine1Drawn = hasOpenElasticWithPins({ r: 0, c: 0 }, { r: 4, c: 2 }) || hasOpenElasticWithPins({ r: 2, c: 1 }, { r: 4, c: 2 });
                const isLine2Drawn = hasOpenElasticWithPins({ r: 0, c: 3 }, { r: 4, c: 5 }) || hasOpenElasticWithPins({ r: 2, c: 4 }, { r: 4, c: 5 }) || hasOpenElasticWithPins({ r: 0, c: 3 }, { r: 2, c: 4 });
                if (isLine1Drawn && isLine2Drawn) {
                    checkApp3Step2();
                } else {
                    let missingMsg = "";
                    if (!isLine1Drawn && !isLine2Drawn) {
                        missingMsg = "Her iki doğru parçası da henüz oluşturulmadı.";
                    } else if (!isLine1Drawn) {
                        missingMsg = "Üçgenin sol kenarı ile çakışan kılavuz doğrusu eksik.";
                    } else {
                        missingMsg = "Üçgenin sağ köşesinden geçen paralel kılavuz doğrusu eksik.";
                    }
                    $('#app3Step2FeedbackArea').show();
                    $('#app3Step2Feedback').html(`<div class="error-message">✗ Tekrar deneyiniz. ${missingMsg} Lütfen tahtadaki kesikli kılavuz çizgilerini takip ederek lastikleri yerleştiriniz.</div>`);
                }
            });

            $(document).off('.app3step2');
            $(document).on('elasticAdded.app3step2 boardRebuilt.app3step2', function () {
                const isLine1Drawn = hasOpenElasticWithPins({ r: 0, c: 0 }, { r: 4, c: 2 }) || hasOpenElasticWithPins({ r: 2, c: 1 }, { r: 4, c: 2 });
                const isLine2Drawn = hasOpenElasticWithPins({ r: 0, c: 3 }, { r: 4, c: 5 }) || hasOpenElasticWithPins({ r: 2, c: 4 }, { r: 4, c: 5 }) || hasOpenElasticWithPins({ r: 0, c: 3 }, { r: 2, c: 4 });
                if (!isLine1Drawn || !isLine2Drawn) {
                    $('#app3Step2CheckBtn').show();
                    $('#app3Step2NextArea').hide();
                    $('#app3Step2FeedbackArea').hide();
                }
            });

            $('#app3Step2NextBtn').off('click').on('click', () => {
                $(document).off('.app3step2');
                renderApp3Step(3);
            });
            break;
        }

        case 3: {
            const checkDiagDrawn = function () {
                const isDiagDrawn = hasOpenElasticWithPins({ r: 0, c: 0 }, { r: 4, c: 4 });
                if (isDiagDrawn) {
                    $('#app3Step3Questions').show();
                } else {
                    $('#app3Step3Questions').hide();
                }
            };

            checkDiagDrawn();

            $(document).off('.app3step3');
            $(document).on('elasticAdded.app3step3 boardRebuilt.app3step3', function () {
                checkDiagDrawn();
            });

            $('#app3Step3CheckBtn').off('click').on('click', function () {
                const isQuadDrawn = hasClosedElasticWithPins([{ r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }, { r: 4, c: 0 }]);
                const isDiagDrawn = hasOpenElasticWithPins({ r: 0, c: 0 }, { r: 4, c: 4 });
                const triCount = $('#quadTriCount').val().trim();
                const angleSum = $('#quadAngleSum').val().trim();

                const isShapeOk = isQuadDrawn && isDiagDrawn;
                const isAnswersOk = (triCount === '2' || triCount === 'iki') && angleSum === '360';

                if (isShapeOk && isAnswersOk) {
                    $('#app3Step3Feedback').html('<div class="success-message">✓ Harika! Köşegeni doğru çizdiniz ve iç açılarının toplamını ($2 \\times 180^\\circ = 360^\\circ$) başarıyla hesapladınız.</div>');
                    $('#app3Step3CheckBtn').hide();
                    $('#app3Step3NextArea').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    let errMsg = "Lütfen cevaplarınızı kontrol edip tekrar deneyiniz. ";
                    if (!isShapeOk) errMsg += "Lütfen dörtgeni ve kılavuzda gösterilen köşegenini doğru biçimde oluşturduğunuzdan emin olunuz. ";
                    if (!isAnswersOk) errMsg += "Soruları lütfen tekrar gözden geçiriniz. Köşegenin dörtgeni kaç üçgensel bölgeye ayırdığına dikkat ediniz. Bir üçgenin iç açılarının toplamının $180^\\circ$ olduğunu kullanarak dörtgenin iç açılarının toplamını bulabilirsiniz.";
                    $('#app3Step3Feedback').html(`<div class="error-message">✗ ${errMsg}</div>`);
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                }
            });
            $('#app3Step3NextBtn').off('click').on('click', () => {
                $(document).off('.app3step3');
                renderApp3Step(4);
            });
            break;
        }

        case 4: {
            const checkDiagDrawn = function () {
                const isDiag1Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 1, c: 4 });
                const isDiag2Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 3, c: 4 });
                if (isDiag1Drawn && isDiag2Drawn) {
                    $('#app3Step4Questions').show();
                } else {
                    $('#app3Step4Questions').hide();
                }
            };

            checkDiagDrawn();

            $(document).off('.app3step4');
            $(document).on('elasticAdded.app3step4 boardRebuilt.app3step4', function () {
                checkDiagDrawn();
            });

            $('#app3Step4CheckBtn').on('click', function () {
                const pent = [{ r: 0, c: 2 }, { r: 1, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 1 }, { r: 2, c: 0 }];
                const isPentDrawn = hasClosedElasticWithPins(pent);
                const isDiag1Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 1, c: 4 });
                const isDiag2Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 3, c: 4 });
                const triCount = $('#pentTriCount').val().trim();
                const angleSum = $('#pentAngleSum').val().trim();

                const isShapeOk = isPentDrawn && isDiag1Drawn && isDiag2Drawn;
                if (!isShapeOk) {
                    $('#pentAngleFeedback').html('<div class="error-message">✗ Lütfen beşgeni ve tek köşeden çıkan 2 köşegeni kesikli kılavuz çizgilerini takip ederek çiziniz.</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                    return;
                }

                $('#pentAngleFeedback').html('');

                const isTriOk = triCount === '3' || triCount === 'üç';
                const isAngleOk = angleSum === '540';

                if (isTriOk) {
                    $('#pentTriCount').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                    $('#pentTriCountFeedback').html('<div class="success-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✓ Doğru</div>');
                } else {
                    $('#pentTriCountFeedback').html('<div class="error-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✗ Tekrar deneyiniz. Çizdiğiniz köşegenlerin beşgeni kaç adet üçgensel bölgeye ayırdığını tekrar sayabilirsiniz.</div>');
                }

                if (isAngleOk) {
                    $('#pentAngleSum').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                    $('#pentAngleSumFeedback').html('<div class="success-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✓ Doğru</div>');
                } else {
                    $('#pentAngleSumFeedback').html('<div class="error-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✗ Tekrar deneyiniz. Bir üçgenin iç açılarının toplamının $180^\\circ$ olduğunu hatırlayarak beşgenin iç açılarının toplamını hesaplamayı deneyiniz.</div>');
                }

                if (isTriOk && isAngleOk) {
                    $('#pentAngleFeedback').html('<div class="success-message">✓ Tebrikler! Beşgenin köşegenlerini başarıyla çizdiniz. İç açılarının toplamı: $3 \\times 180^\\circ = 540^\\circ$ olur.</div>');
                    $('#app3Step4CheckBtn').hide();
                    $('#app3Step4NextArea').show();
                }
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
            });
            $('#app3Step4NextBtn').off('click').on('click', () => {
                $(document).off('.app3step4');
                renderApp3Step(5);
            });
            break;
        }

        case 5: {
            const checkDiagDrawn = function () {
                const isDiag1Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 0, c: 4 });
                const isDiag2Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 2, c: 5 });
                const isDiag3Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 4, c: 4 });
                if (isDiag1Drawn && isDiag2Drawn && isDiag3Drawn) {
                    $('#app3Step5Questions').show();
                } else {
                    $('#app3Step5Questions').hide();
                }
            };

            checkDiagDrawn();

            $(document).off('.app3step5');
            $(document).on('elasticAdded.app3step5 boardRebuilt.app3step5', function () {
                checkDiagDrawn();
            });

            $('#app3Step5CheckBtn').on('click', function () {
                const hex = [{ r: 0, c: 2 }, { r: 0, c: 4 }, { r: 2, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 2 }, { r: 2, c: 0 }];
                const isHexDrawn = hasClosedElasticWithPins(hex);
                const isDiag1Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 0, c: 4 });
                const isDiag2Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 2, c: 5 });
                const isDiag3Drawn = hasOpenElasticWithPins({ r: 2, c: 0 }, { r: 4, c: 4 });
                const triCount = $('#hexTriCount').val().trim();
                const angleSum = $('#hexAngleSum').val().trim();

                const isShapeOk = isHexDrawn && isDiag1Drawn && isDiag2Drawn && isDiag3Drawn;
                if (!isShapeOk) {
                    $('#hexAngleFeedback').html('<div class="error-message">✗ Lütfen altıgeni ve tek köşeden çıkan 3 köşegeni kesikli kılavuz çizgilerini takip ederek çiziniz.</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                    return;
                }

                $('#hexAngleFeedback').html('');

                const isTriOk = triCount === '4' || triCount === 'dört';
                const isAngleOk = angleSum === '720';

                if (isTriOk) {
                    $('#hexTriCount').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                    $('#hexTriCountFeedback').html('<div class="success-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✓ Doğru</div>');
                } else {
                    $('#hexTriCountFeedback').html('<div class="error-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✗ Tekrar deneyiniz. Çizdiğiniz köşegenlerin altıgeni kaç adet üçgensel bölgeye ayırdığını tekrar sayabilirsiniz.</div>');
                }

                if (isAngleOk) {
                    $('#hexAngleSum').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                    $('#hexAngleSumFeedback').html('<div class="success-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✓ Doğru</div>');
                } else {
                    $('#hexAngleSumFeedback').html('<div class="error-message" style="margin:2px 0; padding:4px 8px; font-size:0.9em;">✗ Tekrar deneyiniz. Bir üçgenin iç açılarının toplamının $180^\\circ$ olduğunu hatırlayarak altıgenin iç açılarının toplamını hesaplamayı deneyiniz.</div>');
                }

                if (isTriOk && isAngleOk) {
                    $('#hexAngleFeedback').html('<div class="success-message">✓ Tebrikler! Altıgenin köşegenlerini başarıyla çizdiniz. İç açılarının toplamı: $4 \\times 180^\\circ = 720^\\circ$ olur.</div>');
                    $('#app3Step5CheckBtn').hide();
                    $('#app3Step5NextArea').show();
                }
                if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
            });
            $('#app3Step5NextBtn').off('click').on('click', () => {
                $(document).off('.app3step5');
                renderApp3Step(6);
            });
            break;
        }

        case 6:
            $('#app3Step6CheckBtn').on('click', function () {
                const tri = $('#tableTri').val().trim();
                const quad = $('#tableQuad').val().trim();
                const pent = $('#tablePent').val().trim();
                const hex = $('#tableHex').val().trim();

                const isTriOk = tri === '180';
                const isQuadOk = quad === '360';
                const isPentOk = pent === '540';
                const isHexOk = hex === '720';

                let errorFields = [];

                if (isTriOk) {
                    $('#tableTri').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                } else {
                    $('#tableTri').css({'border-color': 'var(--error-bg)', 'background': 'rgba(239, 68, 68, 0.1)'});
                    errorFields.push('Üçgen');
                }

                if (isQuadOk) {
                    $('#tableQuad').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                } else {
                    $('#tableQuad').css({'border-color': 'var(--error-bg)', 'background': 'rgba(239, 68, 68, 0.1)'});
                    errorFields.push('Dörtgen');
                }

                if (isPentOk) {
                    $('#tablePent').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                } else {
                    $('#tablePent').css({'border-color': 'var(--error-bg)', 'background': 'rgba(239, 68, 68, 0.1)'});
                    errorFields.push('Beşgen');
                }

                if (isHexOk) {
                    $('#tableHex').prop('disabled', true).css({'border-color': 'var(--success-bg)', 'background': 'rgba(34, 197, 94, 0.1)'});
                } else {
                    $('#tableHex').css({'border-color': 'var(--error-bg)', 'background': 'rgba(239, 68, 68, 0.1)'});
                    errorFields.push('Altıgen');
                }

                if (isTriOk && isQuadOk && isPentOk && isHexOk) {
                    $('#app3Step6Feedback').html('<div class="success-message">✓ Tebrikler! Tablodaki tüm değerleri başarıyla doldurdunuz.</div>');
                    $('#app3Step6CheckBtn').hide();
                    $('#app3Step6NextArea').show();
                } else {
                    $('#app3Step6Feedback').html(`<div class="error-message">✗ Tabloda yanlış veya eksik değerler var (${errorFields.join(', ')}). Lütfen kenar sayısı ile oluşan üçgen sayısı arasındaki ilişkiden yararlanarak değerleri gözden geçiriniz.</div>`);
                }
            });
            $('#app3Step6NextBtn').on('click', () => renderApp3Step(7));
            break;

        case 7:
            $(document).off('click.app3formula').on('click.app3formula', '.app3formula-opt', function () {
                const val = parseInt($(this).data('val'));
                $('.app3formula-opt').removeClass('selected incorrect correct');
                if (val === 3) {
                    $(this).addClass('selected correct');
                    $('#formulaFeedback').html('<div class="success-message">✓ Tebrikler! Doğru formül <strong>(n-2) × 180^\\circ</strong>\'dir. Konveks bir çokgen, tek bir köşesinden çizilen köşegenlerle kenar sayısının 2 eksiği kadar üçgensel bölgeye ayrılır ve iç açılarının toplamı bu değer ile 180^\\circ\'nin çarpımı ile bulunur.</div>');
                    $('#app3s6Btn').prop('disabled', false).css('opacity', '1');
                    $('.app3formula-opt').prop('disabled', true);
                } else {
                    $(this).addClass('selected incorrect');
                    $('#formulaFeedback').html('<div class="error-message">✗ Tekrar deneyiniz. İpucu: n kenarlı konveks bir çokgenin n-2 adet üçgensel bölgeye ayrıldığını ve her bir üçgensel bölgenin iç açılar toplamının 180^\\circ olduğunu hatırlayınız.</div>');
                }
            });
            $('#app3s6Btn').on('click', () => renderApp3Step(8));
            break;

        case 8:
            $('#app3AssessCheckBtn').on('click', function () {
                const rawSum = $('#app3AssessInput').val().trim().replace(/\s/g, '');
                if (rawSum === '1080') {
                    $('#app3AssessFeedback').html('<div class="success-message">✓ Tebrikler! Doğru cevap. \\((8-2) \\times 180^\\circ = 6 \\times 180^\\circ = 1080^\\circ\\) elde edilir.</div>');
                    $('#app3AssessCheckBtn').hide();
                    $('#app3Step8NextArea').show();
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                } else {
                    $('#app3AssessFeedback').html('<div class="error-message">✗ Tekrar deneyiniz. İpucu: Elde ettiğimiz genel formülü kullanınız: \\((n-2) \\times 180^\\circ\\). Sekizgen için \\(n = 8\\) değerini formülde yerine yazarak hesaplayabilirsiniz.</div>');
                    if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 100);
                }
            });
            $('#app3s7Btn').on('click', () => renderApp3Step(9));
            break;

        case 9:
            $('#app3FinishBtn').on('click', () => {
                $('[data-tab="deep"]').prop('disabled', false).click();
            });
            break;
    }
}

function openApp3s0Dialog() {
    $('#app3s0Dialog').remove();
    const dlg = `
    <div class="dialog-overlay" id="app3s0Dialog" style="display:flex;">
        <div class="dialog-content" style="max-width:500px;">
            <h2>Dikkat Çekme</h2>
            <img src="images/besgen.png" alt="Beşgen Görseli"
                style="max-width:100%;max-height:220px;display:block;margin:10px auto;object-fit:contain;">
            <p style="margin-top:10px;font-size:1.02em;line-height:1.6;font-weight:bold;text-align:center;">
                Bir konveks beşgenin bir köşesinden çizilebilecek köşegen sayısı kaçtır?
            </p>
            <input type="text" id="app3s0Input" class="input-field" placeholder="Cevabınızı yazınız..." style="margin-top:12px;width:100%;text-align:center;font-size:1.05em;">
            <div id="app3s0Feedback" style="margin-top:8px;text-align:center;"></div>
            <div class="dialog-btn-row" style="margin-top:12px;gap:10px;">
                <button class="action-button" id="app3s0CheckBtn">Kontrol Et</button>
                <button class="action-button" id="app3s0NextBtn" style="display:none;background:var(--success-bg);border-color:var(--success-bg);">Devam Et ✓</button>
            </div>
        </div>
    </div>`;
    $('body').append(dlg);
    $('#app3s0CheckBtn').on('click', function() {
        const raw = $('#app3s0Input').val().trim().replace(/\s/g, '').toLowerCase();
        const ok = raw === '2' || raw === 'iki' || raw === '2adet' || raw === '2tane';
        if (ok) {
            $('#app3s0Feedback').html('<div class="success-message">✓ Tebrikler! Doğru cevap. Beşgenin bir köşesinden, kendisine ve komşu olan diğer iki köşeye köşegen çizilemeyeceğinden toplam 2 köşegen çizilebilir ($5 - 3 = 2$).</div>');
            $('#app3s0CheckBtn').hide();
            $('#app3s0NextBtn').show();
        } else {
            $('#app3s0Feedback').html('<div class="error-message">✗ Tekrar deneyiniz. İpucu: Çokgenlerde köşegen, bir köşeden kendisine komşu olmayan diğer köşelere çizilen doğru parçasıdır. Beşgende seçtiğiniz bir köşeden, kendisi ve iki komşusu dışındaki diğer köşelere kaç köşegen çizebilirsiniz?</div>');
        }
    });
    $('#app3s0NextBtn').on('click', function() {
        $('#app3s0Dialog').remove();
        renderApp3Step(1);
    });
}

/* ── Derinleştirme ── */
function loadDeep() {
    updateToolbarStatus();
    clearBoard();
    boardMode = 'draw';
    
    let html = `<div class="instruction-box">
    <h3>Derinleştirme</h3>
    <p>Geometri tahtası üzerinde sarı kesikli çizgilerle gösterilen <strong>5×4 boyutundaki dikdörtgeni</strong> lastik yardımıyla oluşturunuz.</p>
</div>
<div id="deepQuestionsArea" style="display:none;">
    <div class="instruction-box" style="margin-top:10px;">
        <p style="font-weight:bold;">Oluşturduğunuz bu dikdörtgensel bölge içerisinde, köşeleri tahtanın pinleri üzerinde olacak şekilde çizilebilecek tüm karelerin toplam sayısı kaçtır?</p>
        <input type="text" id="deepSquareCount" class="input-field" placeholder="Cevabınızı yazınız..." style="width:100%;">
    </div>
    <div id="deepFeedback" style="margin-top:10px;"></div>
    <div style="text-align:center;margin-top:12px;">
        <button class="action-button" id="deepCheckBtn">Kontrol Et</button>
        <button class="action-button" id="deepResetBtn" style="display:none;background:var(--success-bg);border-color:var(--success-bg);width:100%;margin-top:10px;">Başa Dön</button>
    </div>
</div>`;

    $('#contentArea').html(html);
    if (window.MathJax) MathJax.typesetPromise();

    // 5x4 kılavuz çizgisini göster
    setTimeout(() => {
        if (typeof renderGuides3D === 'function') {
            renderGuides3D([
                { pins: [{ r: 0, c: 0 }, { r: 0, c: 5 }, { r: 4, c: 5 }, { r: 4, c: 0 }], color: '#eab308', closed: true }
            ]);
        }
        rebuildBoard();
    }, 300);
    $('#boardHint').text('Kesikli çizgilerle gösterilen 5x4\'lük dikdörtgeni çizin');

    const checkRectDrawn = function () {
        if (has5x4Rectangle()) {
            $('#deepQuestionsArea').show();
        } else {
            $('#deepQuestionsArea').hide();
        }
    };

    checkRectDrawn();

    $(document).off('.deepstep');
    $(document).on('elasticAdded.deepstep boardRebuilt.deepstep', function () {
        checkRectDrawn();
    });

    // Kontrol mekanizması
    $('#deepCheckBtn').on('click', function () {
        const inputVal = $('#deepSquareCount').val().trim().replace(/\s/g, '');
        const isAnswerCorrect = inputVal === '40';
        const isShapeCorrect = has5x4Rectangle();

        if (isShapeCorrect && isAnswerCorrect) {
            $('#freeTabBtn').prop('disabled', false);
            $('#deepFeedback').html(
                `<div class="success-message" style="margin-bottom: 8px;">✓ Tebrikler! Doğru cevap: 40</div>
                <div class="explain-box" style="line-height:1.6; font-size:0.92em; border-left:4px solid var(--success-bg); padding-left:10px; text-align:left; background:var(--bg-secondary); border-radius:6px; padding:12px; margin-top:8px;">
                    <p style="font-weight:bold; margin-bottom: 4px;">1. Yöntem (Kare Boyutlarına Göre Sayma):</p>
                    <p style="margin-bottom: 8px;">
                        $1 \\times 1$ boyutunda $1 \\text{ birimkarelik}$ kareler: $5 \\times 4 = 20 \\text{ adet}$,<br>
                        $2 \\times 2$ boyutunda $4 \\text{ birimkarelik}$ kareler: $4 \\times 3 = 12 \\text{ adet}$,<br>
                        $3 \\times 3$ boyutunda $9 \\text{ birimkarelik}$ kareler: $3 \\times 2 = 6 \\text{ adet}$,<br>
                        $4 \\times 4$ boyutunda $16 \\text{ birimkarelik}$ kareler: $2 \\times 1 = 2 \\text{ adet}$.<br>
                        Buna göre elde edilebilecek toplam kare sayısı: $20 + 12 + 6 + 2 = 40$ adettir.
                    </p>
                    <p style="font-weight:bold; margin-bottom: 4px;">2. Yöntem (Kombinasyon Yoluyla Hesaplama):</p>
                    <p style="margin-bottom: 8px;">
                        Kombinasyon formülü kullanılarak yatay ve dikey doğruların seçimiyle de aynı sonuca ulaşabiliriz:<br>
                        $2 \\times \\left( \\binom{2}{2} + \\binom{3}{2} + \\binom{4}{2} + \\binom{5}{2} \\right) = 40$
                    </p>
                    <button class="action-button" id="goToFreeBtn" style="margin-top:12px; width:100%; background:var(--button-bg); box-shadow: 0 0 10px var(--border-glow); border-color:var(--border-color);">Serbest Mod'a Git →</button>
                </div>`
            );
            if (window.MathJax) MathJax.typesetPromise();
            $('#deepCheckBtn').hide();
            $('#deepResetBtn').show();

            $('#goToFreeBtn').off('click').on('click', function () {
                $('#freeTabBtn').removeClass('active');
                $('#freeTabBtn').prop('disabled', false).click();
            });
        } else {
            let errMsg = "";
            if (!isShapeCorrect && !isAnswerCorrect) {
                errMsg = "Lütfen geometri tahtası üzerinde 5×4 boyutundaki dikdörtgeni oluşturunuz ve bu bölgedeki toplam kare sayısını yeniden hesaplayınız.";
            } else if (!isShapeCorrect) {
                errMsg = "Cevabınız doğru (40)! Ancak geometri tahtasında 5×4 boyutundaki dikdörtgeni henüz çizmediniz. Lütfen sarı kesikli çizgilerle gösterilen dikdörtgeni kapalı bir lastik şeklinde oluşturunuz.";
            } else {
                errMsg = "Çiziminiz doğru! Ancak hesapladığınız toplam kare sayısı hatalı. Lütfen kare boyutlarına dikkat ederek tekrar hesaplayınız.";
            }
            $('#deepFeedback').html(`<div class="error-message">✗ Tekrar deneyiniz. ${errMsg}</div>`);
            if (window.MathJax) MathJax.typesetPromise();
        }
    });

    $('#deepResetBtn').on('click', function () {
        $(document).off('.deepstep');
        $('[data-tab="intro"]').click();
    });
}

function has5x4Rectangle() {
    return elastics.some(el => {
        if (!el.closed || el.pins.length !== 4) return false;
        const rows = el.pins.map(p => p.r);
        const cols = el.pins.map(p => p.c);
        const minR = Math.min(...rows), maxR = Math.max(...rows);
        const minC = Math.min(...cols), maxC = Math.max(...cols);
        
        const height = maxR - minR;
        const width = maxC - minC;
        
        const isSizeOk = (height === 5 && width === 4) || (height === 4 && width === 5);
        if (!isSizeOk) return false;
        
        const corners = [
            { r: minR, c: minC },
            { r: minR, c: maxC },
            { r: maxR, c: maxC },
            { r: maxR, c: minC }
        ];
        return corners.every(c => el.pins.some(p => p.r === c.r && p.c === c.c));
    });
}

function loadFree() {
    updateToolbarStatus();
    clearBoard();
    boardMode = 'draw';
    let html = `<div class="instruction-box">
    <h3>Serbest Mod</h3>
        <p>Bu modda geometri tahtasını tamamen özgürce kullanabilirsiniz. İstediğiniz geometrik şekilleri oluşturabilirsiniz. Bunun için sağ taraftaki araçlar çubuğunu kullanabilirsiniz.</p>
    </div>`;
    $('#contentArea').html(html);
    $('#boardHint').text('📌 Serbest Mod — pinlere tıklayarak istediğiniz şekilleri oluşturun');
}

function startApp3Step2AngleAnimation() {
    if (!frontGroup) return;

    // Animasyon yardımcıları (kapsüllenmiş)
    function createSectorMesh(color, start, len, opacity = 0.75) {
        const geo = new THREE.RingGeometry(0, 0.38, 32, 1, start, len);
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.isElastic = true; // clearBoard ile temizlensin
        mesh.userData.isAngleSector = true;
        mesh.renderOrder = 1500;
        return mesh;
    }

    function createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        
        ctx.font = 'Bold 64px Inter, system-ui, sans-serif';
        // Beyaz gölge/kontur
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(text, 64, 64);
        
        ctx.fillStyle = color;
        ctx.fillText(text, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
            map: texture,
            depthTest: false,
            transparent: true
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.42, 0.42, 1);
        sprite.userData.isElastic = true; // clearBoard ile temizlensin
        sprite.userData.isAngleSprite = true;
        sprite.renderOrder = 2000;
        return sprite;
    }

    function getLabelOffset(start, len) {
        const bisector = start + len / 2;
        return new THREE.Vector3(Math.cos(bisector) * 0.22, Math.sin(bisector) * 0.22, 0.02);
    }

    // Önceki animasyonu temizle
    if (typeof currentStep2AnimationId !== 'undefined' && currentStep2AnimationId !== null) {
        cancelAnimationFrame(currentStep2AnimationId);
        currentStep2AnimationId = null;
    }

    // Önceki açı dilimleri ve etiketleri temizle
    const oldObjects = frontGroup.children.filter(c => c.userData && (c.userData.isAngleSector || c.userData.isAngleSprite));
    oldObjects.forEach(obj => frontGroup.remove(obj));

    const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
    function get3DPos(r, c) {
        return new THREE.Vector3(
            offset + c * PIN3D_GAP,
            -(offset + r * PIN3D_GAP),
            BOARD3D_THICK / 2 + 0.21
        );
    }

    const posA = get3DPos(2, 1);
    const posB = get3DPos(4, 2);
    const posC = get3DPos(2, 4);

    // Başlangıç ve bitiş açı parametreleri (Radyan cinsinden)
    const a_start_init = -1.107;
    const a_len_init = 1.107;
    const a_start_final = 2.034;
    const a_len_final = 1.107;

    const b_start_init = 0.785;
    const b_len_init = 1.249;
    const b_start_final = 3.927; // 5*pi/4
    const b_len_final = 1.249;

    const c_start = Math.PI;
    const c_len = Math.PI / 4;

    // Renk tanımları
    const colorA = '#ec4899'; // pembe (a)
    const colorB = '#0ea5e9'; // mavi (b)
    const colorC = '#84cc16'; // yeşil (c)

    // Orijinal açı dilimlerini oluştur (Üçgenin içinde sabit kalacaklar, yarı saydam)
    const meshA = createSectorMesh(colorA, a_start_init, a_len_init, 0.45);
    const meshB = createSectorMesh(colorB, b_start_init, b_len_init, 0.45);
    const meshC = createSectorMesh(colorC, c_start, c_len, 0.8);

    meshA.position.copy(posA);
    meshB.position.copy(posB);
    meshC.position.copy(posC);

    frontGroup.add(meshA);
    frontGroup.add(meshB);
    frontGroup.add(meshC);

    // Taşınacak açı dilimlerini oluştur (Daha opak, hareket edecekler)
    const meshAPrime = createSectorMesh(colorA, a_start_init, a_len_init, 0.85);
    const meshBPrime = createSectorMesh(colorB, b_start_init, b_len_init, 0.85);

    meshAPrime.position.copy(posA);
    meshBPrime.position.copy(posB);

    frontGroup.add(meshAPrime);
    frontGroup.add(meshBPrime);

    // Etiketleri oluştur
    const spriteA = createTextSprite('a', colorA);
    const spriteB = createTextSprite('b', colorB);
    const spriteC = createTextSprite('c', colorC);
    const spriteAPrime = createTextSprite("a'", colorA);
    const spriteBPrime = createTextSprite("b'", colorB);

    // Sabit etiketleri yerleştir
    spriteA.position.copy(posA).add(getLabelOffset(a_start_init, a_len_init));
    spriteB.position.copy(posB).add(getLabelOffset(b_start_init, b_len_init));
    spriteC.position.copy(posC).add(getLabelOffset(c_start, c_len));

    frontGroup.add(spriteA);
    frontGroup.add(spriteB);
    frontGroup.add(spriteC);
    
    // Taşınan etiketleri ekle
    frontGroup.add(spriteAPrime);
    frontGroup.add(spriteBPrime);

    const duration = 2200; // 2.2 saniye sürsün
    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        let t = elapsed / duration;
        if (t > 1.0) t = 1.0;

        // Easing: ease-in-out
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        // 1. A' açısını (pembe) güncelle
        const currentPosAPrime = new THREE.Vector3().lerpVectors(posA, posC, ease);
        meshAPrime.position.copy(currentPosAPrime);

        const currentStartAPrime = a_start_init * (1 - ease) + a_start_final * ease;
        const currentLenAPrime = a_len_init * (1 - ease) + a_len_final * ease;

        meshAPrime.geometry.dispose();
        meshAPrime.geometry = new THREE.RingGeometry(0, 0.38, 32, 1, currentStartAPrime, currentLenAPrime);

        const offsetAPrime = getLabelOffset(currentStartAPrime, currentLenAPrime);
        spriteAPrime.position.copy(currentPosAPrime).add(offsetAPrime);

        // 2. B' açısını (mavi) güncelle
        const currentPosBPrime = new THREE.Vector3().lerpVectors(posB, posC, ease);
        meshBPrime.position.copy(currentPosBPrime);

        const currentStartBPrime = b_start_init * (1 - ease) + b_start_final * ease;
        const currentLenBPrime = b_len_init * (1 - ease) + b_len_final * ease;

        meshBPrime.geometry.dispose();
        meshBPrime.geometry = new THREE.RingGeometry(0, 0.38, 32, 1, currentStartBPrime, currentLenBPrime);

        const offsetBPrime = getLabelOffset(currentStartBPrime, currentLenBPrime);
        spriteBPrime.position.copy(currentPosBPrime).add(offsetBPrime);

        if (t < 1.0) {
            currentStep2AnimationId = requestAnimationFrame(animate);
        } else {
            currentStep2AnimationId = null;
        }
    }

    currentStep2AnimationId = requestAnimationFrame(animate);
}
