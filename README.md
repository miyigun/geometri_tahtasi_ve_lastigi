[🇹🇷 Click here for Turkish](README.tr.md)

# geometri_tahtasi_ve_lastigi

This repository contains an **interactive, browser-based educational material** built around a **Geoboard (Geometry Board) and Rubber Bands**.  
It is implemented as a **single-page HTML application** and provides a **3D board viewer**, **rubber-band drawing**, and **guided activities** to explore geometry concepts.

---

## Features

### 1. 3D Geoboard Viewer (Three.js)
- Interactive 3D model with **drag to rotate** and **scroll/pinch to zoom**
- Two board faces:
  - **Front face:** 6×6 grid (**36 pins**)
  - **Back face:** concentric circles with **12-pin** and **24-pin** rings (visible by rotating the board)
- On-screen interaction hints (mouse + mobile gestures)

### 2. Rubber Band Drawing (Elastics)
- Click pins to connect them with “elastic” lines
- Close a polygon by returning to the starting pin (requires ≥3 pins)
- Color palette for elastics (e.g., red / green / yellow)
- **Per-color limit** (max 7 elastics per color) with warning toast

### 3. Tools & Controls
- Zoom in / zoom out
- Reset / clear board
- Undo last action
- Theme toggle (**dark / light**)

### 4. Measurement Modes
- **Distance measurement:** select two pins → displays distance in unit steps
- **Angle measurement:** select three pins → displays measured angle (degrees)

### 5. Guided Learning Flow (Activities)
The left panel contains a structured learning flow:
- **Intro (Tanıtım):** material overview and learning goals
- **Uygulama 1:** *Complete-square identity* exploration (e.g., building (a+b)² visually)
- **Uygulama 2:** *Seeing π geometrically* using circle/square relationships
- **Uygulama 3:** convex polygons and angle relationships (activity-based)
- **Derinleştirme:** extension tasks to deepen conceptual understanding

---

## Project Structure

- `index.html` — the main HTML structure and page layout
- `styles.css` — all application styles and theme variables
- `script.js` — all application logic (3D board, elastic drawing, guided activities)
- External libraries are loaded via CDN:
  - jQuery
  - MathJax
  - Three.js (+ OrbitControls)

---

## Getting Started

To run the app locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/miyigun/geometri_tahtasi_ve_lastigi.git
   ```

2. Go to the folder:
   ```bash
   cd geometri_tahtasi_ve_lastigi
   ```

3. Open the app:
   - Easiest: open `index.html` in a browser
   - Recommended: run with a local server (avoids browser security restrictions)

   Example (Python):
   ```bash
   python -m http.server 8000
   ```
   Then open:
   - `http://localhost:8000`

---

## 🛠️ Technologies Used
- HTML / CSS / JavaScript
- Three.js (3D rendering)
- MathJax (math notation)
- jQuery (UI/event handling)

---

## 📌 Notes
- The app is designed as a **standalone HTML file**, so there is no build step.
- Right-click context menu is disabled for smoother interaction on the board.
- Elastic colors have a **usage limit** (max 7 per color) to simulate physical constraints.

---

## 📜 License
This project is licensed under the MIT License. See the LICENSE file for details.