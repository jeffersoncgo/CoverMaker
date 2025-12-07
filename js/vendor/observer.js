class Observer {
  constructor(targetElement = document.body) {
    this.targetElement = targetElement;
    this.Listeners = [
      'click',
      'mouseover',
      'mouseout',
      'mousemove',
      'keydown',
      'keyup',
      'keypress',
      'submit',
      'input',
      'change',
      'focus',
      'blur',
      'load',
      // 'unload', //Disabled because of security browser bugs
      'DOMContentLoaded',
      'readystatechange',
      'oncontextmenu',
      'scroll',
      'wheel',
      'onresize',
      'oncopy',
      'oncut',
      'onpaste', //Gonna add only these as default, the user can add more if needed
    ]
    this.callbacks = [];
    this._isObserving = false;
    this.observer = new MutationObserver((mutationsList, observer) => {
      this.callbacks.forEach(callback => {
        try {
          callback(mutationsList, observer)
        } catch (error) { 
          console.error(error) 
        }
      })
    });
    this.config = { 
      childList: true, 
      subtree: true,
      attributes: true,
      characterData: true,
     };
  }
  AddCallBack(callback) {
    this.callbacks.push(callback);
    if (this._isObserving)
      this.AddListeners(callback);
  }

  Stop() {
    this.observer.disconnect();
    this.callbacks.forEach((callback) => {
      this.RemoveListeners(callback);
    })
    this._isObserving = false;
  }

  Start() {
    if(!this._isObserving)
      this.observer.observe(this.targetElement, this.config);
    this.callbacks.forEach((callback) => {
      this.AddListeners(callback);
    })
    this._isObserving = true;
  }

  SetListeners(listeners) {
    const wasObserving = this._isObserving;
    if(this._isObserving)
      this.Stop();
    this.RemoveAll();
    this.Listeners = listeners;
    if(wasObserving)
      this.Start();
  }

  AddListeners(callback) {
    this.Listeners.forEach((listener) => {
      this.targetElement.removeEventListener(listener, callback);
      this.targetElement.addEventListener(listener, callback);
    });
  }

  RemoveListeners(callback) {
    this.Listeners.forEach((listener) => {
      this.targetElement.removeEventListener(listener, callback);
    });
  }

  RemoveCallBack(index) {
    this.callbacks.splice(index, 1);
    this.targetElement.removeEventListener('change', callback);
    this.targetElement.removeEventListener('input', callback);
  }

  AddListener(listener) {
    this.Listeners.push(listener);
    this.callbacks.forEach((callback) => {
      this.targetElement.removeEventListener(listener, callback);
      this.targetElement.addEventListener(listener, callback);
    });
  }

  RemoveListener(listener) {
    this.Listeners.splice(this.Listeners.indexOf(listener), 1);
    this.callbacks.forEach((callback) => {
      this.targetElement.removeEventListener(listener, callback);
    });
  }

  RemoveAllListeners() {
    this.Listeners.forEach((listener) => {
      this.callbacks.forEach((callback) => {
        this.targetElement.removeEventListener(listener, callback);
      });
    });
  }

  RemoveAllCallBacks() {
    this.callbacks.forEach((callback) => {
      this.Listeners.forEach((listener) => {
        this.targetElement.removeEventListener(listener, callback);
      });
    });
  }

  RemoveAll() {
    this.RemoveAllListeners();
    this.RemoveAllCallBacks();
  }

  Destroy() {
    this.Stop();
    this.RemoveAll();
  }
}
