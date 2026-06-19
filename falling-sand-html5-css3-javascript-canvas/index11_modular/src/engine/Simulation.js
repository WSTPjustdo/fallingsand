export class ParticleBuffer {
  constructor(length, materialIds, materialTypes) {
    this.materialIds = materialIds;
    this.materialTypes = materialTypes;
    this.refs = [];
    this.resize(length || 0);
  }

  get length() {
    return this.typeId.length;
  }

  resize(length) {
    this.typeId = new Uint8Array(length);
    this.updated = new Uint32Array(length);
    this.age = new Uint32Array(length);
    this.seed = new Float32Array(length);
    this.life = new Float32Array(length);
    this.maxLife = new Float32Array(length);
    this.temp = new Float32Array(length);
    this.maxTemp = new Float32Array(length);
    this.refs = new Array(length);
  }

  get(index) {
    if (index < 0 || index >= this.length || this.typeId[index] === 0) {
      return null;
    }
    if (!this.refs[index]) {
      this.refs[index] = this.createRef(index);
    }
    return this.refs[index];
  }

  set(index, particle) {
    if (index < 0 || index >= this.length) {
      return;
    }
    if (!particle) {
      this.clear(index);
      return;
    }
    const id = this.materialIds[particle.type] || 0;
    if (!id) {
      this.clear(index);
      return;
    }
    this.typeId[index] = id;
    this.updated[index] = Number.isFinite(particle.updated) ? particle.updated >>> 0 : 0;
    this.age[index] = Number.isFinite(particle.age) ? Math.max(0, Math.floor(particle.age)) : 0;
    this.seed[index] = Number.isFinite(particle.seed) ? particle.seed : Math.random();
    this.life[index] = typeof particle.life === "number" ? particle.life : Infinity;
    this.maxLife[index] = typeof particle.maxLife === "number" ? particle.maxLife : 1;
    this.temp[index] = typeof particle.temp === "number" ? particle.temp : 0;
    this.maxTemp[index] = typeof particle.maxTemp === "number" ? particle.maxTemp : 1;
  }

  clear(index) {
    if (index < 0 || index >= this.length) {
      return;
    }
    this.typeId[index] = 0;
  }

  clearAll() {
    this.typeId.fill(0);
  }

  move(fromIndex, toIndex) {
    if (fromIndex === toIndex || this.typeId[fromIndex] === 0) {
      return;
    }
    this.copyCell(fromIndex, toIndex);
    this.clear(fromIndex);
  }

  swap(aIndex, bIndex) {
    if (aIndex === bIndex) {
      return;
    }
    const typeId = this.typeId[aIndex];
    const updated = this.updated[aIndex];
    const age = this.age[aIndex];
    const seed = this.seed[aIndex];
    const life = this.life[aIndex];
    const maxLife = this.maxLife[aIndex];
    const temp = this.temp[aIndex];
    const maxTemp = this.maxTemp[aIndex];

    this.copyCell(bIndex, aIndex);
    this.typeId[bIndex] = typeId;
    this.updated[bIndex] = updated;
    this.age[bIndex] = age;
    this.seed[bIndex] = seed;
    this.life[bIndex] = life;
    this.maxLife[bIndex] = maxLife;
    this.temp[bIndex] = temp;
    this.maxTemp[bIndex] = maxTemp;
  }

  copyCell(fromIndex, toIndex) {
    this.typeId[toIndex] = this.typeId[fromIndex];
    this.updated[toIndex] = this.updated[fromIndex];
    this.age[toIndex] = this.age[fromIndex];
    this.seed[toIndex] = this.seed[fromIndex];
    this.life[toIndex] = this.life[fromIndex];
    this.maxLife[toIndex] = this.maxLife[fromIndex];
    this.temp[toIndex] = this.temp[fromIndex];
    this.maxTemp[toIndex] = this.maxTemp[fromIndex];
  }

  createRef(index) {
    const store = this;
    return {
      get type() {
        return store.materialTypes[store.typeId[index]];
      },
      set type(value) {
        store.typeId[index] = store.materialIds[value] || 0;
      },
      get updated() {
        return store.updated[index];
      },
      set updated(value) {
        store.updated[index] = value >>> 0;
      },
      get age() {
        return store.age[index];
      },
      set age(value) {
        store.age[index] = Math.max(0, Math.floor(value || 0));
      },
      get seed() {
        return store.seed[index];
      },
      set seed(value) {
        store.seed[index] = Number.isFinite(value) ? value : Math.random();
      },
      get life() {
        return store.life[index];
      },
      set life(value) {
        store.life[index] = typeof value === "number" ? value : Infinity;
      },
      get maxLife() {
        return store.maxLife[index];
      },
      set maxLife(value) {
        store.maxLife[index] = typeof value === "number" ? value : 1;
      },
      get temp() {
        return store.temp[index];
      },
      set temp(value) {
        store.temp[index] = typeof value === "number" ? value : 0;
      },
      get maxTemp() {
        return store.maxTemp[index];
      },
      set maxTemp(value) {
        store.maxTemp[index] = typeof value === "number" ? value : 1;
      }
    };
  }
}
