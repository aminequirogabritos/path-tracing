
export default function mapTrianglesArrayToTexturizableArray(trianglesArray) {
    let coordinates = [];
    let normals = [];
    let colors = [];
    let emissions = [];
    let iors = [];
    let metallics = [];
    let roughnesses = [];
    let speculars = [];
    let transmissions = [];

    let lightIndices = [];

    trianglesArray.forEach((triangle, triangleIndex) => {

        coordinates.push(...[
            triangle.triangle.a.x, triangle.triangle.a.y, triangle.triangle.a.z,
            triangle.triangle.b.x, triangle.triangle.b.y, triangle.triangle.b.z,
            triangle.triangle.c.x, triangle.triangle.c.y, triangle.triangle.c.z,
        ]);
        normals.push(...[triangle.normal.x, triangle.normal.y, triangle.normal.z]);

        // material properties
        colors.push(...[triangle.color.r, triangle.color.g, triangle.color.b]);
        emissions.push(...[triangle.emission.r, triangle.emission.g, triangle.emission.b]);

        iors.push(triangle.ior);
        metallics.push(triangle.metallic);
        roughnesses.push(triangle.roughness);
        speculars.push(triangle.specular);
        transmissions.push(triangle.transmission);

        if (triangle.emission.r > 0 || triangle.emission.g > 0 || triangle.emission.b > 0) {
            lightIndices.push(triangleIndex);
        }

    });

    return {
        coordinates,
        normals,
        colors,
        emissions,
        iors,
        metallics,
        roughnesses,
        speculars,
        transmissions,
        lightIndices,
    }
}


