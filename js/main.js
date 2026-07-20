/* ══ GEOMETRİ TAHTASI GİRİŞ NOKTASI VE ETKİLEŞİMLER (MAIN.JS) ═════════ */

$(document).ready(function () {
    // 1. Başlangıç Teması Ayarı
    $('html').attr('data-theme', currentTheme);
    $('#themeIcon').text(currentTheme === 'dark' ? '☀' : '🌙');

    // 2. Renk Paleti Swatch'larının Oluşturulması
    const $popup = $('#palettePopup');
    ELASTIC_COLORS.forEach((c, i) => {
        $popup.append($(`<div class="tb-color-swatch ${i === selectedColorIdx ? 'selected' : ''}" title="${c.name} ${ELASTIC_MAX_USE - getElasticUseCount(c.hex)} adet kaldı." data-idx="${i}" data-hex="${c.hex}" style="background:${c.hex};"></div>`));
    });
    updateSwatchBadges();

    // 3. Palet Konumlandırma Mantığı
    function positionPalette() {
        const tb = document.getElementById('sideToolbar');
        if (!tb) return;
        const rect = tb.getBoundingClientRect();
        const isMob = window.innerWidth <= 640;
        if (isMob) {
            $popup.css({ bottom: '60px', right: '8px', top: 'auto', left: 'auto' });
            return;
        }
        const popH = $popup.outerHeight(true) || 280;
        let topPos = rect.top + rect.height / 2 - popH / 2;
        topPos = Math.max(10, Math.min(topPos, window.innerHeight - popH - 10));
        $popup.css({ top: topPos, right: window.innerWidth - rect.left + 6, left: 'auto', bottom: 'auto' });
    }

    // 4. Renk Seçim Paleti ve Popup Olayları
    $('#paletteToggleBtn').on('click', function (e) {
        e.stopPropagation();
        paletteOpen = !paletteOpen;
        $popup.toggleClass('open', paletteOpen);
        $(this).toggleClass('active', paletteOpen);
        if (paletteOpen) positionPalette();
    });

    $(window).on('resize', function () {
        if (paletteOpen) positionPalette();
    });

    $(document).on('click', function (e) {
        if (paletteOpen && !$(e.target).closest('#palettePopup,#paletteToggleBtn').length) {
            paletteOpen = false;
            $popup.removeClass('open');
            $('#paletteToggleBtn').removeClass('active');
        }
    });

    $(document).on('click', '.tb-color-swatch', function () {
        const idx = parseInt($(this).data('idx'));
        const hex = ELASTIC_COLORS[idx].hex;
        if (getElasticUseCount(hex) >= ELASTIC_MAX_USE) {
            return; // Renk limiti dolmuşsa seçme
        }
        selectedColorIdx = idx;
        $('.tb-color-swatch').removeClass('selected');
        $(this).addClass('selected');
        currentElasticColor = hex;
    });

    // 5. Mobil Toolbar Yan Menü Aç/Kapat
    const $tbToggle = $('#tbToggleBtn');
    const $toolbar = $('#sideToolbar');

    function checkMobile() {
        if (window.innerWidth <= 640) {
            $tbToggle.css('display', 'flex');
        } else {
            $tbToggle.css('display', 'none');
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

    $(document).on('click', function (e) {
        if (window.innerWidth <= 640) {
            if (!$(e.target).closest('#sideToolbar,#tbToggleBtn').length) {
                $toolbar.removeClass('tb-visible');
                $tbToggle.removeClass('tb-open');
            }
        }
    });

    // 6. Tema Değiştirme Butonu Olayı
    $('#themeToggle').off('click').on('click', function () {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        $('html').attr('data-theme', currentTheme);
        $('#themeIcon').text(currentTheme === 'dark' ? '☀' : '🌙');
        if (threeScene) {
            threeScene.background = new THREE.Color(currentTheme === 'dark' ? 0x0a0e27 : 0xf0f4f8);
            buildFront();
            buildBack();
        }
        if (typeof rebuildBoard === 'function') rebuildBoard();
        if (typeof rebuildBackBoard === 'function') rebuildBackBoard();
    });

    // 7. Sekme Geçiş Butonları Olayları
    $('.tab-button').on('click', function () {
        if ($(this).prop('disabled')) return;
        $('.tab-button').removeClass('active');
        $(this).addClass('active');
        clearBoard();
        boardMode = 'draw';
        loadTab($(this).data('tab'));
    });

    // 8. Toolbar Buton Eylemleri (Zoom, Sıfırla, Temizle, Geri Al)
    $('#zoomInBtn').on('click', function () {
        if (threeCamera) {
            threeCamera.position.multiplyScalar(0.85);
        }
    });

    $('#zoomOutBtn').on('click', function () {
        if (threeCamera) {
            threeCamera.position.multiplyScalar(1.18);
        }
    });

    $('#resetBoardBtn').on('click', function () {
        clearBoard();
        if (threeCamera && threeControls) {
            const isMobile = window.innerWidth <= 640;
            const activeTab = $('.tab-button.active').data('tab');
            if (activeTab === 'app2') {
                threeCamera.position.set(0, 0, isMobile ? -13 : -9);
                if (typeof setLockedFace === 'function') setLockedFace('back');
            } else if (activeTab === 'free') {
                threeCamera.position.set(0, 0, isMobile ? 13 : 9);
                if (typeof setLockedFace === 'function') setLockedFace(null);
            } else {
                threeCamera.position.set(0, 0, isMobile ? 13 : 9);
                if (typeof setLockedFace === 'function') setLockedFace('front');
            }
            threeCamera.lookAt(0, 0, 0);
            threeControls.target.set(0, 0, 0);
            threeControls.update();
        }
    });

    $('#clearBoardBtn').on('click', function () {
        clearBoard();
        if (current2DFace === 'back' || currentFace === 'back') {
            rebuildBackBoard();
        } else {
            rebuildBoard();
        }
    });

    $('#undoBtn').on('click', function () {
        // 1. Son seçilen pini geri al (3B Seçim)
        if (selected3DPinsAll.length > 0) {
            selected3DPinsAll.pop();
            if (typeof updatePinSelectionColors === 'function') updatePinSelectionColors();
            if (typeof updatePreview3D === 'function') updatePreview3D();
            
            // 3B arka yüz çemberinde pin seçimi geri alındığında geçici çizgileri de güncelle
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
            return;
        }

        // 2. Son seçilen pini geri al (2D Seçim)
        if (selectedPins.length > 0) {
            selectedPins.pop();
            rebuildBoard();
            return;
        }
        if (backSelectedPins.length > 0) {
            const popped = backSelectedPins.pop();
            if (popped && popped.el) {
                popped.el.setAttribute('fill', currentTheme === 'dark' ? '#4a9fd4' : '#93c5fd');
                popped.el.setAttribute('r', PIN_R);
            }
            renderBackElastics();
            return;
        }

        // 3. Aktif yüzeyin arka (çember) yüzü olması durumunda lastik geri al (2D veya 3D)
        const isBackActive = (current2DFace === 'back' || currentFace === 'back');
        if (isBackActive) {
            if (current2DFace === 'back') {
                if (backElastics.length > 0) {
                    backElastics.pop();
                    renderBackElastics();
                }
            } else {
                if (elastics.length > 0) {
                    const last = elastics.pop();
                    if (elasticUseCounts[last.color] !== undefined && elasticUseCounts[last.color] > 0) {
                        elasticUseCounts[last.color]--;
                        updateSwatchBadges();
                    }
                }
                if (backGroup) {
                    const backEls = backGroup.children.filter(c => c.userData && c.userData.isElastic);
                    if (backEls.length > 0) {
                        backGroup.remove(backEls[backEls.length - 1]);
                    }
                }
            }
            return;
        }

        // 4. Ön yüz lastik geri al
        if (elastics.length > 0) {
            const last = elastics.pop();
            if (elasticUseCounts[last.color] !== undefined && elasticUseCounts[last.color] > 0) {
                elasticUseCounts[last.color]--;
                updateSwatchBadges();
            }
            rebuildBoard();
        }
    });

    // 9. Giriş Diyaloğu / Başlangıç Tetikleyicisi
    $('#introDialog').show();
    $('#introContinueBtn').on('click', function () {
        $('#introDialog').hide();
        loadTab('intro');
    });
});
