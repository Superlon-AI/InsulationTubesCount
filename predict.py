from cog import BasePredictor, Input, Path
from ultralytics import YOLO
import torch

class Predictor(BasePredictor):
    def setup(self) -> None:
        self.model = YOLO('best.pt')

    def predict(
        self,
        image: Path = Input(description="Input image to count tubes"),
    ) -> list: 
        with torch.no_grad():
            results = self.model.predict(
                source=str(image), 
                verbose=False, 
                save=False,
                conf=0.25
            )
        
        coordinates = []
        for box in results[0].boxes:
            x_center, y_center, w, h = box.xywh[0]
            coordinates.append({
                "x": float(x_center),
                "y": float(y_center)
            })
            
        return coordinates
