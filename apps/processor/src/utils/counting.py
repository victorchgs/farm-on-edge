from tensorflow.keras.models import load_model
from segmentation_models import get_preprocessing
import numpy as np

class Segmentation:
    def __init__(self, model_path):
        self.model = load_model(model_path, compile=False)
        self.start()

    def pre_process_backbone(self, image):
        preprocess_input = get_preprocessing('mobilenet')
        image_backbone = preprocess_input(image)
        return np.expand_dims(image_backbone, axis=0)

    def start(self):
        tensor = np.random.rand(1, 512, 512, 3)
        self.model.predict(tensor, verbose=0)

    def predict(self, image):
        image = self.pre_process_backbone(image)
        return self.model.predict(image, verbose=0)

class Regression:
    def __init__(self, model_path):
        self.model = load_model(model_path, compile=False)
        self.start()

    def start(self):
        tensor = np.random.rand(1, 512, 512, 1)
        self.model.predict(tensor, verbose=0)

    def predict(self, mask):
        mask = mask / 255.0
        pred = self.model.predict(mask, verbose=0)
        return float(pred[0][0])
