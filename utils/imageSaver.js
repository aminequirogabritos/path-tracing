

export default function saveImage(gl, width, height, filename, urlSave) {
  // Create a buffer to store the pixel data
  const pixels = new Uint8Array(width * height * 4);

  // Read the pixels from the framebuffer
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Create a new buffer to store the flipped pixel data
  const flippedPixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 4;
      const destIndex = ((height - y - 1) * width + x) * 4;
      flippedPixels[destIndex] = pixels[srcIndex];        // Red
      flippedPixels[destIndex + 1] = pixels[srcIndex + 1];  // Green
      flippedPixels[destIndex + 2] = pixels[srcIndex + 2];  // Blue
      flippedPixels[destIndex + 3] = pixels[srcIndex + 3];  // Alpha
    }
  }

  // Convert the pixel data to an image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const imageData = context.createImageData(width, height);

  // Copy the flipped pixels into the imageData object
  for (let i = 0; i < flippedPixels.length; i++) {
    imageData.data[i] = flippedPixels[i];
  }

  // Put the imageData into the canvas
  context.putImageData(imageData, 0, 0);

  // Create an image from the canvas
  const img = new Image();
  img.src = canvas.toDataURL(urlSave);

  // Download the image
  const link = document.createElement('a');
  link.href = img.src;
  link.download = filename;
  link.click();
}
