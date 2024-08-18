const PI_NUMBER = 3.14159265359;
const SLEEP_TIME = 50;
const SLEEP_TIME_BETWEEN_QUADS = 50;


const frames = 50;
const maxPathLength = 5;
const sampleCount = 5;
const canvasSize = 128;
const quadSize = 16;
const urlSave = "image/png/v1";
const fileNameSuffix = `v13_cornell6_BVH_${frames}frames_${maxPathLength}bounces_${sampleCount}samples_${512}px`

const saveFrame = false;

// ------------------------------------------------------------------

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
//import { ObjectLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Load vertex and fragment shaders
import vertexShaderPathTracing from './shaders/vertexShader.glsl';
import vertexShaderOutput from './shaders/vertexShader.glsl';
import fragmentShaderPathTracing from './shaders/fragmentShaderPathTracing.glsl';
import fragmentShaderOutput from './shaders/fragmentShaderOutput.glsl';
// import { texture } from 'three/examples/jsm/nodes/Nodes.js';
// import { PI, floor } from 'three/examples/jsm/nodes/Nodes.js';

// utils
// import { createRGBDataTexture } from './utils/dataTextureCreator.js';
// import { mapCoordinates } from './utils/coordinatesMapper.js';
import { mapTrianglesArrayToTexturizedArray } from './utils/triangleMapper.js';
import { shuffleArray, sortTrianglesByBVHInorderIndices, sortTrianglesByDistanceToCamera } from './utils/triangleSorter.js';
import uploadTexture from './utils/textureUploader.js';

// classes
import Camera from './classes/camera.js';
import BVH from './classes/bvh.js';
import Triangle from './classes/triangle.js';

// modules
import BufferManager from './modules/bufferManager.js';
import TextureIndex from './modules/textureIndex.js';

//const loader = new OBJLoader();



let coordinates = [];
let trianglesIndices = [];
let normals = [];
let colors = [];
let emissions = [];
let lightIndices = [];
let lightTotalArea;

let newPropertiesArray;

let trianglesArray = [];


let startTime, endTime;

let objects = 0;
let triangleCount = 0;
let vertexCount = 0;

let model, scene;

try {
  console.log("b4 loading");
  model = await loadModel(
    // '/resources/my_cornell_2/gltf/my_cornell_2.gltf'
    // '/resources/bedroom2/gltf/v3/bedroom2.gltf'
    // '/resources/bedroom2/gltf/v5/bedroom2_v5.gltf'
    // '/resources/pixar_room/v1/pixar-room.gltf'
    '/resources/pixar_room/v3/pixar-room-3.gltf'
    // '/resources/my_cornell_6/gltf/my_cornell_6.gltf'
    // '/resources/bedroom1/customGLTF/bedroom1.gltf'
    // '/resources/bedroom2/gltf/bedroom2.gltf'
    // '/resources/my_cornell_3/gltf/my_cornell_3.gltf'
    // '/resources/my_cornell_4/gltf/my_cornell_4.gltf'
    // '/resources/cornell2/gltf/scene.gltf'
  );

  console.log("😀 ~ model:", model)

  scene = model.scene;
  console.log("🌸 ~ scene:", scene)
} catch (e) {
  console.log(e);
}
// console.log("🚀 ~ triangleCount:", triangleCount)


// scene.updateMatrixWorld(true);




// const canvas = document.getElementById('webgl-canvas');
const canvas = document.createElement('canvas');
// canvas.height = canvasSize * 0.8;
// canvas.width = canvasSize * 1;

// canvas.height = canvasSize * 1;
// canvas.width = canvasSize * 0.8;

/* // Turn off automatic recovery
canvas.set

// Restore the context when the mouse is clicked.
window.addEventListener("mousedown", function () {
  canvas.restoreContext();
}); */

const gl = canvas.getContext('webgl2');

if (!gl) {
  console.error('WebGL 2 not supported');
}

const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
console.log("🚀 ~ maxTextureSize:", maxTextureSize)
console.log('Max Fragment Shader Texture Units:', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
console.log('Max Vertex Shader Texture Units:', gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS));
console.log('Max Combined Texture Units:', gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS));

canvas.height = canvasSize;
canvas.width = canvasSize;
document.getElementById('canvas-container').appendChild(canvas);

var width = gl.canvas.clientWidth;
var height = gl.canvas.clientHeight;
gl.canvas.width = width;
gl.canvas.height = height;

let cameraInstance = new Camera(50, width / height, 0.1, 1000);

// room v3
// cameraInstance.translate('x', 14)
// cameraInstance.translate('z', -14)
// cameraInstance.translate('y', 3)


//cornell room
// cameraInstance.translate('x', 12.4)
// cameraInstance.rotate('y', PI_NUMBER / 2);


//cornell room
cameraInstance.translate('x', 2)
cameraInstance.translate('z', 4)
cameraInstance.translate('y', 2)
// cameraInstance.rotate('y', PI_NUMBER / 2);
cameraInstance.lookAt(0, -2, -4);



// cameraInstance.lookAt(0, 0, 0);




let camera = cameraInstance.getCamera();



let bvh = new BVH(trianglesArray);
console.log("🚀 ~ bvh:", bvh)
newPropertiesArray = mapTrianglesArrayToTexturizedArray(trianglesArray);

let texturizableTreeProperties = bvh.convertToTexturizableArrays();
console.log("🚀 ~ texturizableTreeProperties:", texturizableTreeProperties)

let texturizableInorderTrianglesIndices = [];
bvh.inorderTrianglesIndicesArray.forEach(element => {
  texturizableInorderTrianglesIndices.push(...[element, element, element])
});
console.log("🚀 ~ texturizableInorderTr ianglesIndices:", texturizableInorderTrianglesIndices)


// const fpsElem = document.querySelector("#fps");

// let then = 0;

BufferManager.createFramebufferAndTexture(gl, width, height);
BufferManager.createFramebufferAndTexture(gl, width, height);
// set textureOutput


////////

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


// gl.useProgram(programPathTracing);

// Full screen quad vertices (triangle strip)
const vertices = new Float32Array([
  -1.0, -1.0, // Bottom-left
  1.0, -1.0, // Bottom-right
  -1.0, 1.0, // Top-left
  1.0, 1.0  // Top-right
]);

// Create and bind vertex array object (VAO)
const vaoPathTracing = gl.createVertexArray();
gl.bindVertexArray(vaoPathTracing);

// Create vertex buffer
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Bind vertex attributes
const positionLocationPathTracing = gl.getAttribLocation(programPathTracing, 'position');
gl.enableVertexAttribArray(positionLocationPathTracing);
gl.vertexAttribPointer(positionLocationPathTracing, 2, gl.FLOAT, false, 0, 0);


// Create and bind VAO for simple program
const vaoOutput = gl.createVertexArray();
gl.bindVertexArray(vaoOutput);

const simpleVertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, simpleVertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLocationOutput = gl.getAttribLocation(programOutput, 'position');
gl.enableVertexAttribArray(positionLocationOutput);
gl.vertexAttribPointer(positionLocationOutput, 2, gl.FLOAT, false, 0, 0);

gl.bindVertexArray(null);

// Render
async function render(now, frameNumber) {

  gl.useProgram(programPathTracing);

  // Divide the screen into smaller quads
  const numQuadsX = Math.ceil(width / quadSize);
  const numQuadsY = Math.ceil(height / quadSize);


  //function uploadTexture(gl, program, data, name, width, height, index)
  uploadTexture(gl, programPathTracing, newPropertiesArray.coordinates, 'coordinatesTexture', (newPropertiesArray.coordinates.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, newPropertiesArray.normals, 'normalsTexture', (newPropertiesArray.normals.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, newPropertiesArray.colors, 'colorsTexture', (newPropertiesArray.colors.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, newPropertiesArray.emissions, 'emissionsTexture', (newPropertiesArray.emissions.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, newPropertiesArray.lightIndices, 'lightIndicesTexture', (newPropertiesArray.lightIndices.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, texturizableTreeProperties.nodesBoundingBoxesMins, 'nodesBoundingBoxesMins', (texturizableTreeProperties.nodesBoundingBoxesMins.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, texturizableTreeProperties.nodesBoundingBoxesMaxs, 'nodesBoundingBoxesMaxs', (texturizableTreeProperties.nodesBoundingBoxesMaxs.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, texturizableTreeProperties.nodesMissLinkIndices, 'nodesMissLinkIndices', (texturizableTreeProperties.nodesMissLinkIndices.length / 3), 1, TextureIndex.getNextTextureIndex());
  // uploadTexture(gl, programPathTracing, texturizableTreeProperties.nodesTrianglesIndices, 'nodesTrianglesIndices', (texturizableTreeProperties.nodesTrianglesIndices.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, texturizableTreeProperties.nodesTrianglesCount, 'nodesTrianglesCount', (texturizableTreeProperties.nodesTrianglesCount.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, texturizableTreeProperties.nodesInorderTrianglesIndices, 'nodesInorderTrianglesIndices', (texturizableTreeProperties.nodesInorderTrianglesIndices.length / 3), 1, TextureIndex.getNextTextureIndex());
  uploadTexture(gl, programPathTracing, texturizableInorderTrianglesIndices, 'inorderTrianglesIndicesArray', (texturizableInorderTrianglesIndices.length / 3), 1, TextureIndex.getNextTextureIndex());


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
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'vertexCount'), parseInt(newPropertiesArray.coordinates.length / 3));
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'triangleCount'), triangleCount);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'lightIndicesCount'), parseInt(newPropertiesArray.lightIndices.length / 3));
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'timestamp'), now);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'maxPathLength'), maxPathLength);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'sampleCount'), sampleCount);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'frameNumber'), frameNumber);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'totalFrames'), frames);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'bvhNodeCount'), bvh.nodeCount);

  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'quadSize'), quadSize);

  // Determine the current and previous framebuffers
  // console.log('currentFramebuffer')
  const currentFramebuffer = BufferManager.getFrameBuffer(frameNumber)
  // console.log('previousTexture')
  const previousTexture = BufferManager.getTexture(frameNumber + 1);

  // Set the previous frame's texture as an input
  const previousFrameTextureLocation = gl.getUniformLocation(programPathTracing, 'previousFrameTexture');
  gl.activeTexture(gl.TEXTURE0 + BufferManager.getTextureIndex(frameNumber));
  gl.bindTexture(gl.TEXTURE_2D, previousTexture);
  gl.uniform1i(previousFrameTextureLocation, BufferManager.getTextureIndex(frameNumber));


  // Bind the current framebuffer for rendering
  gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffer);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Render each small quad sequentially
  for (let y = 0; y < numQuadsY; y++) {
    for (let x = 0; x < numQuadsX; x++) {
      // console.log("quadX ", x, " quadY ", y);
      console.log("new quad");

      const offsetX = x * quadSize;
      const offsetY = y * quadSize;
      const viewportWidth = Math.min(quadSize, width - offsetX);
      const viewportHeight = Math.min(quadSize, height - offsetY);

      gl.uniform1i(quadXLocation, x);
      gl.uniform1i(quadYLocation, y);

      // Set the viewport to the current quad
      gl.viewport(offsetX, offsetY, viewportWidth, viewportHeight);
      // gl.viewport(offsetX, offsetY, quadSize, quadSize);

      // Render the quad
      gl.useProgram(programPathTracing);
      gl.bindVertexArray(vaoPathTracing);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // gl.finish();
      gl.flush();
      await sleep(SLEEP_TIME_BETWEEN_QUADS);
    }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(null);

  gl.useProgram(programOutput);
  gl.bindVertexArray(vaoOutput);

  const simpleTexture = BufferManager.getTexture(frameNumber);
  const simpleTextureLocation = gl.getUniformLocation(programOutput, 'u_texture');

  gl.activeTexture(gl.TEXTURE0 + BufferManager.getTextureIndex(frameNumber));
  gl.bindTexture(gl.TEXTURE_2D, simpleTexture);
  gl.uniform1i(simpleTextureLocation, BufferManager.getTextureIndex(frameNumber));

  gl.viewport(0, 0, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);

  // Save the rendered image to a file
  if (saveFrame)
    readPixelsAndSave(gl, width, height, `frame_${frameNumber}_${fileNameSuffix}.png`, urlSave);

  TextureIndex.setTextureIndex(2);

}

// console.log("🚀 ~ render ~ lightIndices:", lightIndices)

const fpsElem = document.querySelector("#fps");
const avgFpsElem = document.querySelector("#avg-fps");

// ---------------------------------------------------------------------------------

async function renderAsync(times) {

  let previousTime = performance.now();
  let beforeRenderTime = performance.now();

  var stats = new Stats();
  // stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  // document.body.appendChild(stats.dom);

  for (let i = 0; i < times; i++) {

    // stats.begin();

    const startTime = performance.now();
    await render(performance.now(), i);

    await new Promise(requestAnimationFrame); // Wait for the next animation frame
    const endTime = performance.now();

    const frameTime = (endTime - startTime) / 1000; // Convert to seconds
    const timeBetweenFrames = (endTime - previousTime) / 1000; // Convert to seconds
    const timePassed = (startTime - beforeRenderTime) / 1000;

    // Calculate FPS
    const fps = 1 / (timeBetweenFrames);
    const avgFps = (i + 1) / timePassed;
    fpsElem.textContent = fps.toFixed(1);
    avgFpsElem.textContent = avgFps.toFixed(1);

    console.log(
      `frame ${i}: ${frameTime.toFixed(4)} seconds
fps: ${fps}`);

    previousTime = endTime;

    await sleep(SLEEP_TIME);
    // stats.end();

  }


  let finishTimestamp = performance.now();

  console.log("time spent: " + ((finishTimestamp / 1000) - (beforeRenderTime / 1000)));

}

await renderAsync(frames);



// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------


function readPixelsAndSave(gl, width, height, filename, urlSave) {
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




function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}





async function loadModel(url) {

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    let triangleIndex = 0;

    loader.load(
      url,

      function (model) {
        var materialModelColor;
        //var obj = model;//.scene;
        console.log("🚀 ~ returnnewPromise ~ model:", model)
        var obj = model.scene;
        console.log("🚀 ~ returnnewPromise ~ obj:", obj)
        obj.updateMatrixWorld(true);

        const boundingBox = new THREE.Box3().setFromObject(obj);
        // console.log("🚀 ~ returnnewPromise ~ boundingBox:", boundingBox)

        const center = boundingBox.getCenter(new THREE.Vector3());
        // console.log("🚀 ~ returnnewPromise ~ center:", center)

        // const translation = new THREE.Vector3(-center.x / 2, -center.y / 2, -center.z / 2);
        const translation = new THREE.Vector3(-center.x, -center.y, -center.z);
        // obj.geometry.center();

        obj.traverse((child) => {
          if (child.isMesh) {
            child.position.add(translation);
            // child.geometry.center();
          }
        });

        // Update matrixWorld for each child
        obj.traverse((child) => {
          if (child.isMesh) {
            child.updateMatrix();
            child.updateMatrixWorld(true);
          }
        });

        // Now we find each Mesh...
        obj.traverseVisible(function (child) {

          // child.updateMatrixWorld(true);

          // child.position.add(translation);

          // Check if the child is a Mesh and has a material
          if (child instanceof THREE.Mesh) {
            // console.log("-------------------------------------------------------------------------------")
            // console.log("🌸 ~ child:", child)

            // console.log(child.name);
            const geometry = child.geometry;

            // Ensure the geometry is not indexed, for simplicity
            child.geometry = child.geometry.toNonIndexed();

            // Apply matrixWorld to geometry vertices
            const positionAttribute = child.geometry.attributes.position;
            const worldMatrix = child.matrixWorld;
            let vertex;

            let mappedMeshVertexCoordinatesArray = [];

            let mappedTrianglesArray = [];


            for (let i = 0; i < positionAttribute.count; i++) {
              vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
              vertex.applyMatrix4(worldMatrix);
              // console.log("🚀 ~ vertex:", vertex)
              // positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
              mappedMeshVertexCoordinatesArray.push(...[vertex.x, vertex.y, vertex.z])
              trianglesIndices.push(triangleIndex);
              triangleIndex++;
            }
            // console.log("🚀 ~ mappedMeshVertexCoordinatesArray:", (mappedMeshVertexCoordinatesArray.length))


            for (let i = 0; i < mappedMeshVertexCoordinatesArray.length / 9; i++) {

              let newTriangle = new Triangle(
                new THREE.Triangle(
                  new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i], mappedMeshVertexCoordinatesArray[9 * i + 1], mappedMeshVertexCoordinatesArray[9 * i + 2]),
                  new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i + 3], mappedMeshVertexCoordinatesArray[9 * i + 4], mappedMeshVertexCoordinatesArray[9 * i + 5]),
                  new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i + 6], mappedMeshVertexCoordinatesArray[9 * i + 7], mappedMeshVertexCoordinatesArray[9 * i + 8])))

              mappedTrianglesArray.push(newTriangle);
              triangleCount++;
              vertexCount += 3;


            }

            // console.log("🚀 ~ mappedTrianglesArray:", mappedTrianglesArray)

            //  push the array of mapped coordinates of the mesh into coordinates
            // coordinates.push(...mappedMeshVertexCoordinatesArray);

            // vertexCount += mappedMeshVertexCoordinatesArray.length / 3;
            // console.log("😡 ~ vertexCount adding mesh " + child.name + ": " + vertexCount)
            // triangleCount += mappedMeshVertexCoordinatesArray.length / 9;
            // console.log("😡 ~ triangleCount adding mesh " + child.name + ": " + triangleCount)


            // for each triangle
            for (let i = 0; i < mappedTrianglesArray.length; i++) {
              // get triangle's normal
              /*               let vertex0 = new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i], mappedMeshVertexCoordinatesArray[9 * i + 1], mappedMeshVertexCoordinatesArray[9 * i + 2]);
                            let vertex1 = new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i + 3], mappedMeshVertexCoordinatesArray[9 * i + 4], mappedMeshVertexCoordinatesArray[9 * i + 5]);
                            let vertex2 = new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i + 6], mappedMeshVertexCoordinatesArray[9 * i + 7], mappedMeshVertexCoordinatesArray[9 * i + 8]); */

              // var triangle = new THREE.Triangle(vertex0, vertex1, vertex2);
              mappedTrianglesArray[i].normal = new THREE.Vector3();
              mappedTrianglesArray[i].triangle.getNormal(mappedTrianglesArray[i].normal);
              // let triangleNormal = new THREE.Vector3();
              // triangle.getNormal(triangleNormal);

              // normals.push(...[mappedTrianglesArray[i].normal.x, mappedTrianglesArray[i].normal.y, mappedTrianglesArray[i].normal.z]);

              // get triangle's color
              const color = child.material.color;
              mappedTrianglesArray[i].color = color;
              /* if (color) {
                colors.push(...[color.r, color.g, color.b]); //TODO: opacidad?
              } */


              const emission = child.material.emissive;
              mappedTrianglesArray[i].emission = emission;
              // console.log("🚀 ~ emission:", emission)
              // emissions.push(...[emission.r * 50, emission.g * 50, emission.b * 50]);
              // emissions.push(...[emission.r, emission.g, emission.b]);


            }

            trianglesArray.push(...mappedTrianglesArray)

          }
        });

        // console.log("🌸 ~ coordinates.length:", coordinates.length)

        console.log("🚀 ~ triangle Count:", trianglesArray.length)

        // armar arreglo de indices de triangulos de luces
        for (let i = 0; i < emissions.length; i = i + 3) {
          if (trianglesArray[i].emission.r > 0.0 || trianglesArray[i].emission.r > 0.0 || trianglesArray[i].emission.r > 0.0) {
            lightIndices.push(i / 3);
            lightIndices.push(i / 3);
            lightIndices.push(i / 3);
          }
        }

        // calcular area total luces


        // console.log("🚀 lightIndices:", lightIndices)
        // console.log("🌸 ~ triangleCount:", triangleCount)
        // console.log("🚀 ~ colors:", colors)


        resolve(model);
      },
      function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      function (error) {
        console.error(error);
        reject(error);
      });
  })
}




// Adjust canvas size
function resizeCanvasToDisplaySize() {
  var width = gl.canvas.clientWidth;
  var height = gl.canvas.clientHeight;
  if (gl.canvas.width != width ||
    gl.canvas.height != height) {
    gl.canvas.width = width;
    gl.canvas.height = height;
  }
}

function createFramebuffer(gl, width, height) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  return { framebuffer, texture };
}
