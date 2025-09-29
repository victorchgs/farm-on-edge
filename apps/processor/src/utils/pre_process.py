from tensorflow.keras.preprocessing.image import load_img, img_to_array
from tensorly.decomposition import parafac
import matplotlib.pyplot as plt
import tensorly as tl
import numpy as np
import os

os.environ["SM_FRAMEWORK"] = "tf.keras"

def load_image(image_path, target_size=(512, 512)):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")
    img = load_img(image_path, target_size=target_size)
    return img_to_array(img)

def to_image(tensor):
    im = tl.to_numpy(tensor)
    im -= im.min()
    im /= im.max()
    im *= 255
    return im.astype(np.uint8)

def filter_cp_decomposition(image, rank=35):
    image_tensor = tl.tensor(image, dtype="float32")
    weights, factors = parafac(image_tensor, rank=rank, init="random", tol=10e-6)
    cp_reconstruction = tl.cp_to_tensor((weights, factors))
    return to_image(cp_reconstruction)

def pre_process_image(image_path, target_size=(512, 512)):
    image = load_image(image_path, target_size)
    return filter_cp_decomposition(image)
