/* ══ GEOMETRİ TAHTASI GLOBAL STATE VE SABİTLER ════════════════════════ */

/* ── Tema ── */
let currentTheme = 'dark';

/* ── Renk Paleti ve Limitler ── */
const ELASTIC_COLORS = [
    { name: 'Kırmızı', hex: '#ef4444' },
    { name: 'Yeşil', hex: '#22c55e' },
    { name: 'Sarı', hex: '#eab308' },
];
const ELASTIC_MAX_USE = 7;
let elasticUseCounts = {
    '#ef4444': 0,
    '#22c55e': 0,
    '#eab308': 0,
};
let selectedColorIdx = 0;
let paletteOpen = false;
let currentElasticColor = ELASTIC_COLORS[0].hex;

let _limitToastTimer = null;

function getElasticUseCount(hex) { 
    return elasticUseCounts[hex] || 0; 
}

function incrementElasticUse(hex) { 
    if (elasticUseCounts[hex] !== undefined) {
        elasticUseCounts[hex]++; 
    }
}

function resetElasticUseCounts() { 
    elasticUseCounts = { '#ef4444': 0, '#22c55e': 0, '#eab308': 0 }; 
}

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

function showLimitToast(colorName) {
    const toast = document.getElementById('limitToast');
    if (!toast) return;
    toast.textContent = `⚠️ ${colorName || 'Bu renk'} lastik bitti! En fazla 7 adet kullanılabilir.`;
    toast.classList.add('show');
    clearTimeout(_limitToastTimer);
    _limitToastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2200);
}

/* ── 2D Geometri Tahtası Durumu ── */
const GRID_N = 6;      // 6×6 pin
const PIN_GAP = 62;    // px arası mesafe
const PIN_R = 7;       // pin yarıçapı
const PIN_R_SEL = 10;
const PAD = 44;        // kenar boşluk
const BOARD_W = PAD * 2 + PIN_GAP * (GRID_N - 1);
const BOARD_H = BOARD_W;

let selectedPins = [];   // [{r,c}, ...]
let elastics = [];       // [{pins:[{r,c},...], color, closed}]
let boardZoom = 1.0;
let boardMode = 'draw';  // 'draw' | 'measure' | 'angle'
let anglePoints = [];    // [{r,c}, ...]
let measurePins = [];    // [{r,c}, ...]
let current2DFace = 'front'; // 'front' | 'back'

let backSelectedPins = []; // [{x,y,el}, ...]
let backElastics = [];     // [{points:[{x,y},...], color, closed}]

/* ── 3D Geometri Tahtası Durumu ── */
const BOARD_THICK = 0.35;
const PIN_ROWS = 6;
const PIN_COLS = 6;

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let threeControls = null;
let threeAnimId = null;
let currentFace = 'front'; // 'front' | 'back'
let frontGroup = null;
let backGroup = null;
let pinMeshes = [];      // 3D'deki pin mesh'leri
let elasticMeshes = [];  // 3D'deki lastik mesh'leri
let is3DPinSelectMode = false;
let dragStarted = false; // OrbitControls drag algılama

const GRID3D_N = 6;
const PIN3D_GAP = 1.0;
const PIN3D_R = 0.08;
const BOARD3D_SIZE = 5.5;
const BOARD_SIZE_3D = 5.0;
const BOARD3D_THICK = 0.18;

let selected3DPinsAll = []; // [{type:'grid',r,c,mesh,key} | {type:'circle',circleType,idx,mesh,key}]
let previewLine3D = null;
let guideMeshes3D = [];
let currentGuides3D = [];
