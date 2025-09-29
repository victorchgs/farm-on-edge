from tensorflow.keras.models import load_model
import numpy as np

class Classifier:
    def __init__(self, model_path):
        self.model = load_model(model_path)

    def predict(self, image):
        if not isinstance(image, np.ndarray):
            raise ValueError("Input image must be a numpy array.")
        image = image / 255.0
        image = np.expand_dims(image, axis=0)
        predictions = self.model.predict(image, verbose=0)
        return 1 if predictions[0][0] > 0.5 else 0
