// Simple fragment shader
#version 300 es

#ifdef GL_ES
precision highp float;
#endif

in vec2 texCoord;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {

    vec3 inputColor = texture(u_texture, texCoord).rgb;
    vec3 gammaCorrectedColor = pow(inputColor, vec3(1.0 / 2.2));

    outColor = vec4(gammaCorrectedColor, 1.0);
    // outColor = texture(u_texture, texCoord);
    // outColor = vec4(0.5);
}
