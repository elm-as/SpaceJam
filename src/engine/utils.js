export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function rand(a, b) {
    return a + Math.random() * (b - a);
}

export function gauss(m, s) {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s + m;
}
