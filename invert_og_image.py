from PIL import Image
import numpy as np

# Open the existing og-image  
input_path = '/Users/thavasantonio/Documents/UCPv6/frontend/public/og-image.jpeg'
output_path = '/Users/thavasantonio/Documents/UCPv6/frontend/public/og-image.jpeg'

# Load the image
img = Image.open(input_path)

# Convert to RGB if not already
if img.mode != 'RGB':
    img = img.convert('RGB')

# Convert to numpy array for pixel manipulation
img_array = np.array(img)

# Define what we consider "white" or very light background
# Pixels where R, G, B are all above 200 will be considered white/light background
threshold = 200

# Create a mask for white/light pixels (where all RGB channels are > threshold)
white_mask = (img_array[:, :, 0] > threshold) & \
             (img_array[:, :, 1] > threshold) & \
             (img_array[:, :, 2] > threshold)

# Replace white pixels with black
img_array[white_mask] = [0, 0, 0]

# Convert back to image
result_img = Image.fromarray(img_array)

# Save the result
result_img.save(output_path, 'JPEG', quality=95)

print(f"Successfully replaced white background with black!")
print(f"Logo colors preserved.")
