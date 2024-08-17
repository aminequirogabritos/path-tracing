import * as THREE from 'three';



function calculateCentroid(triangle) {
    // Calculate the centroid of the triangle
    const x = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
    const y = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
    const z = (triangle.a.z + triangle.b.z + triangle.c.z) / 3;
    return new THREE.Vector3(x, y, z);
}

function calculateDistanceToCamera(centroid, cameraPosition) {
    // Calculate the distance between the centroid and the camera
    return centroid.distanceTo(cameraPosition);
}

export function sortTrianglesByDistanceToCamera(triangles, cameraPosition) {
    // Calculate the distance of each triangle from the camera and sort them
    
    triangles.forEach(triangle => {
        triangle.centroid = calculateCentroid(triangle.triangle);
        triangle.distanceToCamera = calculateDistanceToCamera(triangle.centroid, cameraPosition);
    });

    // Sort triangles based on the precomputed distance
    triangles.sort((a, b) => a.distanceToCamera - b.distanceToCamera);

    // Clean up, remove centroid and distance from each triangle after sorting if not needed
    triangles.forEach(triangle => {
        delete triangle.centroid;
        delete triangle.distanceToCamera;
    });

    return triangles;
}

export function sortTrianglesByBVHInorderIndices(trianglesArray, planarizedBVH) {
    let onlyLeafNodesArray = planarizedBVH.filter(node => node.triangleIndicesArray[0] >= 0);
    let orderedIndicesArray = [];
    onlyLeafNodesArray.forEach(node => {
        orderedIndicesArray.push(...node.triangleIndicesArray);
    });
    let reorderedTrianglesArray = orderedIndicesArray.map(index => trianglesArray[index]);
    let indexCounter = 0;
    planarizedBVH.forEach(node => {
        if (!(node.triangleIndicesArray.length == 1 && node.triangleIndicesArray[0] < 0)){
            let newIndicesArray = [];
            node.triangleIndicesArray.forEach(triangleIndex => {
                newIndicesArray.push(indexCounter++);
            })
            node.triangleIndicesArray = newIndicesArray;
        }
    })
    return reorderedTrianglesArray
    
    
}

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}