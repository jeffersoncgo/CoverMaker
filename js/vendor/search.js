class SearchEngine {
  constructor() {
    this._searchCache = new WeakMap();
  }

  flattenObject(obj, parentPath = '') {
    const result = [];

    const isPrimitive = (val) =>
      typeof val !== 'object' || val === null;

    const flatten = (val, currentPath) => {
      if (isPrimitive(val)) {
        result.push({ path: currentPath, value: String(val) });
      } else if (Array.isArray(val)) {
        val.forEach((item, idx) => flatten(item, `${currentPath}[${idx}]`));
      } else {
        for (const key in val) {
          if (val.hasOwnProperty(key)) {
            const newPath = currentPath ? `${currentPath}.${key}` : key;
            flatten(val[key], newPath);
          }
        }
      }
    };

    flatten(obj, parentPath);
    return result;
  }

  getFlattenedCache(dataArray) {
    if (!this._searchCache.has(dataArray)) {
      const flattened = dataArray.map(obj => this.flattenObject(obj));
      this._searchCache.set(dataArray, {
        flattened,
        results: new Map()
      });
    }
    return this._searchCache.get(dataArray).flattened;
  }

  search(dataArray, queryOrQueries, sort, isLaxQuery = false) {
    const flattened = this.getFlattenedCache(dataArray);
    const cache = this._searchCache.get(dataArray);

    const isComplex = Array.isArray(queryOrQueries) && typeof queryOrQueries[0] === 'object';
    const cacheKey = JSON.stringify({ queryOrQueries, sort, isLaxQuery });

    if (cache.results.has(cacheKey)) {
      return cache.results.get(cacheKey);
    }

    let results = isComplex
      ? this.searchComplex(flattened, dataArray, queryOrQueries, isLaxQuery)
      : this.searchSimple(flattened, dataArray, String(queryOrQueries).toLowerCase(), null, isLaxQuery);

    // For lax queries, the primary sort is always by the calculated score.
    if (isLaxQuery) {
      results.sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0));
    }

    // The user-defined sort is applied as a primary (for strict) or secondary (for lax) sort.
    if (sort) {
      results = this.sort(results, sort);
    }

    // Clean up the internal score property before returning the final results.
    if (isLaxQuery) {
      results.forEach(item => delete item._matchScore);
    }

    cache.results.set(cacheKey, results);
    return results;
  }

  sort(results, sort) {
    const getComparableValue = (val) => {
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string' || typeof val === 'number') return val;
      return val !== null && val !== undefined ? String(val) : null;
    };

    const compareValues = (aVal, bVal, order) => {
      if (aVal === bVal) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order * aVal.localeCompare(bVal);
      }
      return order * ((aVal > bVal) ? 1 : -1);
    };

    // Use slice() to sort a copy, preventing mutation of the array during tie-breaker sorts
    results.slice().sort((a, b) => {
      for (const s of sort) {
        const aVal = getComparableValue(this.getFieldValue(a, s.fields));
        const bVal = getComparableValue(this.getFieldValue(b, s.fields));
        const order = s.type === 'desc' ? -1 : 1;

        const cmp = compareValues(aVal, bVal, order);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    return results;
  }

  getFieldValue(obj, fields) {
    for (const field of fields) {
      let value = obj;
      const path = field.split('.');
      for (const p of path) {
        if (value === undefined || value === null) {
          value = undefined;
          break;
        }
        value = value[p];
      }
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  searchSimple(flattened, dataArray, normalizedQuery, fields, isLaxQuery = false) {
    if (!isLaxQuery) {
      return dataArray.filter((_, index) => {
        return flattened[index].some(({ path, value }) => {
          const inFields = !fields || fields.some(field => path.startsWith(field));
          return inFields && value.toLowerCase().includes(normalizedQuery);
        });
      });
    }

    // Lax mode: score hits and filter
    const results = [];
    dataArray.forEach((item, index) => {
      const flat = flattened[index];
      let score = 0;

      for (const { path, value } of flat) {
        const inFields = !fields || fields.some(f => path.startsWith(f));
        if (inFields && value.toLowerCase().includes(normalizedQuery)) {
          score++;
        }
      }

      if (score > 0) {
        // Create a copy to avoid mutating the original item
        const resultItem = { ...item, _matchScore: score };
        results.push(resultItem);
      }
    });

    return results;
  }

  searchComplex(flattened, dataArray, queryGroups, isLaxQuery = false) {
    const lower = (s) => String(s).toLowerCase();

    const checkStrictMatch = (flatItem, query) => {
      const fields = query.fields ?? [];
      const queries = query.queries;

      switch (query.operator) {
        case 'all':
          return queries.map(lower).every(q =>
            flatItem.some(({ path, value }) =>
              (!fields.length || fields.some(f => path.startsWith(f))) && lower(value).includes(q)
            )
          );
        case 'any':
          return queries.map(lower).some(q =>
            flatItem.some(({ path, value }) =>
              (!fields.length || fields.some(f => path.startsWith(f))) && lower(value).includes(q)
            )
          );
        case '!=': {
          const queryValues = new Set(queries.map(lower));
          return flatItem.some(({ path, value }) =>
            (!fields.length || fields.some(f => path.startsWith(f))) && !queryValues.has(lower(value))
          );
        }
        case '=':
        case '>':
        case '<':
        case '..': {
          const q1 = parseFloat(queries[0]);
          const q2 = query.operator === '..' ? parseFloat(queries[1]) : null;
          return flatItem.some(({ path, value }) => {
            if (!fields.length || fields.some(f => path.startsWith(f))) {
              const numVal = parseFloat(value);
              if (isNaN(numVal)) return false;
              switch (query.operator) {
                case '=': return numVal === q1;
                case '>': return numVal > q1;
                case '<': return numVal < q1;
                case '..': return numVal >= q1 && numVal <= q2;
              }
            }
            return false;
          });
        }
        default: return false;
      }
    };

    const calculateScore = (flatItem, query) => {
      const fields = query.fields ?? [];
      const queries = query.queries;
      let score = 0;

      switch (query.operator) {
        case 'all': {
          const allMatch = queries.map(lower).every(q =>
            flatItem.some(({ path, value }) =>
              (!fields.length || fields.some(f => path.startsWith(f))) && lower(value).includes(q)
            )
          );
          return allMatch ? queries.length : 0;
        }
        case 'any': {
          queries.map(lower).forEach(q => {
            if (flatItem.some(({ path, value }) =>
              (!fields.length || fields.some(f => path.startsWith(f))) && lower(value).includes(q))
            ) {
              score++;
            }
          });
          return score;
        }
        case '!=': {
          const queryValues = new Set(queries.map(lower));
          flatItem.forEach(({ path, value }) => {
            if ((!fields.length || fields.some(f => path.startsWith(f))) && !queryValues.has(lower(value))) {
              score++;
            }
          });
          return score;
        }
        case '=':
        case '>':
        case '<':
        case '..': {
          const q1 = parseFloat(queries[0]);
          const q2 = query.operator === '..' ? parseFloat(queries[1]) : null;
          flatItem.forEach(({ path, value }) => {
            if (!fields.length || fields.some(f => path.startsWith(f))) {
              const numVal = parseFloat(value);
              if (isNaN(numVal)) return;
              let isMatch = false;
              switch (query.operator) {
                case '=': isMatch = (numVal === q1); break;
                case '>': isMatch = (numVal > q1); break;
                case '<': isMatch = (numVal < q1); break;
                case '..': isMatch = (numVal >= q1 && numVal <= q2); break;
              }
              if (isMatch) score++;
            }
          });
          return score;
        }
        default: return 0;
      }
    };

    if (!isLaxQuery) { // Strict mode: returns item if it matches ANY query group
      const matchedItems = new Set();
      for (const query of queryGroups) {
        for (let i = 0; i < dataArray.length; i++) {
          if (checkStrictMatch(flattened[i], query)) {
            matchedItems.add(dataArray[i]);
          }
        }
      }
      return Array.from(matchedItems);
    } else { // Lax mode: calculates a cumulative score for each item across ALL query groups
      const results = [];
      dataArray.forEach((item, index) => {
        let totalScore = 0;
        for (const query of queryGroups) {
          totalScore += calculateScore(flattened[index], query);
        }
        if (totalScore > 0) {
          const resultItem = { ...item, _matchScore: totalScore };
          results.push(resultItem);
        }
      });
      return results;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
} else if (typeof window !== 'undefined') {
  window.SearchEngine = SearchEngine;
}
