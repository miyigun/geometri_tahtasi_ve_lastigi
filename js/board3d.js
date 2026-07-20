/* ══ 3D GEOMETRİ TAHTASI (THREE.JS) İŞLEMLERİ ══════════════════════════ */

function getThemeColors() {
    const dark = currentTheme === 'dark';
    return {
        board: dark ? 0x1a3a6b : 0x2563eb,
        boardEdge: dark ? 0x0d2244 : 0x1d4ed8,
        pin: dark ? 0x4a9fd4 : 0x93c5fd,
        bg: dark ? '#0a0e27' : '#e8eef5',
    };
}

function initThreeJS() {
    if (threeRenderer) return; // Zaten başlatıldı

    const container = document.getElementById('threeContainer');
    const canvas = document.getElementById('threeCanvas');

    // WebGL Renderer
    threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    threeRenderer.setSize(container.clientWidth, container.clientHeight);
    threeRenderer.shadowMap.enabled = true;

    // Scene
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(currentTheme === 'dark' ? 0x0a0e27 : 0xf0f4f8);

    // Camera
    threeCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    const isMobile = window.innerWidth <= 640;
    threeCamera.position.set(0, 0, isMobile ? 13 : 9);

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

    if (typeof window.lockedFace !== 'undefined') {
        setLockedFace(window.lockedFace);
    } else {
        const activeTab = typeof $ !== 'undefined' ? $('.tab-button.active').data('tab') : 'intro';
        if (activeTab === 'app2') setLockedFace('back');
        else if (activeTab === 'free') setLockedFace(null);
        else setLockedFace('front');
    }

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

    // Animate loop
    function animate() {
        threeAnimId = requestAnimationFrame(animate);
        threeControls.update();
        autoDetectFace();
        threeRenderer.render(threeScene, threeCamera);
    }
    animate();

    // Raycasting for pin clicks
    let _ptrDownPos = { x: 0, y: 0 };
    canvas.addEventListener('pointerdown', (e) => { _ptrDownPos = { x: e.clientX, y: e.clientY }; dragStarted = false; });
    canvas.addEventListener('pointerup', (e) => {
        const dx = e.clientX - _ptrDownPos.x, dy = e.clientY - _ptrDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 12) onThreePinClick(e);
    });
}

function autoDetectFace() {
    if (!threeCamera || !frontGroup || !backGroup) return;
    const camZ = threeCamera.position.z;
    const normal = new THREE.Vector3(0, 0, 1);
    normal.applyQuaternion(frontGroup.parent ? frontGroup.parent.quaternion : new THREE.Quaternion());
    const dot = normal.dot(threeCamera.position.clone().normalize());
    currentFace = dot >= 0 ? 'front' : 'back';
}

function buildFront() {
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
            const y = -(offset + r * PIN3D_GAP);
            pin.position.set(x, y, BOARD3D_THICK / 2 + 0.08);
            pin.rotation.x = Math.PI / 2;
            pin.castShadow = true;
            pin.userData = { r, c, isPinMesh: true };
            frontGroup.add(pin);
            pinMeshes.push(pin);
        }
    }

    updateElastics3D();
    if (typeof renderGuides3D === 'function') renderGuides3D(currentGuides3D);
}

function buildBack() {
    while (backGroup.children.length) backGroup.remove(backGroup.children[0]);

    const boardColor = currentTheme === 'dark' ? 0x1a3a6b : 0x2563eb;

    // Arka tahta
    const boardGeo = new THREE.BoxGeometry(BOARD3D_SIZE, BOARD3D_SIZE, BOARD3D_THICK);
    const boardMat = new THREE.MeshPhongMaterial({ color: boardColor, shininess: 40 });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.z = -0.001;
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
    const cornerInset = 2.2 * 0.985;
    const corners = [
        [-cornerInset, cornerInset],
        [cornerInset, cornerInset],
        [cornerInset, -cornerInset],
        [-cornerInset, -cornerInset],
    ];
    corners.forEach(([x, y], i) => {
        const mat = new THREE.MeshPhongMaterial({ color: cornerPinColor, emissive: 0x000000, emissiveIntensity: 0 });
        const pin = new THREE.Mesh(cornerPinGeo, mat);
        pin.position.set(x, y, -(BOARD3D_THICK / 2 + 0.08));
        pin.rotation.x = Math.PI / 2;
        pin.userData = { isCirclePin: true, circleType: 'corner', idx: i, baseColor: cornerPinColor };
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
    
    // Çizgi (halka kılavuzu)
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

function updateElastics3D() {
    if (!frontGroup) return;
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

        const color = parseInt(el.color.replace('#', ''), 16);
        const tubeMat = new THREE.MeshPhongMaterial({
            color, shininess: 80, emissive: color,
            emissiveIntensity: 0.15, transparent: true, opacity: 0.92
        });

        const wrappedPoints = getWrappedPath(points, PIN3D_R, el.closed);
        if (wrappedPoints.length >= 2) {
            const pathCurve = new PointListCurve(wrappedPoints);
            const tubularSegments = Math.max(20, wrappedPoints.length * 3);
            const segGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.028, 8, false);
            const segMesh = new THREE.Mesh(segGeo, tubeMat.clone());
            segMesh.castShadow = true;
            segMesh.userData.isElastic = true;
            frontGroup.add(segMesh);
            elasticMeshes.push(segMesh);
        }

        el.pins.forEach(p => {
            const idx = p.r * GRID3D_N + p.c;
            if (pinMeshes[idx]) {
                pinMeshes[idx].material.emissive.setHex(color);
                pinMeshes[idx].material.emissiveIntensity = 0.25;
            }
        });
    });

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

    // Ön yüz hits
    const frontHits = ray.intersectObjects(pinMeshes, false);
    if (frontHits.length > 0) {
        const pin = frontHits[0].object;
        const { r, c } = pin.userData;
        animatePinSelect(pin);
        handleGridPinClick3D(r, c);
        return;
    }

    // Arka yüz hits
    const backPinMeshes = backGroup.children.filter(ch => ch.isMesh && ch.userData.isCirclePin);
    const backHits = ray.intersectObjects(backPinMeshes, false);
    if (backHits.length > 0) {
        const pin = backHits[0].object;
        handleCirclePinClick3D(pin);
        return;
    }
}

function handleGridPinClick3D(r, c) {
    if (typeof isDrawingAllowed === 'function' && !isDrawingAllowed()) return;
    if (window.app2BoardLocked) return;
    const key = `grid-${r}-${c}`;

    if (selected3DPinsAll.length >= 3) {
        const first = selected3DPinsAll[0];
        if (first.type === 'grid' && first.r === r && first.c === c) {
            _commitGridPolygon(true);
            return;
        }
    }

    const existIdx = selected3DPinsAll.findIndex(p => p.type === 'grid' && p.r === r && p.c === c);
    if (existIdx >= 0) {
        if (existIdx === 1 && selected3DPinsAll.length === 2) {
            _commitGridPolygon(false); // commit as open line segment
            return;
        }
        if (existIdx === selected3DPinsAll.length - 1) {
            selected3DPinsAll.pop();
            updatePinSelectionColors();
            updatePreview3D();
        }
        return;
    }

    if (selected3DPinsAll.length === 0 && getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) {
        const colorName = ELASTIC_COLORS.find(c => c.hex === currentElasticColor)?.name;
        showLimitToast(colorName);
        return;
    }

    const mesh = pinMeshes.find(m => m.userData.r === r && m.userData.c === c);
    selected3DPinsAll.push({ type: 'grid', r, c, mesh, key });

    // App 3, Adım 2, 3, 4, 5 için 2-pin seçildiğinde otomatik lastik geçirme
    const isApp3Active = $('.tab-button[data-tab="app3"]').hasClass('active');
    const isApp3StepAutoCommit = isApp3Active && [2, 3, 4, 5].includes(window.currentApp3Step);
    if (isApp3StepAutoCommit && selected3DPinsAll.length === 2) {
        _commitGridPolygon(false);
        return;
    }

    updatePinSelectionColors();
    updatePreview3D();
    $(document).trigger('pinSelected', { r, c, count: selected3DPinsAll.length });
}

function handleCirclePinClick3D(pinMesh) {
    if (typeof isDrawingAllowed === 'function' && !isDrawingAllowed()) return;
    if (window.app2BoardLocked) return;
    const { circleType, idx } = pinMesh.userData;
    const key = `circle-${circleType}-${idx}`;

    const cornerPinsNow = selected3DPinsAll.filter(p => p.type === 'circle' && p.circleType === 'corner');
    if (circleType === 'corner' && cornerPinsNow.length >= 3 && cornerPinsNow[0].key === key) {
        backGroup.children
            .filter(c => c.userData && (c.userData.isCornerGuide || c.userData.isGuide))
            .forEach(g => backGroup.remove(g));

        const positions = cornerPinsNow.map(p => p.mesh.position);
        const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
        const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
        const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
        const tubeColor = new THREE.Color(rc, gc, bc);
        try {
            const wrappedPoints = getWrappedPath(positions, 0.07, true);
            if (wrappedPoints.length >= 2) {
                const pathCurve = new PointListCurve(wrappedPoints);
                const tubularSegments = Math.max(20, wrappedPoints.length * 3);
                const tubeGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.025, 8, false);
                const tube = new THREE.Mesh(tubeGeo,
                    new THREE.MeshPhongMaterial({ color: tubeColor, shininess: 80, specular: 0x444444 })
                );
                tube.userData.isElastic = true;
                backGroup.add(tube);
            }
        } catch (e) { console.warn(e); }

        cornerPinsNow.forEach(p => {
            p.mesh.material.color.setHex(p.mesh.userData.baseColor || 0xef4444);
            p.mesh.material.emissive && p.mesh.material.emissive.setHex(0x000000);
            p.mesh.material.emissiveIntensity = 0;
            p.mesh.scale.setScalar(1.0);
        });

        elastics.push({
            pins: cornerPinsNow.map(p => {
                const ud = p.mesh.userData;
                return { r: ud.r !== undefined ? ud.r : p.idx, c: ud.c !== undefined ? ud.c : p.idx };
            }),
            color: currentElasticColor,
            closed: true
        });

        incrementElasticUse(currentElasticColor);
        updateSwatchBadges();

        selected3DPinsAll = selected3DPinsAll.filter(p => p.circleType !== 'corner');
        $(document).trigger('elasticAdded', { count: elastics.length, source: 'corner' });
        if (window.app2subStep === 2) {
            $('#app2s2Btn').prop('disabled', false).css('opacity', '1');
            $('#boardHint').text('✅ Harika! İç kare oluşturuldu. Devam edebilirsiniz.');
        }
        $(document).trigger('elasticAdded.innerSquare', { count: 1, source: 'corner' });
        return;
    }

    const existIdx = selected3DPinsAll.findIndex(p => p.key === key);
    if (existIdx >= 0) {
        if (existIdx === selected3DPinsAll.length - 1) {
            selected3DPinsAll.pop();
            updatePinSelectionColors();
            
            // Kılavuz çizgilerini yeniden güncelle
            if (backGroup) {
                const guides = backGroup.children.filter(c => c.userData && (c.userData.isCornerGuide || c.userData.isGuide));
                guides.forEach(g => backGroup.remove(g));
                
                const cornerPins = selected3DPinsAll.filter(p => p.type === 'circle' && p.circleType === 'corner');
                if (cornerPins.length >= 2) {
                    const positions = cornerPins.map(p => p.mesh.position);
                    const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
                    const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
                    const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
                    try {
                        const wrappedPoints = getWrappedPath(positions, 0.07, false);
                        if (wrappedPoints.length >= 2) {
                            const pathCurve = new PointListCurve(wrappedPoints);
                            const tubularSegments = Math.max(20, wrappedPoints.length * 3);
                            const tubeGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.025, 8, false);
                            const tube = new THREE.Mesh(tubeGeo,
                                new THREE.MeshPhongMaterial({ color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444 })
                            );
                            tube.userData.isCornerGuide = true;
                            backGroup.add(tube);
                        }
                    } catch (e) { console.warn(e); }
                }
            }
        }
        return;
    }

    selected3DPinsAll.push({ type: 'circle', circleType, idx, mesh: pinMesh, key });

    pinMesh.material.color.setHex(0xffd700);
    pinMesh.material.emissive && pinMesh.material.emissive.setHex(0xaa6600);
    pinMesh.material.emissiveIntensity = 0.5;
    pinMesh.scale.setScalar(1.3);

    const cornerPins = selected3DPinsAll.filter(p => p.type === 'circle' && p.circleType === 'corner');

    if (cornerPins.length >= 2) {
        const prevPin = cornerPins[cornerPins.length - 2];
        const newPin  = cornerPins[cornerPins.length - 1];
        const segA = `${prevPin.key}-${newPin.key}`;
        const segB = `${newPin.key}-${prevPin.key}`;
        backGroup.children
            .filter(c => c.userData && c.userData.isGuide &&
                (c.userData.segKey === segA || c.userData.segKey === segB))
            .forEach(g => backGroup.remove(g));

        backGroup.children
            .filter(c => c.userData && c.userData.isCornerGuide)
            .forEach(g => backGroup.remove(g));

        const positions = cornerPins.map(p => p.mesh.position);
        const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
        const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
        const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
        try {
            const wrappedPoints = getWrappedPath(positions, 0.07, false);
            if (wrappedPoints.length >= 2) {
                const pathCurve = new PointListCurve(wrappedPoints);
                const tubularSegments = Math.max(20, wrappedPoints.length * 3);
                const tubeGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.025, 8, false);
                const tube = new THREE.Mesh(tubeGeo,
                    new THREE.MeshPhongMaterial({ color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444 })
                );
                tube.userData.isCornerGuide = true;
                backGroup.add(tube);
            }
        } catch (e) { console.warn(e); }
    }

    const firstPin = cornerPins[0];
    const lastPin = cornerPins[cornerPins.length - 1];
    const closedByReturn = cornerPins.length === 4 &&
        firstPin && lastPin && firstPin.key === lastPin.key;

    if (cornerPins.length === 5 || (cornerPins.length === 4 && closedByReturn)) {
        backGroup.children
            .filter(c => c.userData && (c.userData.isCornerGuide || c.userData.isGuide))
            .forEach(g => backGroup.remove(g));

        const uniquePins = cornerPins.slice(0, 4);
        const positions = uniquePins.map(p => p.mesh.position);
        const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
        const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
        const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
        const tubeColor = new THREE.Color(rc, gc, bc);
        const tubeMat = new THREE.MeshPhongMaterial({ color: tubeColor, shininess: 80, specular: 0x444444 });

        try {
            const wrappedPoints = getWrappedPath(positions, 0.07, true);
            if (wrappedPoints.length >= 2) {
                const pathCurve = new PointListCurve(wrappedPoints);
                const tubularSegments = Math.max(20, wrappedPoints.length * 3);
                const tubeGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.025, 8, false);
                const tube = new THREE.Mesh(tubeGeo, tubeMat);
                tube.userData.isElastic = true;
                backGroup.add(tube);
            }
        } catch (e) { console.warn(e); }

        uniquePins.forEach(p => {
            p.mesh.material.color.setHex(p.mesh.userData.baseColor || 0xef4444);
            p.mesh.material.emissive && p.mesh.material.emissive.setHex(0x000000);
            p.mesh.material.emissiveIntensity = 0;
            p.mesh.scale.setScalar(1.0);
        });

        elastics.push({
            pins: uniquePins.map(p => {
                const ud = p.mesh.userData;
                return { r: ud.r !== undefined ? ud.r : p.idx, c: ud.c !== undefined ? ud.c : p.idx };
            }),
            color: currentElasticColor,
            closed: true
        });

        incrementElasticUse(currentElasticColor);
        updateSwatchBadges();

        selected3DPinsAll = selected3DPinsAll.filter(p => p.circleType !== 'corner');
        $(document).trigger('elasticAdded', { count: elastics.length, source: 'corner' });
        if (window.app2subStep === 2) {
            $('#app2s2Btn').prop('disabled', false).css('opacity', '1');
            $('#boardHint').text('✅ Harika! İç kare oluşturuldu. Devam edebilirsiniz.');
        }
        return;
    }

    if (circleType === 'corner') return;
    if (window.app2subStep === 2) return;

    const isCornerMode = selected3DPinsAll.some(p => p.type === 'circle' && p.circleType === 'corner');
    const requiredCount = isCornerMode ? 4 : 2;
    if (selected3DPinsAll.length === requiredCount) {
        const [pinA, pinB] = selected3DPinsAll;

        backGroup.children
            .filter(ch => ch.userData && ch.userData.isGuide)
            .forEach(g => backGroup.remove(g));

        const posA = getPinWorldPos(pinA);
        const posB = getPinWorldPos(pinB);
        const R_pin = (pinA.circleType === 'corner' || pinB.circleType === 'corner') ? 0.07 : 0.06;
        try {
            const wrappedPoints = getWrappedPath([posA, posB], R_pin, true);
            const pathCurve = new PointListCurve(wrappedPoints);
            const tubeGeo = new THREE.TubeGeometry(pathCurve, 40, 0.025, 8, false);
            const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
            const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
            const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
            const tube = new THREE.Mesh(tubeGeo,
                new THREE.MeshPhongMaterial({ color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444 })
            );
            tube.userData.isElastic = true;
            backGroup.add(tube);

            elastics.push({
                pins: [pinA, pinB].map(p => {
                    const ud = p.mesh ? p.mesh.userData : (p.userData || p);
                    return { r: ud.r !== undefined ? ud.r : p.idx, c: ud.c !== undefined ? ud.c : p.idx };
                }),
                color: currentElasticColor,
                closed: false
            });
            incrementElasticUse(currentElasticColor);
            updateSwatchBadges();
            $(document).trigger('elasticAdded', { count: elastics.length });
        } catch (e) { console.warn(e); }

        selected3DPinsAll = [];
        updatePinSelectionColors();
        return;
    }
}

function _commitGridPolygon(closed) {
    if (selected3DPinsAll.length < 2) return;
    const gridPins = selected3DPinsAll.filter(p => p.type === 'grid');
    if (gridPins.length < 2) return;

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

    try {
        const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
        const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
        const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
        const segColor = new THREE.Color(rc, gc, bc);
        const segMatBase = new THREE.MeshPhongMaterial({ color: segColor, shininess: 80, specular: 0x444444 });

        const wrappedPoints = getWrappedPath(pts3D, PIN3D_R, closed);
        if (wrappedPoints.length >= 2) {
            const pathCurve = new PointListCurve(wrappedPoints);
            const tubularSegments = Math.max(20, wrappedPoints.length * 3);
            const segGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.025, 8, false);
            const segMesh = new THREE.Mesh(segGeo, segMatBase);
            segMesh.userData.isElastic = true;
            frontGroup.add(segMesh);
            elasticMeshes.push(segMesh);
        }

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

        const elObj = { pins: gridPins.map(p => ({ r: p.r, c: p.c })), color: currentElasticColor, closed };
        elastics.push(elObj);

        incrementElasticUse(currentElasticColor);
        updateSwatchBadges();
        $(document).trigger('elasticAdded', { count: elastics.length });
    } catch (e) { console.warn('_commitGridPolygon error:', e); }

    selected3DPinsAll = [];
    updatePinSelectionColors();
    if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
}

function _commitCirclePolygon(closed) {
    if (selected3DPinsAll.length < 2) return;
    const circlePins = selected3DPinsAll.filter(p => p.type === 'circle');
    if (circlePins.length < 2) return;

    if (getElasticUseCount(currentElasticColor) >= ELASTIC_MAX_USE) {
        const colorName = ELASTIC_COLORS.find(c => c.hex === currentElasticColor)?.name;
        showLimitToast(colorName);
        selected3DPinsAll = [];
        updatePinSelectionColors();
        if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
        return;
    }

    const pts3D = circlePins.map(p => getPinWorldPos(p));

    try {
        const R_pin = circlePins.some(p => p.circleType === 'corner') ? 0.07 : 0.06;
        const wrappedPoints = getWrappedPath(pts3D, R_pin, closed);
        if (wrappedPoints.length >= 2) {
            const pathCurve = new PointListCurve(wrappedPoints);
            const tubularSegments = Math.max(20, wrappedPoints.length * 3);
            const tubeGeo = new THREE.TubeGeometry(pathCurve, tubularSegments, 0.025, 8, false);
            const rc = parseInt(currentElasticColor.slice(1, 3), 16) / 255;
            const gc = parseInt(currentElasticColor.slice(3, 5), 16) / 255;
            const bc = parseInt(currentElasticColor.slice(5, 7), 16) / 255;
            const mat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(rc, gc, bc), shininess: 80, specular: 0x444444
            });
            const tube = new THREE.Mesh(tubeGeo, mat);
            tube.userData.isElastic = true;
            backGroup.add(tube);

            elastics.push({
                pins: circlePins.map(p => {
                    const ud = p.mesh ? p.mesh.userData : (p.userData || p);
                    return { r: ud.r !== undefined ? ud.r : p.idx, c: ud.c !== undefined ? ud.c : p.idx };
                }),
                color: currentElasticColor,
                closed
            });
            incrementElasticUse(currentElasticColor);
            updateSwatchBadges();
            $(document).trigger('elasticAdded', { count: elastics.length });
        }
    } catch (e) { console.warn('_commitCirclePolygon error:', e); }

    selected3DPinsAll = [];
    updatePinSelectionColors();
    if (previewLine3D) { frontGroup.remove(previewLine3D); previewLine3D = null; }
}

function updatePinSelectionColors() {
    const pinColor = currentTheme === 'dark' ? 0x4a9fd4 : 0x93c5fd;
    const guidePins = window.app2TargetSquare || [];
    pinMeshes.forEach(m => {
        const sel = selected3DPinsAll.find(p => p.type === 'grid' && p.r === m.userData.r && p.c === m.userData.c);
        if (sel) {
            m.material.color.setHex(0xffd700);
            m.material.emissive.setHex(0xaa6600);
            m.material.emissiveIntensity = 0.5;
            m.scale.setScalar(1.4);
        } else {
            m.material.color.setHex(pinColor);
            m.material.emissive && m.material.emissive.setHex(0x000000);
            m.material.emissiveIntensity = 0;
            m.scale.setScalar(1.0);
        }
    });

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
    pinMesh.scale.setScalar(1.8);
    let t = 0;
    const anim = setInterval(() => {
        t += 0.1;
        const s = 1.8 - 0.8 * Math.min(t, 1);
        pinMesh.scale.setScalar(s);
        if (t >= 1) {
            clearInterval(anim);
            pinMesh.scale.setScalar(1.0);
            const stillSelected = selected3DPinsAll.some(p =>
                p.type === 'circle' &&
                p.circleType === pinMesh.userData.circleType &&
                p.idx === pinMesh.userData.idx
            ) || selected3DPinsAll.some(p => p.mesh === pinMesh);
            if (!stillSelected) {
                pinMesh.material.color.setHex(pinMesh.userData.baseColor || 0x4a9fd4);
                pinMesh.material.emissive && pinMesh.material.emissive.setHex(0x000000);
                pinMesh.material.emissiveIntensity = 0;
            }
        }
    }, 16);
}

function updatePreview3D() {
    if (previewLine3D) { frontGroup && frontGroup.remove(previewLine3D); previewLine3D = null; }
    const gridSel = selected3DPinsAll.filter(p => p.type === 'grid');
    if (gridSel.length < 2) return;

    const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
    const ez = BOARD3D_THICK / 2 + 0.15;
    const pts = gridSel.map(p => new THREE.Vector3(
        offset + p.c * PIN3D_GAP,
        -(offset + p.r * PIN3D_GAP),
        ez
    ));

    const wrappedPoints = getWrappedPath(pts, PIN3D_R, false);
    const geo = new THREE.BufferGeometry().setFromPoints(wrappedPoints);
    const previewMat = new THREE.LineDashedMaterial({ color: new THREE.Color(currentElasticColor), dashSize: 0.12, gapSize: 0.07, linewidth: 2, depthTest: false });
    previewLine3D = new THREE.Line(geo, previewMat);
    previewLine3D.computeLineDistances();
    previewLine3D.renderOrder = 999;
    if (frontGroup) frontGroup.add(previewLine3D);
}

function renderGuides3D(guides) {
    currentGuides3D = guides; // save state globally
    
    // Clear old guide meshes
    if (guideMeshes3D && guideMeshes3D.length > 0) {
        if (frontGroup) {
            guideMeshes3D.forEach(g => frontGroup.remove(g));
        }
    }
    guideMeshes3D = [];

    if (!guides || guides.length === 0) return;

    const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
    const ez = BOARD3D_THICK / 2 + 0.14; // slightly above elastics

    guides.forEach(gInfo => {
        const { pins, color: colorHex, closed } = gInfo;
        if (!pins || pins.length < 2) return;

        let closedPins = [...pins];
        if (closed) closedPins.push(pins[0]);

        const pts = closedPins.map(p => new THREE.Vector3(
            offset + p.c * PIN3D_GAP,
            -(offset + p.r * PIN3D_GAP),
            ez
        ));

        try {
            const wrappedPoints = getWrappedPath(pts, PIN3D_R, closed);
            const geo = new THREE.BufferGeometry().setFromPoints(wrappedPoints);
            const color = new THREE.Color(colorHex || '#ffd700');
            // LineDashedMaterial provides a dashed visual effect
            const mat = new THREE.LineDashedMaterial({
                color: color,
                dashSize: 0.12,
                gapSize: 0.08,
                linewidth: 3.5,
                depthTest: false
            });
            const line = new THREE.Line(geo, mat);
            line.computeLineDistances();
            line.renderOrder = 1000; // render on top of other elastics
            if (frontGroup) {
                frontGroup.add(line);
                guideMeshes3D.push(line);
            }
        } catch (e) {
            console.warn('renderGuides3D error:', e);
        }
    });
}

function setLockedFace(face) {
    window.lockedFace = face;
    if (!threeControls) return;

    if (face === 'front') {
        threeControls.minAzimuthAngle = -Math.PI / 2 + 0.05;
        threeControls.maxAzimuthAngle = Math.PI / 2 - 0.05;
        threeControls.minPolarAngle = 0.15;
        threeControls.maxPolarAngle = Math.PI - 0.15;
    } else if (face === 'back') {
        threeControls.minAzimuthAngle = Math.PI / 2 + 0.05;
        threeControls.maxAzimuthAngle = 1.5 * Math.PI - 0.05;
        threeControls.minPolarAngle = 0.15;
        threeControls.maxPolarAngle = Math.PI - 0.15;
    } else {
        threeControls.minAzimuthAngle = -Infinity;
        threeControls.maxAzimuthAngle = Infinity;
        threeControls.minPolarAngle = 0;
        threeControls.maxPolarAngle = Math.PI;
    }
    threeControls.update();
}

// 3D otomatik başlatma
setTimeout(() => {
    initThreeJS();
    if (threeScene) threeScene.background = new THREE.Color(currentTheme === 'dark' ? 0x0a0e27 : 0xf0f4f8);
}, 80);
