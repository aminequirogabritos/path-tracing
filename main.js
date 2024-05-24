const PI_NUMBER = 3.14159265359;

import * as THREE from 'three';
//import { ObjectLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Load vertex and fragment shaders
import vertexShader from './shaders/vertexShader.glsl';
import fragmentShader from './shaders/fragmentShader2.glsl';
import { PI, /* cameraPosition, */ floor } from 'three/examples/jsm/nodes/Nodes.js';

// utils
import { createRGBDataTexture } from './utils/dataTextureCreator.js';
import { mapCoordinates } from './utils/coordinatesMapper.js';


//const loader = new OBJLoader();
const loader = new GLTFLoader();

let coordinates = [];
let normals = [];
let colors = [];
let emissions = [];




let objects = 0;
let triangleCount = 0;
let vertexCount = 0;

async function loadModel() {

  return new Promise((resolve, reject) => {
    loader.load(
      '/resources/my_cornell_2/gltf/my_cornell_2.gltf',
      // '/resources/my_cornell_3/gltf/my_cornell_3.gltf',
      // '/resources/cornell2/gltf/scene.gltf',

      function (model) {
        var materialModelColor;
        //var obj = model;//.scene;
        var obj = model.scene;
        obj.updateMatrixWorld(true);

        const boundingBox = new THREE.Box3().setFromObject(obj);
        console.log("🚀 ~ returnnewPromise ~ boundingBox:", boundingBox)

        const center = boundingBox.getCenter(new THREE.Vector3());
        console.log("🚀 ~ returnnewPromise ~ center:", center)

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
            console.log("-------------------------------------------------------------------------------")
            console.log("🌸 ~ child:", child)

            console.log(child.name);
            const geometry = child.geometry;
            // geometry.center();

            // geometry.applyMatrix4(child.matrixWorld);
            // child.updateMatrixWorld();

            /*             let mappedCoordinatesArray;
                        if (geometry.index !== null) {
                          mappedCoordinatesArray = mapCoordinates(geometry.attributes.position.array, geometry.getIndex().array);
            
                        } else {
                          mappedCoordinatesArray = geometry.attributes.position.array;
                        }
            
                        for (let i = 0; i < mappedCoordinatesArray.length / 3; i++) {
            
                          let originalVertex = new THREE.Vector3(mappedCoordinatesArray[3 * i], mappedCoordinatesArray[3 * i + 1], mappedCoordinatesArray[3 * i + 2]);
                          let updatedVertex = originalVertex.applyMatrix4(child.matrixWorld);
            
                          // console.log(updatedVertex);
            
                          mappedCoordinatesArray[3 * i] = updatedVertex.x;
                          mappedCoordinatesArray[3 * i + 1] = updatedVertex.y;
                          mappedCoordinatesArray[3 * i + 2] = updatedVertex.z;
            
                        }
                        console.log("🌸 ~ mappedCoordinatesArray:", mappedCoordinatesArray) */

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
            console.log("🌸 ~ positionAttribute.count:", positionAttribute.count)
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
            console.log("🌸 ~ mappedCoordinatesArray:", mappedCoordinatesArray.toString())

            coordinates.push(...mappedCoordinatesArray);

            vertexCount += mappedCoordinatesArray.length / 3;
            triangleCount += mappedCoordinatesArray.length / 9;
            console.log("🌸 ~ triangleCount:", triangleCount)
            // const numFaces = triangleCount + geometry.index.count / 3;
            // const triangleIndices = new Float32Array(geometry.attributes.position.count);

            // for each triangle
            for (let i = 0; i < mappedCoordinatesArray.length / 9; i++) {
              // get triangle's normal
              let vertex0 = new THREE.Vector3(mappedCoordinatesArray[9 * i], mappedCoordinatesArray[9 * i + 1], mappedCoordinatesArray[9 * i + 2]);
              let vertex1 = new THREE.Vector3(mappedCoordinatesArray[9 * i + 3], mappedCoordinatesArray[9 * i + 4], mappedCoordinatesArray[9 * i + 5]);
              let vertex2 = new THREE.Vector3(mappedCoordinatesArray[9 * i + 6], mappedCoordinatesArray[9 * i + 7], mappedCoordinatesArray[9 * i + 8]);

              var triangle = new THREE.Triangle(vertex0, vertex1, vertex2);
              let triangleNormal = new THREE.Vector3();
              triangle.getNormal(triangleNormal);

              // const edge1 = new THREE.Vector3();
              // edge1.subVectors(vertex1, vertex0).normalize();
              // const edge2 = new THREE.Vector3();
              // edge2.subVectors(vertex2, vertex0).normalize();

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
                emissions.push(...[3.0, 3.0, 3.0]);
              else
                emissions.push(...[0.0, 0.0, 0.0]);
            }


          }
        });

        console.log(coordinates.length);
        console.log("🌸 ~ coordinates.length:", coordinates.length)

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

let model, scene;

try {
  model = await loadModel();
  scene = model.scene;
  console.log("🌸 ~ scene:", scene)
} catch (e) {
  console.log(e);
}

// scene.updateMatrixWorld(true);




const canvas = document.getElementById('webgl-canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
  console.error('WebGL 2 not supported');
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

var width = gl.canvas.clientWidth;
var height = gl.canvas.clientHeight;
gl.canvas.width = width;
gl.canvas.height = height;

/* const boundingBox = new THREE.Box3().setFromObject(scene);
console.log("🚀 ~ returnnewPromise ~ boundingBox:", boundingBox)

const center = boundingBox.getCenter(new THREE.Vector3());
console.log("🚀 ~ returnnewPromise ~ center:", center) */

// const translation = new THREE.Vector3(-center.x / 2, -center.y / 2, -center.z / 2);
// const translation = new THREE.Vector3(-center.x, -center.y, -center.z);


const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

// camera.lookAt(new THREE.Vector3(0, 0, 0));

// camera.position.x += translation.x;
// camera.position.y += translation.y;
// camera.position.z += translation.z;
camera.position.x += 12.4;
// camera.position.y += 0;
// camera.position.z += 0;
camera.rotateY(PI_NUMBER / 2);
// camera.rotateZ(PI_NUMBER);

// camera.lookAt(new THREE.Vector3(0, 0, 0));

// camera.position.x += 14;
// camera.position.y += 5;
// camera.position.z += 2;
// camera.lookAt(new THREE.Vector3(-4, -9.5, 8));


// camera.lookAt(new THREE.Vector3(0,0,0));

/* // 1. Calculate the bounding box of your scene
const boundingBox = new THREE.Box3().setFromObject(scene);
console.log("🌸 ~ boundingBox:", boundingBox)

// 2. Calculate the center of the bounding box
const center = boundingBox.getCenter(new THREE.Vector3());
console.log("🌸 ~ center:", center)

// 3. Calculate the radius of the bounding sphere
const radius = boundingBox.getSize(new THREE.Vector3()).length() / 2;
console.log("🌸 ~ radius:", radius)

// 4. Position the camera
const cameraDistance = radius * 20; // Adjust this factor as needed
console.log("🌸 ~ cameraDistance:", cameraDistance)
const cameraPosition = new THREE.Vector3().copy(center).add(new THREE.Vector3(0, 0, cameraDistance));
console.log("🌸 ~ cameraPosition:", cameraPosition)

// 5. Look at the center of the bounding box
camera.lookAt(center); */

// Set the camera's position and update its matrix
// camera.position.copy(cameraPosition);



// camera.updateMatrixWorld();
// camera.updateProjectionMatrix();


let cameraSource = camera.position.clone(); // no normalizar!!!!!
let cameraDirection = new THREE.Vector3();
camera.getWorldDirection(cameraDirection)

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

// const planeVectors = calculateImagePlaneVectors(camera);
// const cameraRight = planeVectors.right;
// const cameraUp = planeVectors.up;
// console.log("🚀 ~ cameraUp:", cameraUp)
// console.log("🚀 ~ cameraRight:", cameraRight)


function getImagePlaneDimensions(camera) {
  const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
  const aspect = camera.aspect;

  // Calculate the height and width of the near plane
  const height = 2 * Math.tan(fov / 2) * camera.near;
  const width = height * aspect;

  return { width, height };
}

// const planeDimensions = getImagePlaneDimensions(camera);
// console.log("🚀 ~ planeDimensions:", planeDimensions)
/* console.log("🚀 ~ planeDimensions:", planeDimensions)
const cameraRight = new THREE.Vector3(-planeDimensions.right, 0, 0);
const cameraUp = new THREE.Vector3(0, planeDimensions.up, 0); */

const cameraUp = camera.up.clone();
const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, cameraUp).normalize();


const cameraLeft = cameraRight.clone().negate();
// const cameraMiddle = cameraSource.clone().sub(new THREE.Vector3(0.0, cameraSource.y, 0.0));
const cameraMiddle = cameraSource.clone().add(cameraDirection.clone()/* .multiplyScalar(0.9) */); // multiplicar por escalar para cambiar posicion near plano frustum
console.log("🚀 ~ cameraSource:", cameraSource)

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


// const cameraLeftBottom = getLeftBottomCorner(camera, planeDimensions.width, planeDimensions.height);
const cameraLeftBottom = cameraMiddle.clone()
  .sub(cameraRight.clone().multiplyScalar(0.5))
  .sub(cameraUp.clone().multiplyScalar(0.5));
console.log("🚀 ~ cameraLeftBottom:", cameraLeftBottom)
// cameraLeftBottom.x += -0.5; // esta escala se hace para que el plano "near" no esté tan pegado a la cámara
console.log("🚀 ~ cameraLeftBottom:", cameraLeftBottom)

// camera.rotateY(0.7853981633974483);


/* console.log("🌸 ~ triangleCount:", triangleCount)

console.log("🌸 ~ coordinates.length:", coordinates.length)

console.log("🌸 ~ coordinates:", coordinates)
console.log("🌸 ~ normals:", normals)
console.log("🌸 ~ colors:", colors)
console.log("🌸 ~ emissions:", emissions) */


// window.addEventListener('resize', resizeCanvas);
// resizeCanvas();

const vertexShaderSource = createShader(gl, gl.VERTEX_SHADER, vertexShader);
const fragmentShaderSource = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

//function uploadTexture(gl, program, data, name, width, height, index)
uploadTexture(gl, program, coordinates, 'coordinatesTexture', (coordinates.length / 3), 1, 0);
uploadTexture(gl, program, normals, 'normalsTexture', (normals.length / 3), 1, 1);
uploadTexture(gl, program, colors, 'colorsTexture', (colors.length / 3), 1, 2);
uploadTexture(gl, program, emissions, 'emissionsTexture', (emissions.length / 3), 1, 3);

// Set uniforms
const windowSizeLocation = gl.getUniformLocation(program, 'windowSize');
const cameraSourceLocation = gl.getUniformLocation(program, 'cameraSource');
const cameraDirectionLocation = gl.getUniformLocation(program, 'cameraDirection');
const cameraUpLocation = gl.getUniformLocation(program, 'cameraUp');
const cameraRightLocation = gl.getUniformLocation(program, 'cameraRight');
const cameraLeftBottomLocation = gl.getUniformLocation(program, 'cameraLeftBottom');
const vertexCountLocation = gl.getUniformLocation(program, 'vertexCount');
const triangleCountLocation = gl.getUniformLocation(program, 'triangleCount');


gl.uniform2f(windowSizeLocation, width, height);
gl.uniform3f(cameraSourceLocation, cameraSource.x, cameraSource.y, cameraSource.z);
gl.uniform3f(cameraDirectionLocation, cameraDirection.x, cameraDirection.y, cameraDirection.z);
gl.uniform3f(cameraUpLocation, cameraUp.x, cameraUp.y, cameraUp.z);
gl.uniform3f(cameraRightLocation, cameraRight.x, cameraRight.y, cameraRight.z);
gl.uniform3f(cameraLeftBottomLocation, cameraLeftBottom.x, cameraLeftBottom.y, cameraLeftBottom.z);
gl.uniform1i(vertexCountLocation, parseInt(coordinates.length / 3));
gl.uniform1i(triangleCountLocation, triangleCount);

// Full screen quad vertices (triangle strip)
const vertices = new Float32Array([
  -1.0, -1.0, // Bottom-left
  1.0, -1.0, // Bottom-right
  -1.0, 1.0, // Top-left
  1.0, 1.0  // Top-right
]);
/* const vertices = new Float32Array([
  -1.0, -1.0, // Bottom-left
  1.0, -1.0, // Bottom-right
  -1.0, 1.0, // Top-left
  1.0, 1.0  // Top-right
]); */

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

// Render
async function render() {
  resizeCanvasToDisplaySize();
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);


  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);
}

render();



/* function render() {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Set clear color to black
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}

render(); */



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