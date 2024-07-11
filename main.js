const PI_NUMBER = 3.14159265359;
const SLEEP_TIME = 500;
const SLEEP_TIME_BETWEEN_QUADS = 200;


let frames = 3;
let maxPathLength = 5;
let sampleCount = 5;
let canvasSize = 1024;
let quadSize = 32;

// ------------------------------------------------------------------

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
//import { ObjectLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Load vertex and fragment shaders
import vertexShaderPathTracing from './shaders/vertexShader.glsl';
import vertexShaderOutput from './shaders/vertexShader.glsl';
import fragmentShaderPathTracing from './shaders/fragmentShader_pathTracing.glsl';
import fragmentShaderOutput from './shaders/fragmentShader_output.glsl';
// import { texture } from 'three/examples/jsm/nodes/Nodes.js';
// import { PI, floor } from 'three/examples/jsm/nodes/Nodes.js';

// utils
// import { createRGBDataTexture } from './utils/dataTextureCreator.js';
// import { mapCoordinates } from './utils/coordinatesMapper.js';


//const loader = new OBJLoader();



let coordinates = [];
let normals = [];
let colors = [];
let emissions = [];
let lightIndices = [];

let startTime, endTime;

let textureIndex = 0;
function getTextureIndexAndIncrease() {
  return textureIndex++;
}

let objects = 0;
let triangleCount = 0;
let vertexCount = 0;

let model, scene;

try {
  console.log("b4 loading");
  let prevTS = performance.
    model = await loadModel(
      // '/resources/my_cornell_2/gltf/my_cornell_2.gltf'
      // '/resources/bedroom1/customGLTF/bedroom1.gltf'
      // '/resources/bedroom2/gltf/bedroom2.gltf'
      '/resources/bedroom2/gltf/v3/bedroom2.gltf'
      // '/resources/my_cornell_3/gltf/my_cornell_3.gltf'
      // '/resources/my_cornell_4/gltf/my_cornell_4.gltf'
      // '/resources/cornell2/gltf/scene.gltf'
    );
  scene = model.scene;
  console.log("🌸 ~ scene:", scene)
} catch (e) {
  console.log(e);
}

// scene.updateMatrixWorld(true);




// const canvas = document.getElementById('webgl-canvas');
const canvas = document.createElement('canvas');
// canvas.height = canvasSize * 0.8;
// canvas.width = canvasSize * 1;

// canvas.height = canvasSize * 1;
// canvas.width = canvasSize * 0.8;

canvas.height = canvasSize;
canvas.width = canvasSize;
document.getElementById('canvas-container').appendChild(canvas);

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
if (512 > maxTextureSize) {
  console.error('El tamaño de la textura excede el tamaño máximo soportado:', maxTextureSize);
}


var width = gl.canvas.clientWidth;
var height = gl.canvas.clientHeight;
gl.canvas.width = width;
gl.canvas.height = height;

// const fb1 = createFramebuffer(gl, width, height);
// const fb2 = createFramebuffer(gl, width, height);
// let currentFramebuffer = fb1;
// let previousFramebuffer = fb2;

// -------------------- camera creation --------------------

const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

// camera coordinates for room v3
camera.position.x += 16;
// camera.position.y += 6.0;
camera.position.z -= 8;
camera.lookAt(0, 0, 0);
camera.rotateY(0.08);


// camera coordinates for cornell box
// camera.position.x += 12.4;
// camera.rotateY(PI_NUMBER / 2);


let cameraSource = camera.position.clone(); // no normalizar!!!!!
let cameraDirection = new THREE.Vector3();
camera.getWorldDirection(cameraDirection)

// const planeDimensions = getImagePlaneDimensions(camera);
// console.log("🚀 ~ planeDimensions:", planeDimensions)
/* console.log("🚀 ~ planeDimensions:", planeDimensions)
const cameraRight = new THREE.Vector3(-planeDimensions.right, 0, 0);
const cameraUp = new THREE.Vector3(0, planeDimensions.up, 0); */

const cameraUp = camera.up.clone();
const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, cameraUp).normalize();


const cameraLeft = cameraRight.clone().negate();
// const cameraMiddle = cameraSource.clone().sub(new THREE.Vector3(0.0, cameraSource.y, 0.0));
const cameraMiddle = cameraSource.clone().add(cameraDirection.clone()/* .multiplyScalar(1.2) */); // multiplicar por escalar para cambiar posicion near plano frustum
console.log("🚀 ~ cameraSource:", cameraSource)


// const cameraLeftBottom = getLeftBottomCorner(camera, planeDimensions.width, planeDimensions.height);
const cameraLeftBottom = cameraMiddle.clone()
  .sub(cameraRight.clone().multiplyScalar(0.5))
  .sub(cameraUp.clone().multiplyScalar(0.5));
console.log("🚀 ~ cameraLeftBottom:", cameraLeftBottom)
// (?) cameraLeftBottom.x += -0.5; // esta escala se hace para que el plano "near" no esté tan pegado a la cámara
console.log("🚀 ~ cameraLeftBottom:", cameraLeftBottom)

// window.addEventListener('resize', resizeCanvas);
// resizeCanvas();


// const fpsElem = document.querySelector("#fps");

// let then = 0;

let framebuffers = [];
let textures = [];
let textureIndices = [];

// Create framebuffer and texture
function createFramebufferAndTexture(gl, width, height) {
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  let texture = gl.createTexture();
  let textureIndex = getTextureIndexAndIncrease();
  gl.activeTexture(gl.TEXTURE0 + textureIndex);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('Framebuffer is not complete');
  }

  framebuffers.push(framebuffer);
  textures.push(texture);
  textureIndices.push(textureIndex);
}

createFramebufferAndTexture(gl, width, height);
createFramebufferAndTexture(gl, width, height);
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
  // const quadSize = 32; // Size of each small quad (adjust as needed)
  const numQuadsX = Math.ceil(width / quadSize);
  const numQuadsY = Math.ceil(height / quadSize);


  //function uploadTexture(gl, program, data, name, width, height, index)
  uploadTexture(gl, programPathTracing, coordinates, 'coordinatesTexture', (coordinates.length / 3), 1, getTextureIndexAndIncrease());
  uploadTexture(gl, programPathTracing, normals, 'normalsTexture', (normals.length / 3), 1, getTextureIndexAndIncrease());
  uploadTexture(gl, programPathTracing, colors, 'colorsTexture', (colors.length / 3), 1, getTextureIndexAndIncrease());
  uploadTexture(gl, programPathTracing, emissions, 'emissionsTexture', (emissions.length / 3), 1, getTextureIndexAndIncrease());
  uploadTexture(gl, programPathTracing, lightIndices, 'lightIndicesTexture', (lightIndices.length / 3), 1, getTextureIndexAndIncrease());

  // Set uniforms
  const quadXLocation = gl.getUniformLocation(programPathTracing, 'quadX');
  const quadYLocation = gl.getUniformLocation(programPathTracing, 'quadY');


  gl.uniform2f(gl.getUniformLocation(programPathTracing, 'windowSize'), width, height);
  gl.uniform1f(gl.getUniformLocation(programPathTracing, 'aspectRatio'), width / height);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraSource'), cameraSource.x, cameraSource.y, cameraSource.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraDirection'), cameraDirection.x, cameraDirection.y, cameraDirection.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraUp'), cameraUp.x, cameraUp.y, cameraUp.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraRight'), cameraRight.x, cameraRight.y, cameraRight.z);
  gl.uniform3f(gl.getUniformLocation(programPathTracing, 'cameraLeftBottom'), cameraLeftBottom.x, cameraLeftBottom.y, cameraLeftBottom.z);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'vertexCount'), parseInt(coordinates.length / 3));
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'triangleCount'), triangleCount);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'lightIndicesCount'), lightIndices.length);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'timestamp'), now);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'maxPathLength'), maxPathLength);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'sampleCount'), sampleCount);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'frameNumber'), frameNumber);
  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'totalFrames'), frames);

  gl.uniform1i(gl.getUniformLocation(programPathTracing, 'quadSize'), quadSize);

  // Determine the current and previous framebuffers
  const currentFramebuffer = framebuffers[frameNumber % 2];
  const previousTexture = textures[(frameNumber + 1) % 2];

  // Set the previous frame's texture as an input
  const previousFrameTextureLocation = gl.getUniformLocation(programPathTracing, 'previousFrameTexture');
  gl.activeTexture(gl.TEXTURE0 + textureIndices[frameNumber % 2]);
  gl.bindTexture(gl.TEXTURE_2D, previousTexture);
  gl.uniform1i(previousFrameTextureLocation, textureIndices[frameNumber % 2]);


  // Bind the current framebuffer for rendering
  gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffer);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Render each small quad sequentially
  for (let y = 0; y < numQuadsY; y++) {
    for (let x = 0; x < numQuadsX; x++) {
      console.log("quadX ", x, " quadY ", y);

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
  
  const simpleTexture = textures[frameNumber % 2];
  const simpleTextureLocation = gl.getUniformLocation(programOutput, 'u_texture');

  gl.activeTexture(gl.TEXTURE0 + textureIndices[frameNumber % 2]);
  gl.bindTexture(gl.TEXTURE_2D, simpleTexture);
  gl.uniform1i(simpleTextureLocation, textureIndices[frameNumber % 2]);

  gl.viewport(0, 0, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);

}

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
    await render(performance.now(), i + 1);

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

function checkGLError() {
  const error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error('WebGL Error:', error);
  }
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



function uploadTexture(gl, program, data, name, width, height, index) {

  // Create a texture.
  var texture = gl.createTexture();

  // Bind the texture to the correct texture unit
  gl.activeTexture(gl.TEXTURE0 + index);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D,
    0,
    gl.RGB32F,
    width,
    height,
    0,
    gl.RGB,
    gl.FLOAT,
    new Float32Array(data));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  //gl.bindTexture(gl.TEXTURE_2D, null);

  var textureLocation = gl.getUniformLocation(program, name);

  gl.uniform1i(textureLocation, index);

}

function createBuffer() {

}




async function loadModel(url) {

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      url,

      function (model) {
        var materialModelColor;
        //var obj = model;//.scene;
        console.log("🚀 ~ returnnewPromise ~ model:", model)
        var obj = model.scene;
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

            console.log(child.name);
            const geometry = child.geometry;

            // Ensure the geometry is not indexed, for simplicity
            // console.log("🌸 ~ child.geometry:", child.geometry.attributes.position.array.toString())
            child.geometry = child.geometry.toNonIndexed();
            // console.log("🌸 ~ child.geometry:", child.geometry.attributes.position.array.toString())

            // Apply matrixWorld to geometry vertices
            const positionAttribute = child.geometry.attributes.position;
            const worldMatrix = child.matrixWorld;
            let vertex;
            // console.log("🌸 ~ mappedCoordinatesArray:", child.geometry.attributes.position.array.toString())

            let mappedCoordinatesArray = [];
            // console.log("🌸 ~ positionAttribute.count:", positionAttribute.count)
            for (let i = 0; i < positionAttribute.count; i++) {
              vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
              vertex.applyMatrix4(worldMatrix);
              // positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
              mappedCoordinatesArray.push(...[vertex.x, vertex.y, vertex.z])
            }

            // positionAttribute.needsUpdate = true;

            // Optionally, reset the mesh's transformation matrix
            // child.matrix.identity();
            // child.matrixWorld.identity();

            // mappedCoordinatesArray = child.geometry.attributes.position.array;
            // console.log("🌸 ~ mappedCoordinatesArray:", mappedCoordinatesArray.toString())

            coordinates.push(...mappedCoordinatesArray);

            vertexCount += mappedCoordinatesArray.length / 3;
            triangleCount += mappedCoordinatesArray.length / 9;

            // for each triangle
            for (let i = 0; i < mappedCoordinatesArray.length / 9; i++) {
              // get triangle's normal
              let vertex0 = new THREE.Vector3(mappedCoordinatesArray[9 * i], mappedCoordinatesArray[9 * i + 1], mappedCoordinatesArray[9 * i + 2]);
              let vertex1 = new THREE.Vector3(mappedCoordinatesArray[9 * i + 3], mappedCoordinatesArray[9 * i + 4], mappedCoordinatesArray[9 * i + 5]);
              let vertex2 = new THREE.Vector3(mappedCoordinatesArray[9 * i + 6], mappedCoordinatesArray[9 * i + 7], mappedCoordinatesArray[9 * i + 8]);

              var triangle = new THREE.Triangle(vertex0, vertex1, vertex2);
              let triangleNormal = new THREE.Vector3();
              triangle.getNormal(triangleNormal);

              // const normal = new THREE.Vector3().crossVectors(edge1, edge2);
              // normals.push(...[normal.x, normal.y, normal.z]);
              normals.push(...[triangleNormal.x, triangleNormal.y, triangleNormal.z]);

              // get triangle's color
              const color = child.material.color;
              if (color) {
                colors.push(...[color.r, color.g, color.b]); //TODO: opacidad?
              }

              // get triangle's emission
              if (child.name == "Light")
                emissions.push(...[1.0, 1.0, 1.0]);
              else
                emissions.push(...[0.0, 0.0, 0.0]);
            }


          }
        });

        // console.log("🌸 ~ coordinates.length:", coordinates.length)

        // armar arreglo de indices de triangulos de luces
        for (let i = 0; i < emissions.length; i = i + 3) {
          if (emissions[i] > 0.0 || emissions[i + 1] > 0.0 || emissions[i + 2] > 0.0) {
            lightIndices.push(i / 3);
            lightIndices.push(i / 3);
            lightIndices.push(i / 3);
          }
        }
        console.log("🚀 lightIndices:", lightIndices)
        console.log("🌸 ~ triangleCount:", triangleCount)
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


function calculateImagePlaneVectors(camera) {
  const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
  const aspect = camera.aspect;

  // Calculate the height and width of the near plane
  const height = 2 * Math.tan(fov / 2) * camera.near;
  const width = height * aspect;

  // Get the camera's right and up direction vectors
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  camera.getWorldDirection(right);
  right.cross(camera.up).normalize().multiplyScalar(width);

  camera.getWorldDirection(up);
  up.cross(right).normalize().multiplyScalar(height);

  console.log("🚀 ~ calculateImagePlaneVectors ~ right:", right)
  console.log("🚀 ~ calculateImagePlaneVectors ~ up:", up)
  return { right, up };
}


function getImagePlaneDimensions(camera) {
  const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
  const aspect = camera.aspect;

  // Calculate the height and width of the near plane
  const height = 2 * Math.tan(fov / 2) * camera.near;
  const width = height * aspect;

  return { width, height };
}


function getLeftBottomCorner(camera, width, height) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  // Calculate the right and up vectors
  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up).normalize().multiplyScalar(width / 2);

  const up = new THREE.Vector3();
  up.copy(camera.up).normalize().multiplyScalar(height / 2);

  // Calculate the left bottom corner position
  const leftBottomCorner = camera.position.clone()
    .add(forward.multiplyScalar(camera.near))
    .sub(right)
    .sub(up);
  console.log("🚀 ~ getLeftBottomCorner ~ leftBottomCorner:", leftBottomCorner)

  return leftBottomCorner;
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
