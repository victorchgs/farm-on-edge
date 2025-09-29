from .utils.pre_process import pre_process_image
from .utils.classifier import Classifier
from .utils.counting import Segmentation, Regression

class RunModels:
    def __init__(self, paths):
        self.paths = paths
        self.clf = Classifier(self.paths["model_clf"])
        self.seg = Segmentation(self.paths["model_seg"])
        self.reg = Regression(self.paths["model_reg"])

    def execute(self, image_path):
        img_processed = pre_process_image(image_path)
        pred = self.clf.predict(img_processed)

        if pred == 1:
            segmentation_result = self.seg.predict(img_processed)
            regression_result = self.reg.predict(segmentation_result)
        else:
            regression_result = 0

        return {
            "clf_prediction": pred,
            "counting_result": regression_result,
        }
