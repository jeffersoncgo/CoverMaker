class FetchQueue {
  constructor(fetchLimit = 5) {
    this.fetchLimit = fetchLimit;
    this.fetchTasks = [];
    this.activeCount = 0;
    this.isRunning = false;
  }

  // Queues a request. The callbacks work as before; the returned Promise also resolves (never rejects) when the
  // request finished: { data, res } on success or { error, res } on failure, so callers can await it.
  // A response that is not ok (HTTP 4xx/5xx) goes to onError (it used to reach onDone with the error body).
  fetch(url, params = {}, onDone = () => {}, onError = () => {}) {
    return new Promise(resolve => {
      // Push a deferred fetch task
      this.fetchTasks.push(async () => {
        let res;
        try {
          res = await fetch(url, params);
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim());
          const data = await res.json();
          onDone(data, res);
          resolve({ data, res });
        } catch (err) {
          onError(err, res);
          resolve({ error: err, res });
        }
      });

      // Trigger the worker loop
      this.startWorker();
    });
  }

  async startWorker() {
    if (this.isRunning) return; // Prevent multiple loop instances
    this.isRunning = true;

    while (this.fetchTasks.length > 0 && this.activeCount < this.fetchLimit) {
      const task = this.fetchTasks.shift(); // Remove from queue
      this.activeCount++;

      task().finally(() => {
        this.activeCount--;
        this.startWorker(); // Restart if more tasks in queue
      });
    }

    this.isRunning = false;
  }
}
