export const starVertexShader = `
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;
    attribute float aAccretion;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vAccretion;
    void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vAccretion = aAccretion;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (600.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 2.5, 32.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const starFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vAccretion;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = exp(-d * 5.0);
        float core = smoothstep(0.08, 0.0, d);
        vec3 accretionCol = vec3(1.0, 0.5, 0.1) * vAccretion * 3.0;
        vec3 col = vColor * glow * 1.5 + vec3(1.0) * core * 0.8 + accretionCol * glow;
        float a = glow * vAlpha * 0.9 + vAccretion * 0.5 + core * 0.4;
        gl_FragColor = vec4(col, a);
    }
`;

export const bhVertexShader = `
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;
    attribute float aFlash;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vFlash;
    void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vFlash = aFlash;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (800.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 15.0, 80.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const bhFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vFlash;
    uniform float uTime;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float eventHorizon = smoothstep(0.15, 0.12, d);
        float shadow = 1.0 - eventHorizon;
        float ringCenter = 0.22;
        float ringWidth = 0.03;
        float photonRing = exp(-pow((d - ringCenter) / ringWidth, 2.0));
        float angle = atan(c.y, c.x);
        float ringMod = 0.8 + 0.2 * sin(angle * 3.0 + uTime * 2.0);
        float accDisk = smoothstep(0.45, 0.18, d) * (0.5 + 0.5 * sin(angle * 2.0 + d * 12.0));
        accDisk *= (1.0 - eventHorizon);
        float flash = vFlash * exp(-d * 8.0) * smoothstep(0.0, 0.4, d);
        vec3 col = vec3(0.0);
        col += vec3(0.0) * shadow;
        col += vec3(1.0, 0.85, 0.4) * photonRing * ringMod * 1.2;
        col += vec3(1.0, 0.45, 0.1) * accDisk * 0.6;
        col += vec3(1.0, 0.9, 0.6) * flash * 2.0;
        col += vec3(1.0) * exp(-d * 30.0) * 0.3;
        float a = max(photonRing * ringMod, max(accDisk * 0.6, max(flash, exp(-d * 30.0) * 0.3)));
        a = max(a, 0.15 * (1.0 - eventHorizon));
        gl_FragColor = vec4(col, a);
    }
`;
