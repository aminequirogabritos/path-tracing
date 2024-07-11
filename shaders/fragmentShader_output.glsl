// Simple fragment shader
#version 300 es

#ifdef GL_ES
precision highp float;
#endif

in vec2 texCoord;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {
    outColor = texture(u_texture, texCoord);
    // outColor = vec4(0.5);
}
