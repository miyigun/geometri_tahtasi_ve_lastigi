/* ══ GEOMETRİ TAHTASI YARDIMCI METOTLARI VE MATEMATİKSEL EĞRİLER ══════ */

/* ── 2D Koordinat Dönüştürücüler ── */
function pinId(r, c) { 
    return `pin-${r}-${c}`; 
}

function pinX(c) { 
    return PAD + c * PIN_GAP; 
}

function pinY(r) { 
    return PAD + r * PIN_GAP; 
}

/* ── Şekil Doğrulamaları ── */
function isValidSquare(pins) {
    if (pins.length !== 4) return false;
    const rs = pins.map(p => p.r);
    const cs = pins.map(p => p.c);
    const minR = Math.min(...rs);
    const maxR = Math.max(...rs);
    const minC = Math.min(...cs);
    const maxC = Math.max(...cs);
    const h = maxR - minR;
    const w = maxC - minC;
    return h === w && h === 2;
}

/* ── 3D Koordinat / Dünya Pozisyonu Bulma ── */
function getPinWorldPos(pinEntry) {
    if (pinEntry.type === 'grid') {
        const offset = -(GRID3D_N - 1) * PIN3D_GAP / 2;
        return new THREE.Vector3(
            offset + pinEntry.c * PIN3D_GAP,
            -(offset + pinEntry.r * PIN3D_GAP),
            BOARD3D_THICK / 2 + 0.18
        );
    } else {
        // Çember pini (Arka yüz)
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

/* ── 3D Lastik Sarmalama için Özel Eğri Sınıfı ── */
class PointListCurve extends THREE.Curve {
    constructor(points) {
        super();
        this.points = points;
    }
    getPoint(t, optionalTarget) {
        if (this.points.length === 0) return optionalTarget || new THREE.Vector3();
        const pointIndex = t * (this.points.length - 1);
        const intPart = Math.floor(pointIndex);
        const weight = pointIndex - intPart;
        const p1 = this.points[intPart];
        const p2 = this.points[intPart + 1] || p1;
        const target = optionalTarget || new THREE.Vector3();
        target.copy(p1).lerp(p2, weight);
        return target;
    }
}

/* ── Lastiğin Pinleri Dışından Dolandığı Sarmalanmış Yol Hesabı ── */
function getWrappedPath(pts, R, closed) {
    if (pts.length < 2) return pts;
    
    const pathPoints = [];
    
    if (pts.length === 2) {
        // 2 pin için kapsül şekli (racetrack)
        const p0 = pts[0];
        const p1 = pts[1];
        
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.0001) return pts;
        
        const ux = dx / len;
        const uy = dy / len;
        
        const nx = uy;
        const ny = -ux;
        
        const z = p0.z;
        const thetaNorm = Math.atan2(ny, nx);
        const numArc = 8;
        
        for (let i = 0; i <= numArc; i++) {
            const angle = thetaNorm + Math.PI - (Math.PI * i) / numArc;
            pathPoints.push(new THREE.Vector3(p0.x + R * Math.cos(angle), p0.y + R * Math.sin(angle), z));
        }
        
        for (let i = 0; i <= numArc; i++) {
            const angle = thetaNorm - (Math.PI * i) / numArc;
            pathPoints.push(new THREE.Vector3(p1.x + R * Math.cos(angle), p1.y + R * Math.sin(angle), z));
        }
        
        pathPoints.push(pathPoints[0].clone());
        return pathPoints;
    }
    
    if (closed) {
        const n = pts.length;
        const normals = [];
        
        let sum = 0;
        for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
        const orientation = sum < 0 ? 1 : -1;
        
        for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.0001) {
                normals.push({ x: 0, y: 0 });
                continue;
            }
            normals.push({ x: orientation * (dy / len), y: -orientation * (dx / len) });
        }
        
        for (let i = 0; i < n; i++) {
            const pCurrent = pts[i];
            const normPrev = normals[(i - 1 + n) % n];
            const normCurr = normals[i];
            
            const Tx_in = pCurrent.x + R * normPrev.x;
            const Ty_in = pCurrent.y + R * normPrev.y;
            const Tx_out = pCurrent.x + R * normCurr.x;
            const Ty_out = pCurrent.y + R * normCurr.y;
            
            const thetaIn = Math.atan2(Ty_in - pCurrent.y, Tx_in - pCurrent.x);
            const thetaOut = Math.atan2(Ty_out - pCurrent.y, Tx_out - pCurrent.x);
            
            let diff = thetaOut - thetaIn;
            if (orientation === 1) {
                if (diff < 0) diff += 2 * Math.PI;
            } else {
                if (diff > 0) diff -= 2 * Math.PI;
            }
            
            const numArc = 8;
            for (let j = 0; j <= numArc; j++) {
                const angle = thetaIn + diff * (j / numArc);
                pathPoints.push(new THREE.Vector3(
                    pCurrent.x + R * Math.cos(angle),
                    pCurrent.y + R * Math.sin(angle),
                    pCurrent.z
                ));
            }
        }
        
        pathPoints.push(pathPoints[0].clone());
    } else {
        const n = pts.length;
        const normals = [];
        
        for (let i = 0; i < n - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.0001) {
                normals.push({ x: 0, y: 0 });
                continue;
            }
            normals.push({ x: dy / len, y: -dx / len });
        }
        
        const pStart = pts[0];
        const nStart = normals[0];
        pathPoints.push(new THREE.Vector3(pStart.x + R * nStart.x, pStart.y + R * nStart.y, pStart.z));
        
        for (let i = 1; i < n - 1; i++) {
            const pCurrent = pts[i];
            const normPrev = normals[i - 1];
            const normCurr = normals[i];
            
            const Tx_in = pCurrent.x + R * normPrev.x;
            const Ty_in = pCurrent.y + R * normPrev.y;
            const Tx_out = pCurrent.x + R * normCurr.x;
            const Ty_out = pCurrent.y + R * normCurr.y;
            
            const thetaIn = Math.atan2(Ty_in - pCurrent.y, Tx_in - pCurrent.x);
            const thetaOut = Math.atan2(Ty_out - pCurrent.y, Tx_out - pCurrent.x);
            
            let diff = thetaOut - thetaIn;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            
            const numArc = 6;
            for (let j = 0; j <= numArc; j++) {
                const angle = thetaIn + diff * (j / numArc);
                pathPoints.push(new THREE.Vector3(
                    pCurrent.x + R * Math.cos(angle),
                    pCurrent.y + R * Math.sin(angle),
                    pCurrent.z
                ));
            }
        }
        
        const pEnd = pts[n - 1];
        const nEnd = normals[n - 2];
        pathPoints.push(new THREE.Vector3(pEnd.x + R * nEnd.x, pEnd.y + R * nEnd.y, pEnd.z));
    }
    
    return pathPoints;
}
