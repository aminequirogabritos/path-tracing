import * as THREE from 'three';
import TextureIndex from './textureIndex';

const BufferManager = (() => {

    let frameBuffers = [];
    let textures = [];
    let textureIndices = [];

    const createFramebufferAndTexture = (gl, width, height) => {
        let frameBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

        let texture = gl.createTexture();
        let textureIndex = TextureIndex.getNextTextureIndex();
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer is not complete');
        }

        frameBuffers.push(frameBuffer);
        textures.push(texture);
        textureIndices.push(textureIndex);
    };

    const getFrameBuffer = (frameNumber) => {
        return frameBuffers[frameNumber % 2];
    };

    const getTexture = (frameNumber) => {
        return textures[frameNumber % 2];
    };

    const getTextureIndex = (frameNumber) => {
        return textureIndices[frameNumber % 2];
    };


    return {
        createFramebufferAndTexture,
        getFrameBuffer,
        getTexture,
        getTextureIndex
    }

})();

export default BufferManager;