export default class WebGLContextSingleton {
    constructor() {
        if (WebGLContextSingleton.instance) {
            return WebGLContextSingleton.instance;
        }

        this.canvas = document.getElementById('canvas');
        this.gl = this.canvas.getContext('webgl');

        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        WebGLContextSingleton.instance = this;
    }

    static getInstance() {
        if (!WebGLContextSingleton.instance) {
            WebGLContextSingleton.instance = new WebGLContextSingleton();
        }
        return WebGLContextSingleton.instance;
    }
}