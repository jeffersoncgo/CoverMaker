const _searchCache = new WeakMap();


const GetValueFromPath = (path, obj) => path.split('.').reduce((o, i) => o?.[i], obj);
// Keys that would let parsed JSON write into Object.prototype
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MakeObjFromPath = (path, value, obj, spliter = '.') => {
  let paths = path.split(spliter);
  let last = paths.pop();
  if (UNSAFE_OBJECT_KEYS.has(last) || paths.some(p => UNSAFE_OBJECT_KEYS.has(p))) return obj;
  let lastObj = paths.reduce((o, i) => o[i] = o[i] || {}, obj);
  lastObj[last] = value;
  return obj;
}

function getFlattenedCache(dataArray) {
  if (_searchCache.has(dataArray)) {
    return _searchCache.get(dataArray).flattened;
  }

  const flattened = dataArray.map(obj => flattenValues(obj));
  _searchCache.set(dataArray, { flattened, results: new Map() });
  return flattened;
}

function flattenValues(obj, prefix = '') {
  let values = [];
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      values = values.concat(flattenValues(value, currentPath));
    } else {
      values.push({ path: currentPath, value: String(value) });
    }
  }
  return values;
}

function flattenKeys(obj, path = '') {
  return Object.entries(obj).flatMap(([key, val]) => {
    const fullPath = path ? `${path}.${key}` : key;
    return (val && typeof val === 'object' && !Array.isArray(val))
      ? flattenKeys(val, fullPath)
      : [fullPath];
  });
}

// Removes null, undefined, '' and empty arrays/objects (also the ones that become empty after cleaning).
// Cleans in place and returns the same root object.
function cleanObject(obj) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === null || value === undefined || value === '') {
      delete obj[key];
    } else if (typeof value === 'object') {
      cleanObject(value);
      if (Object.keys(value).length === 0) delete obj[key];
    }
  }
  if (Array.isArray(obj)) {
    const kept = obj.filter((_, i) => i in obj);
    obj.length = 0;
    obj.push(...kept);
  }
  return obj;
}

function mergeObjects(obj1, obj2, seen = new WeakSet()) {
  if (seen.has(obj2)) return obj1;
  seen.add(obj2);

  for (let key in obj2) {
    if (UNSAFE_OBJECT_KEYS.has(key)) continue;
    if (typeof obj2[key] === 'object' && obj2[key] !== null && !Array.isArray(obj2[key])) {
      if (!obj1[key]) obj1[key] = {};
      obj1[key] = mergeObjects(obj1[key], obj2[key], seen);
    } else {
      obj1[key] = obj2[key];
    }
  }
  return obj1;
}

/**
 * Optimized search with query and field-level memoization.
 * @param {Array<Object>} dataArray
 * @param {string} query
 * @param {Array<string>|null} fields
 * @returns {Array<Object>}
 */
function searchInArray(dataArray, query, fields = null) {
  const flattened = getFlattenedCache(dataArray);
  const cache = _searchCache.get(dataArray);

  const normalizedQuery = query.toLowerCase();

  const key = JSON.stringify({ query: normalizedQuery, fields });

  if (cache.results.has(key))
    return cache.results.get(key);

  const result = dataArray.filter((data, index) => {
    return flattened[index].some(({ path, value }) => {
      const inFields = !fields || fields.includes(path);
      return inFields && value.toLowerCase().includes(normalizedQuery);
    });
  });

  cache.results.set(key, result);
  return result;
}

function ArraySort(array = [], ignoreCase = false) {
  return array.sort((a, b) => {
    if (ignoreCase) {
      a = String(a).toLowerCase();
      b = String(b).toLowerCase();
    }
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}

function ArrayCaseEachWord(arr) {
  return arr.map(str => {
    if (typeof str !== 'string') return str;
    return str.eachWordUp();
  });
}

function ArrayNormalize(arr) {
  return arr.map(item => {
    if (typeof item !== 'string' || item.length === 0) return item;
    return item.firstUpCase()
  });
}


JCGWeb.Functions.addEvent = function (event = "onDone", callback) {
  this.events[event].push(callback);
}

JCGWeb.Functions.deleteEvent = function (event = "onDone", callback) { 
  const index = this.events[event].indexOf(callback);
  if (index !== -1) {
    this.events[event].splice(index, 1);
  }
}

JCGWeb.Functions.clearEvents = function (event = "onDone") {
  this.events[event] = [];
}

JCGWeb.Functions.execEvents = function (event, ...params) {
  this.events[event].forEach(callback => {
    try {
      callback(...params);
    } catch (error) {
      console.error(error);
    }
  });
}

if (typeof module != 'undefined') module.exports = {
  GetValueFromPath,
  MakeObjFromPath,
  cleanObject,
  mergeObjects,
  flattenKeys,
  flattenValues,
  searchInArray,
  ArraySort,
  ArrayCaseEachWord,
  ArrayNormalize,
};