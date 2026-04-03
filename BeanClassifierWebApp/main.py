import json
import torch
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from pathlib import Path

from model import BeanClassifier

app = FastAPI()

# Sınıf isimleri
CLASS_NAMES = ["BARBUNYA", "BOMBAY", "CALI", "DERMASON", "HOROZ", "SEKER", "SIRA"]

FEATURE_NAMES = [
    "Area", "Perimeter", "MajorAxisLength", "MinorAxisLength",
    "AspectRatio", "Eccentricity", "ConvexArea", "EquivDiameter",
    "Extent", "Solidity", "Roundness", "Compactness",
    "ShapeFactor1", "ShapeFactor2", "ShapeFactor3", "ShapeFactor4"
]

# Scaler parametrelerini yükle (StandardScaler mean & std)
SCALER_PATH = Path(__file__).parent / "scaler_params.json"
with open(SCALER_PATH, "r") as f:
    scaler_params = json.load(f)
SCALER_MEAN = torch.tensor(scaler_params["mean"], dtype=torch.float32)
SCALER_SCALE = torch.tensor(scaler_params["scale"], dtype=torch.float32)

# Model yükleme
MODEL_PATH = Path(__file__).parent / "bean_classifier.pth"
model = BeanClassifier()
if MODEL_PATH.exists():
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
model.eval()

# Static dosyalar
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


class PredictionRequest(BaseModel):
    features: list[float]


@app.get("/", response_class=HTMLResponse)
async def index():
    html_path = Path(__file__).parent / "static" / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/api/features")
async def get_features():
    return {"features": FEATURE_NAMES, "classes": CLASS_NAMES}


@app.post("/api/predict")
async def predict(req: PredictionRequest):
    if len(req.features) != 16:
        return JSONResponse(
            status_code=400,
            content={"error": "Tam olarak 16 özellik girilmelidir."}
        )

    with torch.inference_mode():
        tensor = torch.tensor([req.features], dtype=torch.float32)
        # StandardScaler normalizasyonu: (x - mean) / std
        tensor = (tensor - SCALER_MEAN) / SCALER_SCALE
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze().tolist()
        predicted_class = int(torch.argmax(logits, dim=1).item())

    return {
        "predicted_class": CLASS_NAMES[predicted_class],
        "confidence": round(probabilities[predicted_class] * 100, 2),
        "probabilities": {
            CLASS_NAMES[i]: round(p * 100, 2) for i, p in enumerate(probabilities)
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
