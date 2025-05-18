const iotModuleFunctions = {
  computeFuelValue: (fuelRaw, tbl) => {
    if (typeof fuelRaw !== "number" || !Array.isArray(tbl)) return null;

    let selected = null;

    for (let i = 0; i < tbl.length; i++) {
      if (tbl[i].x <= fuelRaw) {
        selected = tbl[i];
      } else {
        break;
      }
    }

    if (!selected) return null;

    const value = selected.a * fuelRaw + selected.b;
    return Math.round(value * 100) / 100; // arrondi à 2 décimales
  },

  getSensorByP: (sensObject, pValue) => {
    if (!sensObject || typeof sensObject !== "object") return null;

    for (const key in sensObject) {
      if (sensObject[key]?.p === pValue) {
        return sensObject[key];
      }
    }

    return null;
  },
};

module.exports = iotModuleFunctions;
