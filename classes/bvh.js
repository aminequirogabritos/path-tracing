
import BVHNode from "./bvhNode";
import * as THREE from 'three';

class BVH {

    constructor(coordinates, trianglesIndices) {

        this.eytzingerArray = [];

        console.log(coordinates);
        console.log(trianglesIndices);

        let trianglesArray = [];

        for (let i = 0; i < coordinates.length / 9; i++) {

            const newTriangle = {
                triangle: new THREE.Triangle(
                    new THREE.Vector3(
                        coordinates[9 * i + 0],
                        coordinates[9 * i + 1],
                        coordinates[9 * i + 2]
                    ),
                    new THREE.Vector3(
                        coordinates[9 * i + 3],
                        coordinates[9 * i + 4],
                        coordinates[9 * i + 5]
                    ),
                    new THREE.Vector3(
                        coordinates[9 * i + 6],
                        coordinates[9 * i + 7],
                        coordinates[9 * i + 8]
                    ),
                ),
                triangleIndex: i,
            };
            // console.log("🚀 ~ BVH ~ constructor ~ newTriangle:", newTriangle.triangle.a)
            // console.log("🚀 ~ BVH ~ constructor ~ newTriangle:", newTriangle.triangle.b)
            // console.log("🚀 ~ BVH ~ constructor ~ newTriangle:", newTriangle.triangle.c)
            // console.log("🚀 ~ BVH ~ constructor ~ newTriangle:", newTriangle.triangleIndex)

            trianglesArray.push(newTriangle)
        };

        // console.log("🚀 ~ BVH ~ constructor ~ trianglesArray:", trianglesArray)

        const triangleCount = trianglesArray.length;

        // create an array with leaf nodes that contains those triangles

        let nodesArray = [];

        trianglesArray.forEach(triangle => {
            const boundingBox = new THREE.Box3().setFromPoints([triangle.triangle.a, triangle.triangle.b, triangle.triangle.c]);
            // console.log("🎄🎄🎄CREATE NEW LEAF NODE")
            // console.log("🚀 ~ BVH ~ constructor ~ triangle:", triangle)

            nodesArray.push(
                new BVHNode(
                    triangle.triangleIndex,
                    boundingBox,
                    null,
                    null,
                    triangle.triangleIndex
                )
            )
        });

        // console.log("🚀 ~ BVH ~ constructor ~ nodesArray:", nodesArray)

        let newIndex = triangleCount;
        // Step 3.2: Perform clustering

        let treeArray = [];


        // Step 3.2.2 pair all non leaf nodes
        console.log("---------Step 3.2.2 pair all non leaf nodes---------")
        while (nodesArray.length > 1) {
            // console.log("🧧🧧🧧🧧🧧🧧🧧🧧🧧 ~ BVH ~ constructor ~ nodesArray.length: " + nodesArray.length + "🧧🧧🧧🧧🧧🧧🧧🧧🧧🧧🧧🧧")
            let closestPair = findClosestPair(nodesArray);
            // if (!closestPair[1] || !closestPair[0]) break;
            // console.log("🚀 ~ BVH ~ constructor ~ closestPair:", closestPair)
            let leftNode = nodesArray[closestPair[0]];
            // console.log("🚀 ~ BVH ~ constructor ~ leftNode:", leftNode)
            let rightNode = nodesArray[closestPair[1]];
            // console.log("🚀 ~ BVH ~ constructor ~ rightNode:", rightNode)

            treeArray.push(leftNode);
            treeArray.push(rightNode);
            // Remove the paired nodes from the list
            nodesArray = nodesArray.filter(node => node !== leftNode && node !== rightNode);

            // Assuming leftNode.boundingBox and rightNode.boundingBox are THREE.Box3 instances
            let combinedBoundingBox = new THREE.Box3();
            combinedBoundingBox.copy(leftNode.boundingBox).union(rightNode.boundingBox);

            // console.log("🚀🎨🖼🖼🎭🎪🎢 ~ BVH ~ constructor ~ combinedBoundingBox:", combinedBoundingBox)

            // console.log("🎟🎟🎟CREATE NEW INNER NODE")
            let parentNode = new BVHNode(
                newIndex, // Assign a unique index for the new parent node
                combinedBoundingBox,
                leftNode,
                rightNode,
                null,

            );
            // console.log("🚀 ~ BVH ~ constructor ~ parentNode:", parentNode)

            nodesArray.push(parentNode);
            // console.log("🚀 ~ BVH ~ constructor ~ nodesArray.length:", nodesArray.length)
            newIndex++;
        }

        // console.log("🚀 ~ BVH ~ constructor ~ treeArray:", treeArray)
        // // console.log("🚀 ~ BVH ~ constructor ~ nodesArray:", nodesArray)

        treeArray.push(nodesArray[0]);

        this.rootNode = nodesArray[0];
        // console.log("🚀 ~ BVH ~ constructor ~ this.rootNode:", this.rootNode)

        
        this.planarizeEytzinger(this.rootNode, 0, 0);

        console.log(this.eytzingerArray)

    };

    planarizeEytzinger(node, index, counter) {
        // console.log("🚀 ~ BVH ~ planarizeEytzinger ~ index:", index)
        // console.log("🚀 ~ BVH ~ planarizeEytzinger ~ counter:", counter)
        if (!node) return;

        // Ensure the array is large enough
        if (index >= this.eytzingerArray.length) {
            this.eytzingerArray.length = index + 1;
        }

        // Place the current node at the Eytzinger index
        this.eytzingerArray[index] = {
            boundingBox: node.boundingBox,
            centroid: node.centroid,
            triangleIndex: node.triangleIndex
        };

        // Recursively place the left and right children
        this.planarizeEytzinger(node.leftChild, 2 * index + 1, counter + 1);
        this.planarizeEytzinger(node.rightChild, 2 * index + 2, counter + 1);
    }



}




function findClosestPair(nodesArray) {
    let minDistance = Infinity;
    let closestPair = [null, null];

    for (let i = 0; i < nodesArray.length; i++) {
        for (let j = i + 1; j < nodesArray.length; j++) {
            const distance = nodesArray[i].centroid.distanceTo(nodesArray[j].centroid);
            if (distance < minDistance) {
                // console.log("found new closest pair")
                // console.log("🚀 ~ findClosestPair ~ minDistance:", minDistance)
                // console.log("🚀 ~ findClosestPair ~ nodesArray[i]:", nodesArray[i])
                // console.log("🚀 ~ findClosestPair ~ nodesArray[j]:", nodesArray[j])
                minDistance = distance;
                closestPair = [i, j];
            }
        }
    }
    // console.log("🚀 ~ findClosestPair ~ closestPair:", closestPair)

    return closestPair;
}

function findClosestLeafPair(nodes) {
    let minDistance = Infinity;
    let closestPair = [null, null];

    // Filter out non-leaf nodes
    let leafNodes = nodes.filter(node => node.isLeaf);

    for (let i = 0; i < leafNodes.length; i++) {
        for (let j = i + 1; j < leafNodes.length; j++) {
            let distance = leafNodes[i].centroid.distanceTo(leafNodes[j].centroid);
            if (distance < minDistance) {
                minDistance = distance;
                closestPair = [leafNodes[i], leafNodes[j]];
            }
        }
    }

    return closestPair;
}


export default BVH;