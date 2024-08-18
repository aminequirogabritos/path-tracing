
import BVHNode from "./bvhNode";
import * as THREE from 'three';
import { mapTexturizedArraysToTriangles } from "../utils/triangleMapper";

class BVH {
    static epsilon = 0.5;
    constructor(trianglesArray) {
        this.eytzingerArray = [];
        this.preorderArray = [];
        this.nodeCount = 0;

        const triangleCount = trianglesArray.length;

        // create an array with leaf nodes that contains those triangles

        let leafNodesArray = [];

        trianglesArray.forEach((triangle, triangleIndex) => {
            let boundingBox = new THREE.Box3().setFromPoints([triangle.triangle.a, triangle.triangle.b, triangle.triangle.c]);

            leafNodesArray.push(
                new BVHNode(
                    boundingBox,
                    null,
                    null,
                    [triangle.triangle],
                    [triangleIndex]
                )
            )
        });

        let newIndex = triangleCount;
        // Step 3.2: Perform clustering

        let treeArray = [];



        let root = this.buildBVH(leafNodesArray, 0, 5);
        console.log("🚀 ~ BVH ~ constructor ~ this.nodeCount:", this.nodeCount)

        this.addMissLinks(root);

        this.fillPreorderArray(root);

        this.updateMissLinks();
        console.log("🚀 ~ BVH ~ constructor ~ this.preorderArray:", this.preorderArray)

        // this.planarizeEytzinger(root, 0, 0);

        // this.planarizePreorder(root, 0);

        // this.nodeCount = this.eytzingerArray.length;

        /* 
                for (let i = 0; i < this.nodeCount; i++) {
                    if (!(this.eytzingerArray.hasOwnProperty(i))) {
                        this.eytzingerArray[i] = {
                            boundingBox: new THREE.Box3(),
                            triangleIndicesArray: [-1],
                        };
                    }
                } */

        this.inorderTrianglesIndicesArray = this.addDoublePointer();
        console.log("🚀 ~ BVH ~ constructor ~ this.inorderTrianglesIndicesArray:", this.inorderTrianglesIndicesArray)



    };


    buildBVH(triangles, depth, N = 1) {  // Adding parameter N with a default value of 1
        if (triangles.length <= N) {  // If triangles count is less than or equal to N
            // Create a leaf node containing all the triangles
            const boundingBox = new THREE.Box3();
            let trianglesArray = [];
            let triangleIndicesArray = []
            triangles.forEach(tri => {
                boundingBox.union(tri.boundingBox)
                trianglesArray.push(...tri.trianglesArray);
                triangleIndicesArray.push(...tri.triangleIndicesArray);
            });  // Compute bounding box for all triangles

            this.nodeCount++;
            return new BVHNode(boundingBox, null, null, trianglesArray, triangleIndicesArray);
        } else if (triangles.length === 0) {
            return null;
        }

        // Choose axis to split
        const axis = depth % 3; // cycle between x, y, z axes
        triangles.sort((a, b) => a.centroid.getComponent(axis) - b.centroid.getComponent(axis));

        const mid = Math.floor(triangles.length / 2);
        const leftTriangles = triangles.slice(0, mid);
        const rightTriangles = triangles.slice(mid);

        // Recursively build the left and right child nodes
        const leftChild = this.buildBVH(leftTriangles, depth + 1, N);  // Pass N to the recursive call
        const rightChild = this.buildBVH(rightTriangles, depth + 1, N);  // Pass N to the recursive call

        // Create internal node
        let boundingBox = new THREE.Box3();
        if (leftChild && rightChild) {
            boundingBox.copy(leftChild.boundingBox).union(rightChild.boundingBox);
        } else if (leftChild) {
            boundingBox.copy(leftChild.boundingBox);
        } else if (rightChild) {
            boundingBox.copy(rightChild.boundingBox);
        } else {
            return null; // This should not normally happen, but just in case
        }

        this.nodeCount++;
        return new BVHNode(boundingBox, leftChild, rightChild, null, [-2]);
    }


    planarizeEytzinger(node, index) {
        if (!node) return -1; // Return a miss link placeholder

        // Ensure the array is large enough
        if (index >= this.eytzingerArray.length) {
            this.eytzingerArray.length = Math.max(this.eytzingerArray.length, index + 1);
        }

        // Fill the current index with the node or a placeholder if the node is null
        if (node) {
            this.eytzingerArray[index] = {
                boundingBox: node.boundingBox,
                triangleIndicesArray: node.triangleIndicesArray,
            };
        } else {
            // Use a placeholder or null for missing nodes
            this.eytzingerArray[index] = {
                boundingBox: new THREE.Box3(),
                triangleIndicesArray: [-1],
            };
            return;
        }

        // Recursively place the left and right children
        this.planarizeEytzinger(node.leftChild, 2 * index + 1);
        this.planarizeEytzinger(node.rightChild, 2 * index + 2);
    }

    fillPreorderArray(node) {
        if (!node) {
            return;
        }
        // Visit the root node
        this.preorderArray.push(node);
        // Traverse the left subtree
        this.fillPreorderArray(node.leftChild);
        // Traverse the right subtree
        this.fillPreorderArray(node.rightChild);
    }

    addMissLinks(root) {
        // if (root === null) return [];
        if (root === null) return;

        const queue = [{ node: root, parentMissLink: -1 }];

        while (queue.length > 0) {
            const { node, parentMissLink } = queue.shift();

            // Determine missLink for the current node
            if (node === root) {
                node.missLink = -1; // Root node has no missLink
            } else if (queue.length > 0 && queue[0].parentMissLink === parentMissLink) {
                node.missLink = queue[0].node.nodeId; // Right sibling exists
            } else {
                node.missLink = parentMissLink; // Use parent's missLink
            }

            // Enqueue left and right children with updated parentMissLink
            if (node.leftChild !== null) {
                queue.push({ node: node.leftChild, parentMissLink: node.rightChild ? node.rightChild.nodeId : -1 });
            }
            if (node.rightChild !== null) {
                queue.push({ node: node.rightChild, parentMissLink: parentMissLink });
            }
        }
    }
/* 
    planarizePreorder(node, index, parentIndex = -1, isLeftChild = false) {
        if (!node) return -1; // Return -1 for missing nodes

        // Store the current node information
        let currentNode = {
            ...node,
            hitLink: -1, // Placeholder for now
            missLink: -1 // Placeholder for now
        };

        // Add the current node to the array
        this.preorderArray[index] = currentNode;

        // Calculate the hit link: the next node in the preorder traversal
        let nextIndex = index + 1;
        currentNode.hitLink = nextIndex < this.nodeCount ? nextIndex : -1;

        // Traverse the left child
        let leftChildIndex = nextIndex;
        if (node.leftChild) {
            nextIndex = this.planarizePreorder(node.leftChild, leftChildIndex, index, true);
        }

        // Traverse the right child
        let rightChildIndex = nextIndex;
        if (node.rightChild) {
            nextIndex = this.planarizePreorder(node.rightChild, rightChildIndex, index, false);
        }

        // Set the miss link based on the node type
        if (!node.leftChild && !node.rightChild) {
            // Leaf node: miss link is the same as hit link
            currentNode.missLink = currentNode.hitLink;
        } else if (isLeftChild) {
            // Internal left child: miss link is the sibling node (right child of the parent)
            currentNode.missLink = rightChildIndex < this.preorderArray.length ? rightChildIndex : -1;
        } else if (parentIndex !== -1) {
            // Internal right child: miss link is the parent's sibling node (miss link of the parent)
            currentNode.missLink = this.preorderArray[parentIndex].missLink;
        }

        return nextIndex; // Return the next index in the preorder traversal
    } */

    updateMissLinks() {
        this.preorderArray.forEach((currentNode, currentNodeIndex) => {
            const currentNodeMissLinkNodeId = currentNode.missLink;
            let missLink = this.preorderArray.map(node => node.nodeId).indexOf(currentNodeMissLinkNodeId)
            currentNode.missLink = missLink;
        })
    }

    addDoublePointer() {

        // generar arreglo de punteros (indices) a arreglo original de triangulos
        let onlyLeafNodesInorderTriangleIndicesArrays = this.preorderArray.filter(node => node.triangleIndicesArray[0] >= 0);
        let onlyLeafNodesFirstIndexArray = this.preorderArray.filter(node => node.triangleIndicesArray[0] >= 0).map(x => x.triangleIndicesArray[0]);
        let inorderTrianglesIndicesArray = [];
        onlyLeafNodesInorderTriangleIndicesArrays.forEach(node => {
            inorderTrianglesIndicesArray.push(...node.triangleIndicesArray);
        });

        // agregar a preorderArray dos campos:
        // - indice de donde esta ubicado el primer indice de trianglesIndicesArrray dentro del arreglo inorderTrianglesIndicesArray
        // - cantidad de indices de triangleIndicesArray
        this.preorderArray.forEach(node => {
            if (node.triangleIndicesArray[0] != -2) {// si no es un nodo interno o hoja vacia
                // agregar esos campos al nodo
                node.firstIndexInInorderTriangleIndicesArray = inorderTrianglesIndicesArray.indexOf(node.triangleIndicesArray[0]);
                
                node.triangleCount = node.triangleIndicesArray.length;
            } else {
                node.firstIndexInInorderTriangleIndicesArray = -1;
                
                node.triangleCount = 0;
            }
        })

        return inorderTrianglesIndicesArray;

    }

    convertToTexturizableArrays() {
        let nodesBoundingBoxesMins = [];
        let nodesBoundingBoxesMaxs = [];
        let nodesTrianglesIndices = [];
        let nodesTrianglesCount = [];
        let nodesInorderTrianglesIndices = [];
        let nodesMissLinkIndices = [];

        this.preorderArray.forEach((node, i) => {
        // console.log("🚀 ~ BVH ~ this.preorderArray.forEach ~ node:", node)

            nodesBoundingBoxesMins.push(...[node.boundingBox.min.x, node.boundingBox.min.y, node.boundingBox.min.z]);
            nodesBoundingBoxesMaxs.push(...[node.boundingBox.max.x, node.boundingBox.max.y, node.boundingBox.max.z]);
            nodesMissLinkIndices.push(...[node.missLink, node.missLink, node.missLink]);
            if (node.triangleIndicesArray[0] >= 0)
                nodesInorderTrianglesIndices.push(...[node.firstIndexInInorderTriangleIndicesArray, node.firstIndexInInorderTriangleIndicesArray, node.firstIndexInInorderTriangleIndicesArray])
            else
                nodesInorderTrianglesIndices.push(...[node.triangleIndicesArray[0], node.triangleIndicesArray[0], node.triangleIndicesArray[0]]);

            if (node.triangleCount)
                nodesTrianglesCount.push(...[node.triangleCount, node.triangleCount, node.triangleCount]);
            else
                nodesTrianglesCount.push(...[0, 0, 0]);

        });

        return {
            nodesBoundingBoxesMins,
            nodesBoundingBoxesMaxs,
            nodesTrianglesIndices,
            nodesTrianglesCount,
            nodesInorderTrianglesIndices,
            nodesMissLinkIndices,
        }

    }
}




function findClosestPair(nodesArray) {
    let minDistance = Infinity;
    let closestPair = [null, null];

    for (let i = 0; i < nodesArray.length; i++) {
        for (let j = i + 1; j < nodesArray.length; j++) {
            const distance = nodesArray[i].centroid.distanceTo(nodesArray[j].centroid);
            if (distance < minDistance) {
                minDistance = distance;
                closestPair = [i, j];
            }
        }
    }

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



