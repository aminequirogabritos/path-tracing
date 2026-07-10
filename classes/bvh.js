
import BVHNode from "./bvhNode";
import * as THREE from 'three';

class BVH {

    constructor(trianglesArray) {
        this.preorderArray = [];
        this.nodeCount = 0;
        this.root = null;

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

        this.root = this.buildBVH(leafNodesArray, 0, 5);

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
            return new BVHNode(boundingBox, null, null, trianglesArray, triangleIndicesArray, depth);
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
        return new BVHNode(boundingBox, leftChild, rightChild, null, [-2], depth);
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

        const queue = [{
            node: root,
            parentMissLink: -1
        }];

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
                queue.push({
                    node: node.leftChild,
                    parentMissLink: node.rightChild ? node.rightChild.nodeId : -1
                });
            }
            if (node.rightChild !== null) {
                queue.push({
                    node: node.rightChild,
                    parentMissLink: parentMissLink
                });
            }
        }
    }

    updateMissLinks() {
        this.preorderArray.forEach((currentNode) => {
            const currentNodeMissLinkNodeId = currentNode.missLink;
            let missLink = this.preorderArray.map(node => node.nodeId).indexOf(currentNodeMissLinkNodeId)
            currentNode.missLink = missLink;
        })
    }

    addDoublePointer() {
        let inorderTrianglesIndicesArray = this.getInorderTrianglesIndicesArray();
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
    }

    getInorderTrianglesIndicesArray() {
        // generar arreglo de punteros (indices) a arreglo original de triangulos
        let onlyLeafNodesInorderTriangleIndicesArrays = this.preorderArray.filter(node => node.triangleIndicesArray[0] >= 0);

        let inorderTrianglesIndicesArray = [];

        onlyLeafNodesInorderTriangleIndicesArrays.forEach(node => {
            inorderTrianglesIndicesArray.push(...node.triangleIndicesArray);
        });
        return inorderTrianglesIndicesArray;
    }

    getTexturizableArrays() {
        let nodesBoundingBoxesMins = [];
        let nodesBoundingBoxesMaxs = [];
        let nodesTrianglesCount = [];
        let nodesFirstTriangleIndex = [];
        let nodesMissLinkIndices = [];


        this.addMissLinks(this.root);
        this.fillPreorderArray(this.root);
        this.updateMissLinks();
        this.addDoublePointer();
        let inorderTrianglesIndicesArray = this.getInorderTrianglesIndicesArray();

        this.preorderArray.forEach((node) => {

            nodesBoundingBoxesMins.push(...[node.boundingBox.min.x, node.boundingBox.min.y, node.boundingBox.min.z]);

            nodesBoundingBoxesMaxs.push(...[node.boundingBox.max.x, node.boundingBox.max.y, node.boundingBox.max.z]);

            nodesMissLinkIndices.push(node.missLink);

            if (node.triangleIndicesArray[0] >= 0)
                nodesFirstTriangleIndex.push(node.firstIndexInInorderTriangleIndicesArray)
            else
                nodesFirstTriangleIndex.push(node.triangleIndicesArray[0]);

            if (node.triangleCount)
                nodesTrianglesCount.push(node.triangleCount);
            else
                nodesTrianglesCount.push(0);

        });

        return {
            nodesBoundingBoxesMins,
            nodesBoundingBoxesMaxs,
            nodesTrianglesCount,
            nodesFirstTriangleIndex,
            nodesMissLinkIndices,
            inorderTrianglesIndicesArray
        }

    }
}

export default BVH;



