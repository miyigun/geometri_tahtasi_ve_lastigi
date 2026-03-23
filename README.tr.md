# geometri_tahtasi_ve_lastigi

Bu repo, **Geometri Tahtası ve Lastiği (Geoboard)** materyali üzerine hazırlanmış **tarayıcı tabanlı, etkileşimli bir eğitim uygulamasını** içerir.  
Uygulama **tek sayfalık bir HTML dosyası** olarak geliştirilmiştir ve **3B tahta görünümü**, **lastik ile çizim**, **ölçüm araçları** ve **adım adım etkinlikler** sunar.

---

## Özellikler

### 1. 3B Geometri Tahtası (Three.js)
- **Sürükle-bırak ile döndürme**, **scroll/pinch ile yakınlaştırma**
- Tahtanın iki yüzü:
  - **Ön yüz:** 6×6 pin düzeni (**36 pin**)
  - **Arka yüz:** **12 pinli** ve **24 pinli** iç içe çemberler (tahtayı döndürerek görülebilir)
- Mouse ve mobil hareketleri için ekranda kullanım ipuçları

### 2. Lastik ile Şekil Oluşturma
- Pinlere tıklayarak lastik çizgileri oluşturma
- Başlangıç pinine geri dönerek çokgeni kapatma (en az 3 pin)
- Renk paleti (örn. kırmızı / yeşil / sarı)
- **Renk başına limit** (her renk için en fazla 7 lastik) ve uyarı bildirimi

### 3. Araçlar & Kontroller
- Yakınlaştır / uzaklaştır
- Sıfırla / tahtayı temizle
- Geri al (undo)
- Tema değiştirme (**koyu / açık**)

### 4. Ölçüm Modları
- **Mesafe ölçme:** iki pin seç → birim cinsinden mesafe gösterir
- **Açı ölçme:** üç pin seç → derece cinsinden açı gösterir

### 5. Yönlendirmeli Öğrenme Akışı (Etkinlikler)
Sol panelde adım adım ilerleyen etkinlik yapısı bulunur:
- **Tanıtım:** materyal ve hedefler
- **Uygulama 1:** *Tamkare özdeşliği* (ör. (a+b)² görsel modelleme)
- **Uygulama 2:** *π’yi geometrik olarak görme* (çember-kare ilişkileri)
- **Uygulama 3:** konveks çokgenler ve açılar üzerine etkinlik
- **Derinleştirme:** kavramsal anlamayı geliştirmeye yönelik ek görevler

---

## Proje Yapısı

- `index.html` — uygulamanın tamamı (HTML/CSS/JS tek dosya)
- Harici kütüphaneler CDN ile yüklenir:
  - jQuery
  - MathJax
  - Three.js (+ OrbitControls)

---

## Başlangıç

Uygulamayı yerelde çalıştırmak için:

1. Repoyu klonlayın:
   ```bash
   git clone https://github.com/miyigun/geometri_tahtasi_ve_lastigi.git
   ```

2. Klasöre girin:
   ```bash
   cd geometri_tahtasi_ve_lastigi
   ```

3. Uygulamayı açın:
   - En kolay: `index.html` dosyasını tarayıcıda açın
   - Önerilen: local server ile çalıştırın (tarayıcı güvenlik kısıtlarını önler)

   Örnek (Python):
   ```bash
   python -m http.server 8000
   ```
   Sonra şurayı açın:
   - `http://localhost:8000`

---

## 🛠️ Kullanılan Teknolojiler
- HTML / CSS / JavaScript
- Three.js (3B görüntüleme)
- MathJax (matematiksel ifadeler)
- jQuery (arayüz ve olay yönetimi)

---

## 📌 Notlar
- Uygulama **standalone** bir HTML dosyasıdır; ayrıca build adımı yoktur.
- Tahta ile etkileşimi kolaylaştırmak için sağ tık menüsü devre dışı bırakılmıştır.
- Lastikler, fiziksel materyali simüle etmek için **renk başına limit** ile sınırlandırılmıştır (max 7).

---

## 📜 Lisans
Bu proje MIT lisansı altında sunulmaktadır. Ayrıntılar için LICENSE dosyasına bakınız.