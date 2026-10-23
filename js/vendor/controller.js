class Controller {
  constructor(func, AbortBeforeRun = true, startDelayMs = 0, intervalBetweenRunsMs = 0) {
    this.func = func;
    this.events = {
      onDone: [],
      onAbort: [],
      onError: []
    };
    this.startDelayMs = startDelayMs;
    this.intervalBetweenRunsMs = intervalBetweenRunsMs; // Calls inside this window run once it ends (the last call wins)
    this.AbortBeforeRun = AbortBeforeRun;

    this.running = false;
    this.controller = null;
    this._timeout = null;
    this._lastRun = null;

    // Each scheduled/running call keeps its own state, so a superseded call can never
    // resolve the promise of the call that replaced it (or clear its timer).
    this._current = null;
    this._trailing = null;
  }

  exec(...params) {
    if (this.running && !this.AbortBeforeRun) return Promise.resolve();

    // Inside the throttle window: defer to the end of the window instead of dropping the call
    const elapsed = this._lastRun ? Date.now() - this._lastRun : Infinity;
    if (elapsed < this.intervalBetweenRunsMs) {
      return this._deferUntilIntervalEnds(params, this.intervalBetweenRunsMs - elapsed);
    }

    if (this._current) this.abort(...params);

    const run = { controller: null, timeout: null, resolve: null, reject: null };
    this._current = run;

    return new Promise((resolve, reject) => {
      run.resolve = resolve;
      run.reject = reject;

      run.timeout = this._timeout = setTimeout(async () => {
        if (this._current !== run) return resolve(undefined);
        this._lastRun = Date.now();
        run.controller = this.controller = new AbortController();
        const signal = run.controller.signal;
        this.running = true;

        try {
          const result = await this.func(...params, signal);
          this.execEvents('onDone', result, ...params);
          resolve(result);
        } catch (error) {
          if (error?.name === 'AbortError') {
            resolve(undefined);
          } else {
            this.execEvents('onError', error);
            reject(error);
          }
        } finally {
          if (this._current === run) {
            this.running = false;
            this._timeout = null;
            this.controller = null;
            this._current = null;
          }
        }
      }, this.startDelayMs);
    });
  }

  _deferUntilIntervalEnds(params, waitMs) {
    // Only the latest deferred call runs; the one it replaces resolves with undefined
    if (this._trailing) {
      clearTimeout(this._trailing.timeout);
      this._trailing.resolve(undefined);
    }
    return new Promise(resolve => {
      const trailing = { resolve, timeout: null };
      trailing.timeout = setTimeout(() => {
        if (this._trailing === trailing) this._trailing = null;
        resolve(this.exec(...params));
      }, waitMs);
      this._trailing = trailing;
    });
  }

  abort(...params) {
    const run = this._current;
    const trailing = this._trailing;

    if (trailing) {
      clearTimeout(trailing.timeout);
      trailing.resolve(undefined);
      this._trailing = null;
    }

    if (run) {
      clearTimeout(run.timeout);
      if (run.controller && !run.controller.signal.aborted) run.controller.abort();
      // Never leave a caller waiting forever: an aborted call resolves with undefined
      run.resolve?.(undefined);
      this._current = null;
    }

    this.running = false;
    this._timeout = null;
    this.controller = null;
    this.execEvents('onAbort', ...params);
  }

  static wrap(fn, abortBeforeRunOrOptions, startDelayMs, intervalBetweenRunsMs) {
    // Backwards-compatible behavior:
    // - If second parameter is an object, treat it as options: { abortBeforeRun, delayMs (or startDelayMs), intervalBetweenRunsMs }
    // - Otherwise treat parameters as positional: (fn, abortBeforeRun, startDelayMs, intervalBetweenRunsMs)
    let opts;
    if (abortBeforeRunOrOptions && typeof abortBeforeRunOrOptions === 'object') {
      opts = abortBeforeRunOrOptions;
    } else {
      opts = {
        abortBeforeRun: abortBeforeRunOrOptions,
        delayMs: startDelayMs,
        intervalBetweenRunsMs: intervalBetweenRunsMs
      };
    }

    const controller = new Controller(fn, opts?.abortBeforeRun, opts?.delayMs ?? opts?.startDelayMs, opts?.intervalBetweenRunsMs);
    const bound = controller.exec.bind(controller);
    bound.Controller = controller;
    return bound;
  }

  addEvent(event, callback) {
    this.events[event].push(callback);
    return callback;
  }

  deleteEvent(event, callback) {
    const index = this.events[event].indexOf(callback);
    if (index !== -1) {
      this.events[event].splice(index, 1);
    }
  }

  clearEvents(event) {
    this.events[event] = [];
  }

  execEvents(event, ...params) {
    for (const callback of this.events[event]) {
      try {
        callback(...params);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = Controller;

// Example of usage
// const searchItems = async (Name, library, query) => {
//   if (!query) {
//     query = {}
//     if (Name)
//       query.Name = Name.trim();
//     if (library)
//       query.Library = library.trim();
//   }

//   searchParams = { ...query };

//   if (!areLibrariesLoaded) {
//     const limit = 20;
//     for (let count = 0; count < limit; count++) {
//       await new Promise(resolve => setTimeout(resolve, 500));
//       if (areLibrariesLoaded)
//         break;
//     }
//   }

//   if (!areLibrariesLoaded) {
//     events.onSearchFinish([])
//     return [];
//   }

//   // Validate library exists
//   if (searchParams.Library && (!Libraries?.[searchParams.Library]?.Items)) {
//     events.onSearchFinish([])
//     return [];
//   }

//   let items = [];
//   if (searchParams.Library)
//     items = Libraries[searchParams.Library].Items
//   else
//     for (lName in Libraries)
//       items = items.concat(Libraries[lName].Items)
//   items = await searchInArray(items, searchParams.Name)

//   // Sort items
//   const sortKey = searchParams.sortBy;
//   if (sortKey === "Random") {
//     items = items.sort(() => 0.5 - Math.random());
//   } else {
//     items = items.sort((a, b) => {
//       if (searchParams.order === "desc") {
//         [a, b] = [b, a];
//       }
//       const valA = a?.[sortKey];
//       const valB = b?.[sortKey];

//       if (typeof valA === "string" && typeof valB === "string") {
//         return valA.localeCompare(valB);
//       }

//       if (typeof valA === "number" && typeof valB === "number") {
//         return valA - valB;
//       }

//       if (valA instanceof Date && valB instanceof Date) {
//         return valA.getTime() - valB.getTime();
//       }

//       return 0;
//     });
//   }

//   searchParams.hasPreviousPage = hasPreviousPage();
//   searchParams.hasNextPage = hasNextPage(items);

//   items = items.slice(searchParams.offset, searchParams.offset + searchParams.limit);

//   events.onSearchFinish(items)
//   return items;
// }

// This is a way of use it
// Wrap your async function
// const reIndex = Controller.wrap(this.reIndex);
// Access its Controller instance
// const ctl = reIndex.Controller;
// ctl.startDelayMs = 10;
// ctl.abortBeforeRun = true;
// Save it for later use
// this.reIndex = reIndex;

// Or you can directly wrap the function when assign it
// this.reIndex = Controller.wrap(this.reIndex);
// Can even pass the options directly
// this.reIndex = Controller.wrap(this.reIndex, {startDelayMs: 10, abortBeforeRun: true});

// This bellow is a "deprecated" way of use it, this is now replaced by the Controller.wrap function, that does it easily
// const controller = new Controller(searchItems.bind(this));
// searchItems = controller;
// searchItems = searchItems.exec.bind(searchItems);
// searchItems.Controller = controller;
// searchItems('cat pictures')