

export default class UniformTypeEnum {
    // Private Fields
    static #_1F = 0;
    static #_2F = 1;
    static #_3F = 2;
    static #_1I = 3;

    // Accessors for "get" functions only (no "set" functions)
    static get type1f() { return this.#_1F; }
    static get type2f() { return this.#_2F; }
    static get type3f() { return this.#_3F; }
    static get type1i() { return this.#_1I; }
}