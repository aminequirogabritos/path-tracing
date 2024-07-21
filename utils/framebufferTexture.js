import * as THREE from 'three';


class FramebufferTexture {
  constructor(gl) {
    this.gl = gl;
    this.framebuffers = [];
    this.textures = [];
    this.textureIndices = [];
    this.textureIndex = 0; // Initialize the texture index
  }

  createFramebuffer() {
    const gl = this.gl;
    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    return framebuffer;
  }

  createTexture() {
    const gl = this.gl;
    let texture = gl.createTexture();
    this.textureIndex = FramebufferTexture.getTextureIndexAndIncrease();
    gl.activeTexture(gl.TEXTURE0 + this.textureIndex);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete');
    }

    return texture;
  }

  static getTextureIndexAndIncrease() {
    if (!this.textureIndex) {
      this.textureIndex = 0;
    }
    return this.textureIndex++;
  }
}


/* 
// Create framebuffer and texture
export function createFramebufferAndTexture(gl, width, height) {
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  let texture = gl.createTexture();
  let textureIndex = getTextureIndexAndIncrease();
  gl.activeTexture(gl.TEXTURE0 + textureIndex);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('Framebuffer is not complete');
  }

  framebuffers.push(framebuffer);
  textures.push(texture);
  textureIndices.push(textureIndex);
}

createFramebufferAndTexture(gl, width, height);
createFramebufferAndTexture(gl, width, height); */