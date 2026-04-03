document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("predictionForm");
    const featureInputs = document.getElementById("featureInputs");
    const resultSection = document.getElementById("resultSection");
    const predictedClass = document.getElementById("predictedClass");
    const confidenceValue = document.getElementById("confidenceValue");
    const probabilityBars = document.getElementById("probabilityBars");
    const predictBtn = document.getElementById("predictBtn");
    const clearBtn = document.getElementById("clearBtn");
    const sampleBtn = document.getElementById("sampleBtn");

    // Örnek veriler (gerçek CSV'den alınmış her sınıftan birer satır)
    const SAMPLE_DATA = {
        BARBUNYA: [41487.0, 815.9, 299.0468, 177.0815, 1.6888, 0.8058, 42483.0, 229.8323, 0.6892, 0.9766, 0.7832, 0.7685, 0.0072, 0.0016, 0.5907, 0.9975],
        BOMBAY:   [114004.0, 1279.356, 451.3613, 323.748, 1.3942, 0.6968, 115298.0, 380.9913, 0.749, 0.9888, 0.8753, 0.8441, 0.004, 0.0012, 0.7125, 0.9933],
        CALI:     [45504.0, 793.417, 295.4698, 196.3118, 1.5051, 0.7474, 45972.0, 240.7021, 0.7378, 0.9898, 0.9084, 0.8146, 0.0065, 0.0018, 0.6636, 0.9988],
        DERMASON: [20420.0, 524.932, 183.6012, 141.8862, 1.294, 0.6347, 20684.0, 161.2438, 0.7902, 0.9872, 0.9312, 0.8782, 0.009, 0.0033, 0.7713, 0.998],
        HOROZ:    [33006.0, 710.496, 283.0204, 149.6237, 1.8915, 0.8488, 33354.0, 204.9989, 0.6355, 0.9896, 0.8216, 0.7243, 0.0086, 0.0015, 0.5246, 0.9924],
        SEKER:    [28395.0, 610.291, 208.1781, 173.8887, 1.1972, 0.5498, 28715.0, 190.1411, 0.7639, 0.9889, 0.958, 0.9134, 0.0073, 0.0031, 0.8342, 0.9987],
        SIRA:     [31519.0, 676.641, 255.0736, 157.8027, 1.6164, 0.7857, 32065.0, 200.3278, 0.758, 0.983, 0.8651, 0.7854, 0.0081, 0.0019, 0.6168, 0.997],
    };

    let featureNames = [];
    let classNames = [];

    // Özellik isimlerini çek
    try {
        const res = await fetch("/api/features");
        const data = await res.json();
        featureNames = data.features;
        classNames = data.classes;
    } catch {
        featureNames = [
            "Area", "Perimeter", "MajorAxisLength", "MinorAxisLength",
            "AspectRatio", "Eccentricity", "ConvexArea", "EquivDiameter",
            "Extent", "Solidity", "Roundness", "Compactness",
            "ShapeFactor1", "ShapeFactor2", "ShapeFactor3", "ShapeFactor4"
        ];
        classNames = ["BARBUNYA", "BOMBAY", "CALI", "DERMASON", "HOROZ", "SEKER", "SIRA"];
    }

    // Input alanlarını oluştur
    featureNames.forEach((name, i) => {
        const group = document.createElement("div");
        group.className = "input-group";
        group.innerHTML = `
            <label for="feat_${i}">${name}</label>
            <input type="number" step="any" id="feat_${i}" name="feat_${i}" placeholder="0.0" required>
        `;
        featureInputs.appendChild(group);
    });

    // Örnek veri yükle
    sampleBtn.addEventListener("click", () => {
        const types = Object.keys(SAMPLE_DATA);
        const randomType = types[Math.floor(Math.random() * types.length)];
        const values = SAMPLE_DATA[randomType];
        featureNames.forEach((_, i) => {
            document.getElementById(`feat_${i}`).value = values[i];
        });
        resultSection.hidden = true;
    });

    // Temizle
    clearBtn.addEventListener("click", () => {
        form.reset();
        resultSection.hidden = true;
        removeError();
    });

    // Tahmin
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        removeError();

        const features = [];
        for (let i = 0; i < featureNames.length; i++) {
            const val = document.getElementById(`feat_${i}`).value;
            if (val === "") {
                showError("Lütfen tüm alanları doldurunuz.");
                return;
            }
            features.push(parseFloat(val));
        }

        predictBtn.disabled = true;
        predictBtn.querySelector(".btn-text").textContent = "Hesaplanıyor...";
        predictBtn.querySelector(".btn-loader").hidden = false;

        try {
            const res = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ features }),
            });

            const data = await res.json();

            if (!res.ok) {
                showError(data.error || "Bir hata oluştu.");
                return;
            }

            // Sonuçları göster
            predictedClass.textContent = data.predicted_class;
            confidenceValue.textContent = `%${data.confidence}`;
            renderProbabilities(data.probabilities, data.predicted_class);
            resultSection.hidden = false;
            resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

        } catch (err) {
            showError("Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.");
        } finally {
            predictBtn.disabled = false;
            predictBtn.querySelector(".btn-text").textContent = "Tahmin Et";
            predictBtn.querySelector(".btn-loader").hidden = true;
        }
    });

    function renderProbabilities(probs, highlighted) {
        probabilityBars.innerHTML = "";
        // Olasılığa göre sırala
        const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);

        sorted.forEach(([cls, pct]) => {
            const row = document.createElement("div");
            row.className = "prob-row";
            const isHighlight = cls === highlighted;
            row.innerHTML = `
                <span class="prob-label">${cls}</span>
                <div class="prob-bar-bg">
                    <div class="prob-bar-fill ${isHighlight ? "highlight" : ""}" style="width: 0%"></div>
                </div>
                <span class="prob-percent">%${pct.toFixed(1)}</span>
            `;
            probabilityBars.appendChild(row);

            // Animasyonlu bar
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    row.querySelector(".prob-bar-fill").style.width = `${Math.max(pct, 1)}%`;
                });
            });
        });
    }

    function showError(msg) {
        removeError();
        const div = document.createElement("div");
        div.className = "error-msg";
        div.textContent = msg;
        form.insertBefore(div, form.firstChild);
    }

    function removeError() {
        const existing = form.querySelector(".error-msg");
        if (existing) existing.remove();
    }
});
