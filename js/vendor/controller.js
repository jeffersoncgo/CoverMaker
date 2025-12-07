class Controller {
  constructor(func, AbortBeforeRun = true, startDelayMs = 0, intervalBetweenRunsMs = 0) {
    this.func = func;
    this.events = {
      onDone: [],
      onAbort: [],
      onError: []
    };
    this.startDelayMs = startDelayMs;
    this.intervalBetweenRunsMs = intervalBetweenRunsMs; //If the try to run, is smaller than the interval, we will just not execute
    this.AbortBeforeRun = AbortBeforeRun;

    this.running = false;
    this.controller = null;
    this._timeout = null;
    this._lastRun = null;

    this._resolve = null;
    this._reject = null;
  }

  exec(...params) {
    if (this.running && !this.AbortBeforeRun) return Promise.resolve();

    if (this._timeout) {
      clearTimeout(this._timeout);
      this.abort(...params);
    }

    return new Promise((resolve, reject) => {
      // Check the intervalbetween runs here
      // if we are within the interval, resolve immediately so the returned Promise doesn't hang
      if (this._lastRun && Date.now() - this._lastRun < this.intervalBetweenRunsMs) {
        resolve();
        return;
      }
      this._resolve = resolve;
      this._reject = reject;

      this._timeout = setTimeout(async () => {
        this._lastRun = Date.now();
        this.controller = new AbortController();
        const signal = this.controller.signal;
        this.running = true;

        try {
          const result = await this.func(...params, signal);
          this.execEvents('onDone', result, ...params);
          this._resolve?.(result);
        } catch (error) {
          if (error.name === 'AbortError') {} else {
            this.execEvents('onError', error);
            this._reject?.(error);
          }
        } finally {
          this.running = false;
          this._timeout = null;
          this.controller = null;
          this._resolve = null;
          this._reject = null;
        }
      }, this.startDelayMs);
    });
  }

  abort(...params) {
    if (this.controller && !this.controller.signal.aborted) {
      this.controller.abort();
    }

    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    this.running = false;
    this.execEvents('onAbort', ...params);

    this._resolve = null;
    this._reject = null;
    this.controller = null;
  }
  
  static wrap(fn, abortBeforeRunOrOptions, startDelayMs, intervalBetweenRunsMs) {
    // Backwards-compatible behavior:
    // - If second parameter is an object, treat it as options: { abortBeforeRun, delayMs, intervalBetweenRunsMs }
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

    const controller = new Controller(fn, opts?.abortBeforeRun, opts?.delayMs, opts?.intervalBetweenRunsMs);
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
