import Triangle from "../classes/triangle";


import * as THREE from "three";


export function mapTexturizedArraysToTriangles(coordinates) {
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

    return trianglesArray;
};

export function mapTrianglesArrayToTexturizedArray(trianglesArray) {
    const emissionConstant = 1;
    let coordinates = [];
    let normals = [];
    let colors = [];
    let emissions = [];
    let lightIndices = [];
    let iors = [];
    let metallics = [];
    let roughnesses = [];
    let speculars = [];
    let transmissions = [];

    trianglesArray.forEach((triangle, triangleIndex) => {
/* 
        if (triangle.metallic > 0)
            console.log("🚀 ~ trianglesArray.forEach ~ triangle:", triangle) */


        coordinates.push(...[
            triangle.triangle.a.x, triangle.triangle.a.y, triangle.triangle.a.z,
            triangle.triangle.b.x, triangle.triangle.b.y, triangle.triangle.b.z,
            triangle.triangle.c.x, triangle.triangle.c.y, triangle.triangle.c.z,
        ]);
        normals.push(...[triangle.normal.x, triangle.normal.y, triangle.normal.z]);

        // material properties
        colors.push(...[triangle.color.r, triangle.color.g, triangle.color.b]);
        emissions.push(...[triangle.emission.r * emissionConstant, triangle.emission.g * emissionConstant, triangle.emission.b * emissionConstant]);
        if (triangle.emission.r > 0 || triangle.emission.g > 0 || triangle.emission.b > 0) {
            lightIndices.push(...[triangleIndex, triangleIndex, triangleIndex]);
        }
        iors.push(...[triangle.ior, triangle.ior, triangle.ior]);
        metallics.push(...[triangle.metallic, triangle.metallic, triangle.metallic]);
        roughnesses.push(...[triangle.roughness, triangle.roughness, triangle.roughness]);
        speculars.push(...[triangle.specular, triangle.specular, triangle.specular]);
        transmissions.push(...[triangle.transmission, triangle.transmission, triangle.transmission]);


    });


    // console.log("🚀 ~ mapTrianglesArrayToTexturizedArray ~ coordinates:", coordinates)


    return {
        coordinates,
        normals,
        colors,
        emissions,
        lightIndices,
        iors,
        metallics,
        roughnesses,
        speculars,
        transmissions,
    }
}


