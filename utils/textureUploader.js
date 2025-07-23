export default function uploadTexture(gl, program, data, name, index, channels, type, format) {

    const { width, height } = calculateRGBTextureDimensions(gl, data, channels);
    // Create a texture.
    var texture = gl.createTexture();

    // Bind the texture to the correct texture unit
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D,
        0,
        type,
        width,
        height,
        0,
        format,
        gl.FLOAT,
        new Float32Array(data));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    var textureLocation = gl.getUniformLocation(program, name);

    gl.uniform1i(textureLocation, index);

}

function calculateRGBTextureDimensions(gl, data, channels) {
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)// / 2;
    const texelCount = Math.ceil(data.length / channels);
    const width = Math.min(maxTextureSize, texelCount);
    const height = Math.ceil(texelCount / maxTextureSize);

    const neededLength = width * height * channels;
    console.log("🌸 ~ calculateRGBTextureDimensions ~ neededLength:", neededLength)
    if (data.length < neededLength) {
        const additionalZeroes = new Array(neededLength - data.length).fill(0.0);
        data.push(...additionalZeroes);
    }
    return { width, height };
}
