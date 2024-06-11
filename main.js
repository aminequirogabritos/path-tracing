const PI_NUMBER = 3.14159265359;

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
//import { ObjectLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Load vertex and fragment shaders
import vertexShader from './shaders/vertexShader.glsl';
import fragmentShader from './shaders/fragmentShader2.glsl';
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

let frames = 1;
let maxPathLength = 4;
let sampleCount = 128;
let canvasSize = 256;

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
      '/resources/bedroom2/gltf/bedroom2.gltf'
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


const gl = canvas.getContext('webgl2');

if (!gl) {
  console.error('WebGL 2 not supported');
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

camera.position.x += 120.4;
camera.rotateY(PI_NUMBER / 2);

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



// Render
async function render(now, frameNumber) {

  const vertexShaderSource = createShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragmentShaderSource = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  //function uploadTexture(gl, program, data, name, width, height, index)
  uploadTexture(gl, program, coordinates, 'coordinatesTexture', (coordinates.length / 3), 1, 0);
  uploadTexture(gl, program, normals, 'normalsTexture', (normals.length / 3), 1, 1);
  uploadTexture(gl, program, colors, 'colorsTexture', (colors.length / 3), 1, 2);
  uploadTexture(gl, program, emissions, 'emissionsTexture', (emissions.length / 3), 1, 3);
  uploadTexture(gl, program, lightIndices, 'lightIndicesTexture', (lightIndices.length / 3), 1, 4);

  // Set uniforms
  const windowSizeLocation = gl.getUniformLocation(program, 'windowSize');
  const aspectRatioLocation = gl.getUniformLocation(program, 'aspectRatio');
  const cameraSourceLocation = gl.getUniformLocation(program, 'cameraSource');
  const cameraDirectionLocation = gl.getUniformLocation(program, 'cameraDirection');
  const cameraUpLocation = gl.getUniformLocation(program, 'cameraUp');
  const cameraRightLocation = gl.getUniformLocation(program, 'cameraRight');
  const cameraLeftBottomLocation = gl.getUniformLocation(program, 'cameraLeftBottom');
  const vertexCountLocation = gl.getUniformLocation(program, 'vertexCount');
  const triangleCountLocation = gl.getUniformLocation(program, 'triangleCount');
  const lightIndicesCountLocation = gl.getUniformLocation(program, 'lightIndicesCount');
  const timestampLocation = gl.getUniformLocation(program, 'timestamp');
  const maxPathLengthLocation = gl.getUniformLocation(program, 'maxPathLength');
  const sampleCountLocation = gl.getUniformLocation(program, 'sampleCount');
  const frameNumberLocation = gl.getUniformLocation(program, 'frameNumber');


  gl.uniform2f(windowSizeLocation, width, height);
  gl.uniform1f(aspectRatioLocation, width / height);
  gl.uniform3f(cameraSourceLocation, cameraSource.x, cameraSource.y, cameraSource.z);
  gl.uniform3f(cameraDirectionLocation, cameraDirection.x, cameraDirection.y, cameraDirection.z);
  gl.uniform3f(cameraUpLocation, cameraUp.x, cameraUp.y, cameraUp.z);
  gl.uniform3f(cameraRightLocation, cameraRight.x, cameraRight.y, cameraRight.z);
  gl.uniform3f(cameraLeftBottomLocation, cameraLeftBottom.x, cameraLeftBottom.y, cameraLeftBottom.z);
  gl.uniform1i(vertexCountLocation, parseInt(coordinates.length / 3));
  gl.uniform1i(triangleCountLocation, triangleCount);
  gl.uniform1i(lightIndicesCountLocation, lightIndices.length);
  gl.uniform1i(timestampLocation, now);
  gl.uniform1i(maxPathLengthLocation, maxPathLength);
  gl.uniform1i(sampleCountLocation, sampleCount);
  gl.uniform1i(frameNumberLocation, frameNumber);

  // Full screen quad vertices (triangle strip)
  const vertices = new Float32Array([
    -1.0, -1.0, // Bottom-left
    1.0, -1.0, // Bottom-right
    -1.0, 1.0, // Top-left
    1.0, 1.0  // Top-right
  ]);

  // Create and bind vertex array object (VAO)
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Create vertex buffer
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // Bind vertex attributes
  const positionLocation = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Unbind VAO
  gl.bindVertexArray(null);


  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Render to current framebuffer
  gl.useProgram(program);
  gl.bindVertexArray(vao);



  //-.-------------

  // Draw the fullscreen quad
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.finish();  // Ensure all commands are completed

  gl.bindVertexArray(null);
  // // Swap framebuffers
  // // [currentFramebuffer, previousFramebuffer] = [previousFramebuffer, currentFramebuffer];


  // gl.bindVertexArray(null);

}

const fpsElem = document.querySelector("#fps");
const avgFpsElem = document.querySelector("#avg-fps");

async function renderAsync(times) {

  let previousTime = performance.now();
  let beforeRenderTime = performance.now();

  var stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom);

  // Render each frame with a different color
  for (let i = 0; i < times; i++) {

    stats.begin();

    const startTime = performance.now();
    render(performance.now(), i + 1);

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

    stats.end();

  }
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
                emissions.push(...[10.0, 10.0, 10.0]);
              else
                emissions.push(...[0.0, 0.0, 0.0]);
            }


          }
        });

        console.log("🌸 ~ coordinates.length:", coordinates.length)

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
        console.log("🚀 ~ colors:", colors)


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
