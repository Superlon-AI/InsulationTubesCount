from cog import BasePredictor, Input, Path
from ultralytics import YOLO
import torch

class Predictor(BasePredictor):
    def setup(self) -> None:
        # 预加载模型到内存，开启无梯度模式加速
        self.model = YOLO('best.pt')

    def predict(
        self,
        image: Path = Input(description="Input image to count tubes"),
    ) -> list: # 注意这里：我们将返回一个列表 (list) 而不是图片路径 (Path)
        
        with torch.no_grad():
            results = self.model.predict(
                source=str(image), 
                verbose=False, 
                save=False,
                conf=0.25
            )
        
        # 提取所有识别到的管子的中心坐标 (X, Y)
        coordinates = []
        for box in results[0].boxes:
            x_center, y_center, w, h = box.xywh[0]
            coordinates.append({
                "x": float(x_center),
                "y": float(y_center)
            })
            
        # 直接返回坐标数据给前端，速度极快
        return coordinates
