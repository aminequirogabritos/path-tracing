
const MAX_TEX_WIDTH = 4096;

export default function uploadTexture(gl, program, data, name, index) {
    // console.log("🚀 ~ uploadTexture ~ index:", index)

    const { width, height } = calculateRGBTextureDimensions(gl, data);
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

    // gl.bindTexture(gl.TEXTURE_2D, null);

    var textureLocation = gl.getUniformLocation(program, name);

    gl.uniform1i(textureLocation, index);

}

function calculateRGBTextureDimensions(gl, data) {
    // console.log("🚀 ~ calculateRGBTextureDimensions ~ data:", data)
    // console.log("🚀 ~ calculateRGBTextureDimensions ~ data:", data.length)
    // const maxTextureSize = MAX_TEX_WIDTH;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)// / 2;
    const rgbValuesCount = data.length / 3;
    const width = Math.min(maxTextureSize, rgbValuesCount);
    const height = Math.ceil(rgbValuesCount / maxTextureSize);

    const neededLength = width * height * 3;
    if (data.length < neededLength) {
        const additionalZeroes = new Array(neededLength - data.length).fill(0.0);
        data.push(...additionalZeroes);
    }
    return { width, height };
}
