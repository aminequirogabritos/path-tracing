// Load vertex and fragment shaders
import vertexShaderPathTracing from './shaders/vertexShader.glsl';
import vertexShaderOutput from './shaders/vertexShader.glsl';
import fragmentShaderPathTracing from './shaders/fragmentShaderPathTracing.glsl';
import fragmentShaderOutput from './shaders/fragmentShaderOutput.glsl';

// Utility functions
import mapTrianglesArrayToTexturizableArray from './utils/triangleMapper.js';
import uploadTexture from './utils/textureUploader.js';
import loadModel from './utils/modelLoader.js';
import createShader from './utils/shaderCreator.js';
import createProgram from './utils/programCreator.js';
import saveImage from './utils/imageSaver.js';

// Classes
import Camera from './classes/camera.js';
import BVH from './classes/bvh.js';

// Modules
import BufferManager from './modules/bufferManager.js';
import TextureIndex from './modules/textureIndex.js';

let cooldown;

const samples = 10
const maxPathLength = 3
const sampleCount = 5
const canvasSize = 200
const quadSize = 50

const saveFrame = 1

const sceneNumber = parseInt(import.meta.env.VITE_SCENE_NUMBER)
const scene1Cooldown = parseInt(import.meta.env.VITE_SCENE_1_COOLDOWN);
const scene2Cooldown = parseInt(import.meta.env.VITE_SCENE_2_COOLDOWN);
const scene3Cooldown = parseInt(import.meta.env.VITE_SCENE_3_COOLDOWN);

const fileNameSuffix = `scene_${sceneNumber}_${samples}samples_${maxPathLength}bounces_${sampleCount}samples_${canvasSize}px`

let trianglesArray;

let scenePath;

switch (sceneNumber) {
  case 1: scenePath = '/resources/scene_1/scene_1.gltf'; break;
  case 2: scenePath = '/resources/scene_2/scene_2.gltf'; break;
  case 3: scenePath = '/resources/scene_3/scene_3.gltf'; break;
  default: scenePath = '/resources/scene_1/scene_1.gltf'; break;
}

try {
  trianglesArray = await loadModel(
    scenePath
  );
} catch (e) {
  console.log(e);
}

const canvas = document.createElement('canvas');

const gl = canvas.getContext('webgl2');

if (!gl) {
  console.error('WebGL 2 not supported');
}

const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

canvas.height = canvasSize;
canvas.width = canvasSize;
document.getElementById('canvas-container').appendChild(canvas);

var width = gl.canvas.clientWidth;
var height = gl.canvas.clientHeight;
gl.canvas.width = width;
gl.canvas.height = height;

let cameraInstance = new Camera(50, width / height, 0.1, 1000);

switch (sceneNumber) {
  case 1:
    cameraInstance.translate('x', 12.4)
    cameraInstance.lookAt(0, 0, 0);
    cooldown = scene1Cooldown;
    break;
  case 2:
    cameraInstance.lookAt(0, 0, 0);
    cameraInstance.translate('x', 4 * 0.9);
    cameraInstance.translate('y', 3 * 0.3);
    cameraInstance.translate('z', 4.5 * 0.8);
    cameraInstance.lookAt(0.5, -2.2, -2.5);
    cooldown = scene2Cooldown;
    break;
  case 3:
    cameraInstance.translate('x', 14)
    cameraInstance.translate('z', -14)
    cameraInstance.translate('y', 3)
    cameraInstance.lookAt(0, 0, 0);
    cooldown = scene3Cooldown;
    break;
  default: break;
}


let camera = cameraInstance.getCamera();
console.log("🌸 ~ camera:", camera)


let bvh = new BVH(trianglesArray);
console.log("🌸 ~ bvh:", bvh)

let {
  coordinates,
  normals,
  colors,
  emissions,
  metallics,
  roughnesses,
  lightIndices,
} = mapTrianglesArrayToTexturizableArray(trianglesArray);

console.log("🚀 ~ coordinates.length", coordinates.length / 3)
console.log("🚀 ~ lights count", lightIndices.length)

let {
  nodesBoundingBoxesMins,
  nodesBoundingBoxesMaxs,
  nodesTrianglesCount,
  nodesFirstTriangleIndex,
  nodesMissLinkIndices,
  inorderTrianglesIndicesArray,
} = bvh.getTexturizableArrays();

BufferManager.createFramebufferAndTexture(gl, width, height);
BufferManager.createFramebufferAndTexture(gl, width, height);


gl.bindFramebuffer(gl.FRAMEBUFFER, null);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const vertexShaderPathTracingSource = createShader(gl, gl.VERTEX_SHADER, vertexShaderPathTracing);
const vertexShaderOutputSource = createShader(gl, gl.VERTEX_SHADER, vertexShaderOutput);

const fragmentShaderPathTracingSource = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderPathTracing);
const fragmentShaderOutputSource = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderOutput);

const programPathTracing = createProgram(gl, vertexShaderPathTracingSource, fragmentShaderPathTracingSource);
const programOutput = createProgram(gl, vertexShaderOutputSource, fragmentShaderOutputSource);

// Full screen quad vertices (triangle strip)
const vertices = new Float32Array([
  -1.0, -1.0, // Bottom-left
  1.0, -1.0, // Bottom-right
  -1.0, 1.0, // Top-left
  1.0, 1.0    // Top-right
]);

// Create and bind vertex array object (VAO) for path tracing
const vaoPathTracing = gl.createVertexArray();
gl.bindVertexArray(vaoPathTracing);

// Create vertex buffer
const vertexBufferPathTracing = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferPathTracing);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Bind vertex attributes
const positionLocationPathTracing = gl.getAttribLocation(programPathTracing, 'position');
gl.enableVertexAttribArray(positionLocationPathTracing);
gl.vertexAttribPointer(positionLocationPathTracing, 2, gl.FLOAT, false, 0, 0);


// Create and bind VAO for output
const vaoOutput = gl.createVertexArray();
gl.bindVertexArray(vaoOutput);

const vertexBufferOutput = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferOutput);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLocationOutput = gl.getAttribLocation(programOutput, 'position');
gl.enableVertexAttribArray(positionLocationOutput);
gl.vertexAttribPointer(positionLocationOutput, 2, gl.FLOAT, false, 0, 0);

gl.bindVertexArray(null);


const fpsElem = document.querySelector("#fps");
const avgFpsElem = document.querySelector("#avg-fps");

document.querySelector("#startButton").addEventListener("click", async () => {
  await renderAsync(samples);
})



//------------------------------------------------------------------------------------

// Render
async function render(now, sampleNumber) {

  gl.useProgram(programPathTracing);

  // Divide the screen into smaller quads
  const numQuadsX = Math.ceil(width / quadSize);
  const numQuadsY = Math.ceil(height / quadSize);

  //function uploadTexture(gl, program, data, name, width, height, index)
  uploadTexture(gl, programPathTracing, coordinates, 'coordinatesTexture', TextureIndex.getNextTextureIndex(), 3, gl.RGB32F, gl.RGB);
  uploadTexture(gl, programPathTracing, normals, 'normalsTexture', TextureIndex.getNextTextureIndex(), 3, gl.RGB32F, gl.RGB);
  uploadTexture(gl, programPathTracing, colors, 'colorsTexture', TextureIndex.getNextTextureIndex(), 3, gl.RGB32F, gl.RGB);
  uploadTexture(gl, programPathTracing, emissions, 'emissionsTexture', TextureIndex.getNextTextureIndex(), 3, gl.RGB32F, gl.RGB);
  uploadTexture(gl, programPathTracing, metallics, 'metallicsTexture', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);
  uploadTexture(gl, programPathTracing, roughnesses, 'roughnessesTexture', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);
  uploadTexture(gl, programPathTracing, lightIndices, 'lightIndicesTexture', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);
  uploadTexture(gl, programPathTracing, nodesBoundingBoxesMins, 'nodesBoundingBoxesMins', TextureIndex.getNextTextureIndex(), 3, gl.RGB32F, gl.RGB);
  uploadTexture(gl, programPathTracing, nodesBoundingBoxesMaxs, 'nodesBoundingBoxesMaxs', TextureIndex.getNextTextureIndex(), 3, gl.RGB32F, gl.RGB);
  uploadTexture(gl, programPathTracing, nodesMissLinkIndices, 'nodesMissLinkIndices', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);
  uploadTexture(gl, programPathTracing, nodesTrianglesCount, 'nodesTrianglesCount', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);
  uploadTexture(gl, programPathTracing, nodesFirstTriangleIndex, 'nodesFirstTriangleIndex', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);
  uploadTexture(gl, programPathTracing, inorderTrianglesIndicesArray, 'inorderTrianglesIndicesArray', TextureIndex.getNextTextureIndex(), 1, gl.R32F, gl.RED);

  // Set uniforms
  const quadXLocation = gl.getUniformLocation(programPathTracing, 'quadX');
  const quadYLocation = gl.getUniformLocation(programPathTracing, 'quadY');
  gl.uniform2f(gl.getUniformLocation(programPathTracing, 'windowSize'), width, height);
  gl.uniform1f(gl.getUniformLocation(programPathTracing, 'aspectRatio'), width / height);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraSource'), camera.cameraSource.x, camera.cameraSource.y, camera.cameraSource.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraDirection'), camera.cameraDirection.x, camera.cameraDirection.y, camera.cameraDirection.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraUp'), camera.cameraUp.x, camera.cameraUp.y, camera.cameraUp.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraRight'), camera.cameraRight.x, camera.cameraRight.y, camera.cameraRight.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraLeftBottom'), camera.cameraLeftBottom.x, camera.cameraLeftBottom.y, camera.cameraLeftBottom.z);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'vertexCount'), parseInt(coordinates.length));
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'triangleCount'), coordinates.length / 3);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'lightIndicesCount'), parseInt(lightIndices.length));
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'timestamp'), now);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'maxPathLength'), maxPathLength);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'sampleCount'), sampleCount);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'sampleNumber'), sampleNumber);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'totalSamples'), samples);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'bvhNodeCount'), bvh.nodeCount);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'maxTextureSize'), maxTextureSize);

  // Determine the previous framebuffer texture
  const previousFramebufferTexture = BufferManager.getTexture(sampleNumber - 1);

  // Set the previous sample's texture as an input
  const previousFrameTextureIndex = BufferManager.getTextureIndex(sampleNumber);
  gl.activeTexture(gl.TEXTURE0 + previousFrameTextureIndex);
  gl.bindTexture(gl.TEXTURE_2D, previousFramebufferTexture);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'previousFrameTexture'), previousFrameTextureIndex);

  // Bind the current framebuffer for rendering
  const currentFramebuffer = BufferManager.getFrameBuffer(sampleNumber)
  gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffer);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Render each small quad sequentially
  for (let y = 0; y < numQuadsY; y++) {
    for (let x = 0; x < numQuadsX; x++) {
      console.log("new quad");

      const offsetX = x * quadSize;
      const offsetY = y * quadSize;
      const viewportWidth = Math.min(quadSize, width - offsetX);
      const viewportHeight = Math.min(quadSize, height - offsetY);

      gl.uniform1i(quadXLocation, x);
      gl.uniform1i(quadYLocation, y);

      gl.viewport(offsetX, offsetY, viewportWidth, viewportHeight);

      // Render the quad
      gl.useProgram(programPathTracing);
      gl.bindVertexArray(vaoPathTracing);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.flush();
      await sleep(cooldown);
    }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(null);

  gl.useProgram(programOutput);
  gl.bindVertexArray(vaoOutput);

  const outputTexture = BufferManager.getTexture(sampleNumber);
  const outputTextureLocation = gl.getUniformLocation(programOutput, 'u_texture');

  gl.activeTexture(gl.TEXTURE0 + previousFrameTextureIndex);
  gl.bindTexture(gl.TEXTURE_2D, outputTexture);
  gl.uniform1i(outputTextureLocation, previousFrameTextureIndex);

  gl.uniform2f(gl.getUniformLocation(programOutput, 'windowSize'), width, height);

  gl.viewport(0, 0, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);

  // Save the rendered image to a file
  if (saveFrame)
    saveImage(gl, width, height, `sample_${sampleNumber}_${fileNameSuffix}.png`, '');

  TextureIndex.setTextureIndex(2);

}


// ---------------------------------------------------------------------------------

async function renderAsync(times) {

  let previousTime = performance.now();
  let beforeRenderTime = performance.now();

  for (let i = 0; i < times; i++) {

    const startTime = performance.now();
    await render(performance.now(), i);

    await new Promise(requestAnimationFrame);
    const endTime = performance.now();

    const sampleTime = (endTime - startTime) / 1000; // Convert to seconds
    const timeBetweenFrames = (endTime - previousTime) / 1000; // Convert to seconds
    const timePassed = (startTime - beforeRenderTime) / 1000;

    // Calculate FPS
    const fps = 1 / (timeBetweenFrames);
    const avgFps = (i + 1) / timePassed;
    fpsElem.textContent = fps.toFixed(1);
    avgFpsElem.textContent = avgFps.toFixed(1);

    console.log(`sample ${i}: ${sampleTime.toFixed(4)} seconds\nfps: ${fps}`);

    previousTime = endTime;

    await sleep(cooldown);

  }

  let finishTimestamp = performance.now();

  console.log("time spent: " + ((finishTimestamp / 1000) - (beforeRenderTime / 1000)));

}

