import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Triangle from '../classes/triangle.js';


export default async function loadModel(url) {

    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        let triangleIndex = 0;
        let trianglesArray = [];

        loader.load(
            url,

            function (model) {
                var obj = model.scene;
                obj.updateMatrixWorld(true);

                const boundingBox = new THREE.Box3().setFromObject(obj);

                const center = boundingBox.getCenter(new THREE.Vector3());
                const translation = new THREE.Vector3(-center.x, -center.y, -center.z);

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

                    // Check if the child is a Mesh and has a material
                    if (child instanceof THREE.Mesh) {
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
                            mappedMeshVertexCoordinatesArray.push(...[vertex.x, vertex.y, vertex.z])
                            triangleIndex++;
                        }
                        for (let i = 0; i < mappedMeshVertexCoordinatesArray.length / 9; i++) {

                            let newTriangle = new Triangle(
                                new THREE.Triangle(
                                    new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i], mappedMeshVertexCoordinatesArray[9 * i + 1], mappedMeshVertexCoordinatesArray[9 * i + 2]),
                                    new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i + 3], mappedMeshVertexCoordinatesArray[9 * i + 4], mappedMeshVertexCoordinatesArray[9 * i + 5]),
                                    new THREE.Vector3(mappedMeshVertexCoordinatesArray[9 * i + 6], mappedMeshVertexCoordinatesArray[9 * i + 7], mappedMeshVertexCoordinatesArray[9 * i + 8])))

                            mappedTrianglesArray.push(newTriangle);
                        }

                        // for each triangle
                        for (let i = 0; i < mappedTrianglesArray.length; i++) {
                            // get triangle's normal
                            mappedTrianglesArray[i].normal = new THREE.Vector3();
                            mappedTrianglesArray[i].triangle.getNormal(mappedTrianglesArray[i].normal);

                            // get triangle's color
                            const color = child.material.color;
                            mappedTrianglesArray[i].color = color;


                            const emission = new THREE.Color(
                                child.material.emissive.r * child.material.emissiveIntensity,
                                child.material.emissive.g * child.material.emissiveIntensity,
                                child.material.emissive.b * child.material.emissiveIntensity
                            )
                            mappedTrianglesArray[i].emission = emission

                            mappedTrianglesArray[i].ior = child.material.ior || 1.5;
                            mappedTrianglesArray[i].metallic = child.material.metalness || 0.0;
                            mappedTrianglesArray[i].roughness = (child.material.roughness < 0.03 ? 0.03 : child.material.roughness);
                            mappedTrianglesArray[i].specular = child.material.specularIntensity || 0.0;
                            mappedTrianglesArray[i].transmission = child.material._transmission || 0.0;


                        }

                        trianglesArray.push(...mappedTrianglesArray)

                    }
                });

                resolve(trianglesArray);
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
