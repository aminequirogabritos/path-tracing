import WebGLContextSingleton from './webGLContextSingleton.js';

export default class Uniform {
    constructor(name = '', value = 0, program = null, type = null) {
        this.name = name;
        this.value = value;
        this.program = program;
        this.type = type;
    }

    upload() {
        const gl = WebGLContextSingleton.getInstance().gl;

        if (!gl) {
            console.error('WebGL 2 not supported');
        }
        switch (this.type) {
            case type1f:
                gl.uniform1f(gl.getUniformLocation(this.program, this.name), this.value[0]);
                break;
            case type2f:
                gl.uniform2f(gl.getUniformLocation(this.program, this.name), this.value[0], this.value[1]);
                break;
            case type3f:
                gl.uniform3f(gl.getUniformLocation(this.program, this.name), this.value[0], this.value[1], this.value[2]);
                break;
            case type1i:
                gl.uniform1i(gl.getUniformLocation(this.program, this.name), this.value[0]);
                break;
            default:
                throw new Error();
        }
    }
}