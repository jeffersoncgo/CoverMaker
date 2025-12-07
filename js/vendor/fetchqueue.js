class FetchQueue {
  constructor(fetchLimit = 5) {
    this.fetchLimit = fetchLimit;
    this.fetchTasks = [];
    this.activeCount = 0;
    this.isRunning = false;
  }

  async fetch(url, params = {}, onDone = () => {}, onError = () => {}) {
    // Push a deferred fetch task
    this.fetchTasks.push(async () => {
      try {
        const res = await fetch(url, params);
        const data = await res.json();
        onDone(data, res);
      } catch (err) {
        onError(err);
      }
    });

    // Trigger the worker loop
    this.startWorker();
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
