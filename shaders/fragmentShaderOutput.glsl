// Simple fragment shader
#version 300 es

#ifdef GL_ES
precision highp float;
#endif

in vec2 texCoord;
uniform sampler2D u_texture;
out vec4 outColor;

vec3 toneMapACES(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}


void main() {

    vec3 inputColor = texture(u_texture, texCoord).rgb;

    // Reinhard tone mapping
    // vec3 toneMappedColor = inputColor / (inputColor + vec3(1.0));

    // ACES tone mapping
    // vec3 toneMappedColor = toneMapACES(inputColor);

    // vec3 gammaCorrectedColor = pow(toneMappedColor, vec3(1.0 / 2.2));
    ///////////////

    vec3 gammaCorrectedColor = pow(inputColor, vec3(1.0 / 2.2));

    outColor = vec4(gammaCorrectedColor, 1.0);

    // outColor = texture(u_texture, texCoord);
    // outColor = vec4(0.5);
}

