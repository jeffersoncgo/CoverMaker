if (typeof module != 'undefined')
  Controller = require("../../scripts/js/JCGWEB/controller");

class Jellyfin {
  constructor(Host = "http://localhost:8096", Username = "", Pw = "", events = {
    onServerSetupError: () => { },
    onLoginSuccess: () => { },
    onLoginError: () => { },
    onLibraryLoad: () => { },
    onSearchFinish: () => { },
  }, needsUserData = false, options = {}) {
    // options.preferCredentials: log in with Username/Pw even if a saved session exists (an explicit "Connect")
    const defaultEvents = {
      onServerSetupError: () => { },
      onLoginSuccess: () => { },
      onLoginError: () => { },
      onLibraryLoad: () => { },
      onSearchFinish: () => { },
    }
    events = { ...defaultEvents, ...events };
    this.Server = {
      "Address": "",
      "LocalAddress": "",
      "ExternalAddress": this.SanitizeServer(Host),
      "ServerName": "",
      "Version": "",
      "OperatingSystem": "",
      "Id": "",
      "Client": "Jellyfin Web",
      "Device": "Chrome",
      "isOnline": false,
    }

    this.User = {
      "Username": Username,
      "Pw": Pw,
      "Token": "",
      "Id": "",
    }

    this.headers = {
      "Content-Type": "application/json",
      "authorization": ""
    }

    this.searchParamsToRestore = {}

    this.searchParams = {
      choices: {
        sortBy: ["Random", "Name", "OfficialRating", "CommunityRating", "ProductionYear", "PremiereDate"],
        order: ["asc", "desc"],
      },
      Tags: [],
      Genres: [],
      Studios: [],
      Name: "",
      Library: "",
      OfficialRating: "",
      CommunityRating: null,
      ProductionYear: null,
      PremiereDate: "",
      limit: 10,
      loadLimit: 250,
      offset: 0,
      page: 1,
      hasNextPage: true,
      sortBy: "Name", 
      order: "asc",
      result: []
    }

    this.IncludeItemsTypes = ["Audio", "Video", "BoxSet", "Book", "Channel", "Movie", "LiveTvChannel", "Playlist", "Series", "TvChannel"]

    this.LibrariesTypes = [];

    this.currentSearchFilter = null;

    this.Libraries = {}

    this.fetchQueue = new FetchQueue();

    this.lastError = "";

    this.areLibrariesLoaded = false;

    this.isAuthenticated = false;
    this.Name = "jellyfin-splashmaker";
    this.events = events;

    this.Controller = new Controller(this.searchItems.bind(this));
    this.searchItems = this.Controller;
    this.searchItems = this.searchItems.exec.bind(this.searchItems);
    this.searchItems.Controller = this.Controller;

    this.regex = {
      title: /^(?<title>.+?)\s+\(\d{4}\)\s+\[.*?=.+?\]/,
      year: /\((?<year>\d{4})\)/,
      id: /\[(?<provider>[a-zA-Z]+id)=(?<id>[a-zA-Z0-9]+)\]/
    }

    this.searchReady = false;
    this.needsUserData = needsUserData;

    this.VirtualFolders = [];

    this.Meilisearch = {
      "isAvailable": false,
      "Id": null,
      "ApiKey": null,
      "Host": "http://localhost:7700",
      "Index": null,
      "TypeMap": {
        "tvshows": "MediaBrowser.Controller.Entities.TV.Series",
        "movies": "MediaBrowser.Controller.Entities.Movies.Movie",
        "boxsets": "MediaBrowser.Controller.Entities.Movies.BoxSet",
        "music": "MediaBrowser.Controller.Entities.Audio.Audio",
        "playlists": "MediaBrowser.Controller.Playlists.Playlist",
        "livetv": "MediaBrowser.Controller.LiveTv.LiveTvChannel"
      },
      "maxTotalHits": 20000
    }
    this.init({ preferCredentials: options?.preferCredentials === true });
  }

  // Connects and loads the libraries. Resolves true when logged in; every failure is reported through the
  // events (onServerSetupError / onLoginError) instead of an unhandled rejection.
  // On page load the saved session token is tried first, so no password is needed (and none is sent);
  // `preferCredentials` (an explicit "Connect" with a typed password) logs in with the password instead.
  async init({ preferCredentials = false } = {}) {
    await this.getPublicInfo();
    if (!this.Server.isOnline)
      return false; // getPublicInfo already reported it

    await this.setFastestAddress();
    if (!this.Server.isOnline)
      return false; // setFastestAddress already reported it

    const hasCredentials = Boolean(this.User.Username && this.User.Pw);
    let session = null;
    if (preferCredentials && hasCredentials) {
      session = await this.login();
    } else {
      session = await this.loginWithSavedToken();
      if (!session && hasCredentials)
        session = await this.login();
    }

    if (!session) {
      // login() reports its own failures; without credentials nothing was tried yet
      if (!hasCredentials) {
        const error = new Error("Username and password are required for authentication.");
        error.name = "MissingCredentialsError";
        this.events.onLoginError(error);
      }
      return false;
    }

    this.isAuthenticated = true;
    this.updateAuthHeader();
    try {
      await this.setupMeiliSearch();
    } catch (error) {
      // An unusable Meilisearch (non-admin user, index not reachable from the browser) must not block the libraries
      console.warn("Meilisearch unavailable, loading the libraries from Jellyfin:", error);
      this.Meilisearch.isAvailable = false;
    }
    setTimeout(async () => {
      await this.getLibraries();
    }, 1000);
    this.searchReady = true;
    return true;
  }

  UpdateConfig(host, username, password) {
    this.Server.ExternalAddress = this.SanitizeServer(host);
    this.User.Username = username;
    this.User.Pw = password;
    return this.init({ preferCredentials: true });
  }

  SanitizeServer(server) {
    return Jellyfin.normalizeServer(server);
  }

  static normalizeServer(server) {
    server = String(server ?? "").trim();
    return server.endsWith("/") ? server.slice(0, -1) : server;
  }

  // ---- Saved session ----
  // Only { server, serverId, userId, token } is kept (localStorage "jellyfinAuth"), never the password. Every app on
  // this origin (CoverMaker, content-recommender) shares it, as they already shared the server address.
  static AUTH_STORAGE_KEY = "jellyfinAuth";

  static getSavedAuth(server = null) {
    try {
      const saved = JSON.parse(localStorage.getItem(Jellyfin.AUTH_STORAGE_KEY) || "null");
      if (!saved?.token || !saved?.userId) return null;
      if (server && Jellyfin.normalizeServer(saved.server) !== Jellyfin.normalizeServer(server)) return null;
      return saved;
    } catch (error) {
      return null;
    }
  }

  static clearSavedAuth() {
    try { localStorage.removeItem(Jellyfin.AUTH_STORAGE_KEY); } catch (error) { /* storage unavailable */ }
  }

  saveAuth() {
    try {
      localStorage.setItem(Jellyfin.AUTH_STORAGE_KEY, JSON.stringify({
        server: this.Server.ExternalAddress,
        serverId: this.Server.Id,
        userId: this.User.Id,
        token: this.User.Token,
      }));
    } catch (error) {
      console.warn("Could not save the Jellyfin session:", error);
    }
  }

  // Reuses the saved token when it belongs to this server (same address, or same server id under another address).
  // Resolves like login(): the session data, or null.
  async loginWithSavedToken() {
    const saved = Jellyfin.getSavedAuth();
    if (!saved || (saved.server !== this.Server.ExternalAddress && saved.serverId !== this.Server.Id))
      return null;

    this.User.Token = saved.token;
    this.User.Id = saved.userId;
    this.updateAuthHeader();

    let response;
    try {
      response = await fetch(`${this.Server.Address}/Users/${saved.userId}`, { method: "GET", headers: this.headers });
    } catch (error) {
      response = null; // network failure: keep the saved session for the next attempt
    }

    if (!response || !response.ok) {
      // 401 = token revoked or expired: forget it, so the password (or the login window) takes over
      if (response?.status === 401)
        Jellyfin.clearSavedAuth();
      this.User.Token = "";
      this.User.Id = "";
      this.isAuthenticated = false;
      this.updateAuthHeader();
      return null;
    }

    const user = await response.json();
    this.User.Username = user?.Name ?? this.User.Username;
    this.isAuthenticated = true;
    const data = { User: user, AccessToken: saved.token, ServerId: saved.serverId, fromSavedToken: true };
    this.events.onLoginSuccess(data);
    return data;
  }

  // Ends the session on the server (the token stops working everywhere) and forgets it in this browser
  async logout() {
    try {
      if (this.User.Token && this.Server.Address)
        await fetch(`${this.Server.Address}/Sessions/Logout`, { method: "POST", headers: this.headers });
    } catch (error) {
      console.warn("Jellyfin logout request failed:", error);
    }
    Jellyfin.clearSavedAuth();
    this.User.Token = "";
    this.User.Id = "";
    this.User.Pw = "";
    this.isAuthenticated = false;
    this.searchReady = false;
    this.updateAuthHeader();
  }

  onFetchError(response) {
    if (response.status === 401) {
      this.isAuthenticated = false;
      console.error("Authentication failed. Please check your credentials.");
    } else {
      // Called with a Response or, when the request itself failed, with the Error
      console.error("Fetch error:", response?.statusText || response?.message || response);
    }
  }

  updateAuthHeader() {
    let TokenBit = this.User.Token ? `, Token="${this.User.Token}"` : "";
    this.headers.authorization = `MediaBrowser Client="${this.Server.Client}", Device="${this.Server.Device}", DeviceId="${this.Name}", Version="${this.Server.Version}"${TokenBit}`;
  }

  // One shared connection per database. Opening a new connection for every read/write and never closing it
  // blocked the version upgrade needed to create the next store, which stalled the first library load until
  // the browser happened to garbage-collect the old connections.
  openDB(dbName, storeName) {
    this._idb ??= {};
    const entry = this._idb[dbName] ??= { db: null, queue: Promise.resolve() };
    const opened = entry.queue.then(() => this._openStore(entry, dbName, storeName));
    entry.queue = opened.catch(() => { });
    return opened;
  }

  _openStore(entry, dbName, storeName) {
    return new Promise((resolve, reject) => {
      const use = (db) => {
        // Let other tabs (or a newer CoverMaker/content-recommender) upgrade the database
        db.onversionchange = () => {
          db.close();
          if (entry.db === db) entry.db = null;
        };
        entry.db = db;
        resolve(db);
      };

      const upgrade = (db) => {
        const version = db.version + 1;
        db.close();
        if (entry.db === db) entry.db = null;

        const upgradeRequest = indexedDB.open(dbName, version);
        upgradeRequest.onupgradeneeded = (event) => {
          const upgradeDb = event.target.result;
          if (!upgradeDb.objectStoreNames.contains(storeName)) upgradeDb.createObjectStore(storeName);
        };
        upgradeRequest.onsuccess = () => use(upgradeRequest.result);
        upgradeRequest.onerror = () => reject(upgradeRequest.error);
        upgradeRequest.onblocked = () => console.warn(`IndexedDB "${dbName}" upgrade is waiting for another tab to release it`);
      };

      if (entry.db) {
        if (entry.db.objectStoreNames.contains(storeName)) return resolve(entry.db);
        return upgrade(entry.db);
      }

      const checkRequest = indexedDB.open(dbName);
      checkRequest.onsuccess = () => {
        const db = checkRequest.result;
        if (db.objectStoreNames.contains(storeName)) use(db);
        else upgrade(db);
      };
      checkRequest.onerror = () => reject(checkRequest.error);
    });
  }


  // Resolves true when the write is committed, false (and logs) if it fails
  async saveData(dbName, storeName, key = "result", data) {
    try {
      const db = await this.openDB(dbName, storeName);
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(JSON.stringify(data), key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (error) {
      console.error(`Could not save ${storeName} to IndexedDB:`, error);
      return false;
    }
  }

  async loadData(dbName, storeName, key = "result") {
    const db = await this.openDB(dbName, storeName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => {
        const result = req.result;
        if (!result) return resolve(null);
        try {
          resolve(JSON.parse(result));
        } catch (error) {
          console.error("Error decompressing or parsing data:", error);
          resolve(null); 
        }
      };

      req.onerror = () => resolve(null);
    });
  }

  async clearData(dbName, storeName) {
    const db = await this.openDB(dbName, storeName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async cleanDb() {
    await this.clearData(this.Server.Id, "Tags");
    await this.clearData(this.Server.Id, "Genres");
    await this.clearData(this.Server.Id, "Studios");
    for (const lName in this.Libraries) {
      await this.clearData(this.Server.Id, this.Libraries[lName].Id);
    }
    this.Libraries = {};
    this.areLibrariesLoaded = false;
    this.searchParams = {
      Tags: [],
      Genres: [],
      Studios: [],
      Name: "",
      Library: "",
      OfficialRating: "",
      CommunityRating: null,
      ProductionYear: null,
      PremiereDate: "",
      limit: 10,
      loadLimit: 100,
      offset: 0,
      page: 1,
      hasNextPage: true,
      sortBy: "Name",
      order: "asc",
      PlayedOnly: false,
      UnplayedOnly: false,
    }
    this.searchParamsToRestore = {}
    location.reload();
  }

  isLibrarySizeChanged(libraryId, currSize) {
    if (this.Libraries[libraryId]) {
      return this.Libraries[libraryId].Count != currSize;
    }
    return true;
  }

  async getPublicInfo() {
    let response;
    try {
      response = await fetch(`${this.Server.ExternalAddress}/System/Info/Public`);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);

      let data = await response.json();
      this.Server.LocalAddress = data.LocalAddress;
      this.Server.ServerName = data.ServerName;
      this.Server.Version = data.Version;
      this.Server.ProductName = data.ProductName;
      this.Server.OperatingSystem = data.OperatingSystem;
      this.Server.Id = data.Id;
      this.Server.isOnline = true;

      this.updateAuthHeader();
      return data;
    } catch (error) {
      this.Server.isOnline = false;

      if (response) {
        this.onFetchError(response);
        this.events.onServerSetupError(response);
      } else {
        this.onFetchError(error);
        this.events.onServerSetupError(error);
      }

      return null; 
    }
  }

  async setFastestAddress() {
    const controller = new AbortController();
    // Stop waiting for an address after 5 s (AbortSignal.any keeps the "first answer wins" abort as well)
    const signal = (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function')
      ? AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])
      : controller.signal;

    const checkAddress = async (address) => {
      try {
        const start = performance.now();
        const response = await fetch(`${address}/System/Info/Public`, { method: "GET", signal: signal });
        if (response.ok) {
          const end = performance.now();
          controller.abort();
          return { address, time: end - start, reachable: true };
        }
      } catch (error) {
      }
      return { address, time: Infinity, reachable: false };
    };

    const addressesToTest = [];
    if (this.Server.ExternalAddress) {
      addressesToTest.push(this.Server.ExternalAddress);
    }
    if (this.Server.LocalAddress && this.Server.LocalAddress !== this.Server.ExternalAddress) {
      addressesToTest.push(this.Server.LocalAddress);
    }

    if (addressesToTest.length === 0) {
      console.warn("No server addresses to test.");
      return;
    }

    

    const results = await Promise.all(addressesToTest.map(checkAddress));
    const fastestResult = results.reduce((prev, current) => (prev.time < current.time ? prev : current));

    if (fastestResult.reachable) {
      this.Server.Address = fastestResult.address;
      this.Server.Speed = fastestResult;
    } else {
      console.warn("No reachable server address found among the provided options.");
      this.Server.isOnline = false;
      this.events.onServerSetupError("No reachable server address found.");
    }
  }

  backupSearchParams() {
    this.searchParamsToRestore = { ...this.searchParams }
  }

  restoreSearchParams() {
    this.searchParams = { ...this.searchParamsToRestore }
  }

  async login() {
    let response;
    try {
      response = await fetch(`${this.Server.Address}/Users/authenticatebyname`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          "Username": this.User.Username,
          "Pw": this.User.Pw
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let data = await response.json();
      this.User.Token = data.AccessToken;
      this.User.Id = data.User.Id;

      this.isAuthenticated = true;

      this.updateAuthHeader();
      // From now on the token is used; the password is not kept (not even in memory)
      this.saveAuth();
      this.User.Pw = "";
      this.events.onLoginSuccess(data);
      return data;
    } catch (error) {
      this.isAuthenticated = false;
      this.User.Token = null;
      this.User.Id = null;
      this.updateAuthHeader();
      if (response) {
        this.events.onLoginError(error, response);
        this.onFetchError(response);
      } else {
        this.events.onLoginError(error);
        this.onFetchError(error);
      }
      return null;
    }
  }

  libraryIdByName(name) {
    return this.Libraries[name] ? this.Libraries[name].Id : null;
  }

  libaryNameById(id) {
    for (const lId in this.Libraries) {
      if (this.Libraries[lId].Id === id)
        return this.Libraries[lId].Name;
    }
    return null;
  }

  mapEnabledLibrarie() {
    const typeMapping = {
        "Audio": "music",
        "Video": "homevideos", 
        "BoxSet": "boxsets",
        "Book": "books",
        "Channel": "livetv",
        "Movie": "movies",
        "LiveTvChannel": "livetv",
        "Playlist": "playlists",
        "Series": "tvshows",
        "TvChannel": "livetv"
    };

    this.LibrariesTypes = [...new Set(this.IncludeItemsTypes.map(type => typeMapping[type]).filter(Boolean))];
  }

  async getLibraries() {
    if (!this.isAuthenticated) return;

    const startTime = performance.now();
    const response = await fetch(`${this.Server.Address}/UserViews?userId=${this.User.Id}`, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      this.onFetchError(response);
      return;
    }

    const data = await response.json();

    await this.getVirtualFolders();

    this.Libraries = {};
    let toReagroupd = [];

    this.mapEnabledLibrarie();


    this.searchParams.Tags = await this.loadData(this.Server.Id, "Tags", "result") || [];
    this.searchParams.Genres = await this.loadData(this.Server.Id, "Genres", "result") || [];
    this.searchParams.Studios = await this.loadData(this.Server.Id, "Studios", "result") || [];

    for (let index = 0; index < data.Items.length; index++) {
      const library = data.Items[index];
      if(!this.LibrariesTypes.includes(library.CollectionType)) {
        continue;
      }

      const Count = await this.getLibrarySize(library.Id);


        const virtualFolder = this.VirtualFolders.find(vf => vf.ItemId === library.Id);
        if (virtualFolder && library.CollectionType == "tvshows")
          library.Locations = virtualFolder.Locations;

        try {
          const loadedData = await this.loadData(this.Server.Id, library.Id, "result");
          if (loadedData) {
            if (loadedData.Count == Count && loadedData.Items.length == Count) {
              this.Libraries[library.Name] = loadedData;
              this.Libraries[library.Name].Status = 'Loaded';
              this.Libraries[library.Name].Count = Count;
              this.Libraries[library.Name].CollectionType = library.CollectionType;
              this.Libraries[library.Name].Type = library.Type;
              this.Libraries[library.Name].Path = library.Path;
              this.Libraries[library.Name].Locations = library.Locations;
              toReagroupd.push(library.Id);
              console.log(`${loadedData.Name} loaded from cache.`)
              // Same item count, but items may have been edited on the server since the cache was written
              const hadSync = Boolean(loadedData.LastSync);
              const refreshed = await this.refreshChangedItems(library.Id);
              if (refreshed > 0 || (!hadSync && refreshed === 0))
                await this.saveData(this.Server.Id, library.Id, "result", this.Libraries[library.Name]);
              continue;
            }
          }
        } catch (error) { 
        }

        if (!this.isLibrarySizeChanged(library.Id, Count)) {
          this.Libraries[library.Name].Status = 'Loaded'; 
          continue;
        }

        this.Libraries[library.Name] = {
          Id: library.Id,
          Name: library.Name,
          ImageId: library.ImageTags?.Primary,
          Items: [],
          Count: 0,
          Status: 'Loading...',
          CollectionType: library.CollectionType,
          Type: library.Type,
          Path: library.Path,
          Locations: library.Locations,
        };

        this.showLoadingLibraries();
        
        this.Libraries[library.Name].Count = Count;
        // Taken before loading, so edits made while loading are picked up by the next refreshChangedItems
        const loadStartedAt = new Date().toISOString();
        const items = await this.loadLibraryItems(library.Id);
        if (!items || items.length == 0) {
          this.Libraries[library.Name].Status = 'Loading Error';
          continue;
        }
        console.log(`Loaded ${items.length} items from library ${library.Name}`)
        this.Libraries[library.Name].Items = items;
        this.Libraries[library.Name].Count = items.length;
        this.Libraries[library.Name].LastSync = loadStartedAt;

        this.saveData(this.Server.Id, library.Id, "result", this.Libraries[library.Name]);
        this.Libraries[library.Name].Status = 'Loaded';

        if (!toReagroupd.includes(library.Id))
          toReagroupd.push(library.Id);
    }

    for (const libraryId of toReagroupd) {
      await Promise.all([
        this.getLibraryItemsGroups(libraryId, "Tags").then(tags => {
          if(tags.length > 0)
            this.searchParams.Tags = this.searchParams.Tags.concat(...tags)
        }),
        this.getLibraryItemsGroups(libraryId, "Genres").then(genres => {
          if(genres.length > 0)
          this.searchParams.Genres = this.searchParams.Genres.concat(...genres)
        }),
        this.getLibraryItemsGroups(libraryId, "Studios").then(studios => {
          if(studios.length > 0)
          this.searchParams.Studios = this.searchParams.Studios.concat(...studios)
        }),
        this.updateLibraryUserData(libraryId),
      ]);
    }

    this.searchParams.Tags = [...new Set(this.searchParams.Tags)].sort().eachWordUp();
    this.searchParams.Genres = [...new Set(this.searchParams.Genres)].sort().eachWordUp();
    this.searchParams.Studios = [...new Set(this.searchParams.Studios)].sort().eachWordUp();

    this.saveData(this.Server.Id, "Tags", "result", this.searchParams.Tags);
    this.saveData(this.Server.Id, "Genres", "result", this.searchParams.Genres);
    this.saveData(this.Server.Id, "Studios", "result", this.searchParams.Studios);

    this.areLibrariesLoaded = true;
    this.events.onLibraryLoad(data);

   
    

    const endTime = performance.now();
    this.hideLoadingLibraries()
    console.log(`All libraries loaded in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
    return data;
  }

  makeLibrarieAll() {
    this.Libraries['_all_'] = {
      Id: '_all_',
      Name: 'All',
      Items: [],
      Count: 0,
      Status: 'Loaded',
      CollectionType: 'All',
      Path: 'All',
      Locations: [],
      Type: 'All'
    };

    for (const lName in this.Libraries) {
      if (lName === '_all_') continue;
      this.Libraries['_all_'].Items.push(...this.Libraries[lName].Items);
      this.Libraries['_all_'].Count += this.Libraries[lName].Count;
    }
  }


  async findInLibraryByItemId(library, itemId) {
    const libraryName = this.libaryNameById(library);
    const lib = this.Libraries[libraryName];
    if (!lib || !lib.Items) {
      console.warn(`Library ${libraryName} not found or has no items.`);
      return null;
    }
    return lib.Items.find(item => item.Id === itemId);
  }
  
  async findByItemId(itemId) {
    let Library = null;
    let Item = null;
    for (const lName in this.Libraries) {
      const foundItem = await this.findInLibraryByItemId(this.Libraries[lName].Id, itemId);
      if (foundItem) {
        Library = this.Libraries[lName];
        Item = foundItem;
        break;
      }
    }
    return { Library, Item };
  }

  removeLibraryItem(library, itemId) {
    const libraryName = this.libaryNameById(library);
    const lib = this.Libraries[libraryName];
    if (!lib || !lib.Items) {
      console.warn(`Library ${libraryName} not found or has no items.`);
      return;
    }
    lib.Items = lib.Items.filter(item => item.Id !== itemId);
    lib.Count = lib.Items.length;
    this.searchParams.result = this.searchParams.result.filter(item => item.Id !== itemId);
    this.saveData(this.Server.Id, library, "result", lib);
  }

  async nextPage() {
    if (!this.searchParams.hasNextPage)
      return;
    this.searchParams.page++;
    this.searchParams.offset = (this.searchParams.page - 1) * this.searchParams.limit;
    return await this.searchItems(null, null, null, null);
  }

  async previousPage() {
    if (!this.searchParams.hasPreviousPage)
      return;
    this.searchParams.page--;
    this.searchParams.offset = (this.searchParams.page - 1) * this.searchParams.limit;
    return await this.searchItems(null, null, null, null);
  }

  hasPreviousPage() {
    return this.searchParams.offset > 0;
  }

  hasNextPage(items) {
    return this.searchParams.offset + this.searchParams.limit < items.length;
  }

  setDelay(delay) {
    this.searchItems.Controller.startDelayMs = delay;
  }

  isPlayed(item) {
    // Items carry Type (CollectionType is a library property): collections never count as watched
    return item.UserData && ((item.UserData.Played) || (item.UserData.PlayedPercentage >= 70) || (item.UserData.PlayCount > 0)) && item.Type != "BoxSet" && item.CollectionType != "BoxSet";
  }

  extractInfoByTitle(title) {
    return {
      title: title.match(this.regex.title)?.groups?.title,
      year: title.match(this.regex.year)?.groups?.year,
      providerId: title.match(this.regex.id)?.groups?.id,
      provider: title.match(this.regex.id)?.groups?.provider,
      originalTitle: title
    }
  }


  async searchItems(Name = null, library = null, query = null, tempLimit = null) {
    const orgQuery = query;
    if (!query) {
      query = {}
      if (typeof Name == 'string')
        query.Name = Name.trim();
      if (typeof library == 'string')
        query.Library = library.trim();
    }


    this.searchParams = { ...this.searchParams, ...query, query: orgQuery  };

    if (!this.areLibrariesLoaded) {
      const limit = 20;
      for (let count = 0; count < limit; count++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (this.areLibrariesLoaded)
          break;
      }
    }

    if (!this.areLibrariesLoaded) {
      this.events.onSearchFinish([])
      return [];
    }

    if (this.searchParams.Library && (!this.Libraries?.[this.searchParams.Library]?.Items)) {
      this.events.onSearchFinish([])
      return [];
    }

    let items = [];
    if (this.searchParams.Library)
      items = this.Libraries[this.searchParams.Library].Items
    else
      for (const lName in this.Libraries)
        items = items.concat(this.Libraries[lName].Items)

    if (this.searchParams.PlayedOnly) {
      items = items.filter(this.isPlayed);
    } else if (this.searchParams.UnplayedOnly) {
      items = items.filter(item => !this.isPlayed(item));
    }

    items = await searchInArray(items, this.searchParams.Name)

    const sortKey = this.searchParams.sortBy;
    if (sortKey === "Random") {
      items = Jellyfin.shuffle([...items]);
    } else {
      items = items.sort((a, b) => {
        if (this.searchParams.order === "desc") {
          [a, b] = [b, a];
        }
        const valA = a?.[sortKey];
        const valB = b?.[sortKey];

        if (typeof valA === "string" && typeof valB === "string") {
          return valA.localeCompare(valB);
        }

        if (typeof valA === "number" && typeof valB === "number") {
          return valA - valB;
        }

        if (valA instanceof Date && valB instanceof Date) {
          return valA.getTime() - valB.getTime();
        }

        return 0;
      });
    }

    this.searchParams.hasPreviousPage = this.hasPreviousPage();
    this.searchParams.hasNextPage = this.hasNextPage(items);

    // Only a positive number overrides the page size: callers that pass fewer arguments get the
    // Controller's AbortSignal in this position (content-recommender calls searchItems('', '', {}))
    const mLimit = (typeof tempLimit === 'number' && tempLimit > 0) ? tempLimit : this.searchParams.limit;

    items = items.slice(this.searchParams.offset, this.searchParams.offset + mLimit);

    this.events.onSearchFinish(items)
    this.searchParams.result = items;
    return items;
  }

  async refreshItem(item, Recursive = true, ImageRefreshMode = "Default", MetadataRefreshMode = "Default", ReplaceAllImages = false, RegenerateTrickplay = false, ReplaceAllMetadata = false) {
    if (!this.isAuthenticated) {
      console.warn("Not authenticated. Cannot refresh item.");
      return null;
    }
    try {
      const response = await fetch(`${this.Server.Address}/Items/${item.Id}/Refresh?Recursive=${Recursive}&ImageRefreshMode=${ImageRefreshMode}&MetadataRefreshMode=${MetadataRefreshMode}&ReplaceAllImages=${ReplaceAllImages}&RegenerateTrickplay=${RegenerateTrickplay}&ReplaceAllMetadata=${ReplaceAllMetadata}`, {
        method: "POST",
        headers: this.headers,
        body: null,
        credentials: "include",
        "mode": "cors",

      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`Item ${item.Name} refreshed.`);
      return true;
    } catch (error) {
      console.error(`Error refreshing item ${item.Name}:`, error);
      this.onFetchError(error);
      return false;
    }
  }

  async getLibraryItemsGroups(libraryId, GroupName) {
    const libraryName = this.libaryNameById(libraryId);
    const library = this.Libraries[libraryName];
    if (!library || !library.Items) {
      console.warn(`Library ${libraryName} not found or has no items.`);
      return [];
    }

    const functions = {
      Studios: s => (s.Name?.toLowerCase() || s.toLowerCase()) + '\uFEFF',
      Genres: g => g.toLowerCase() + '\uFEFF',
      Tags: t => t.toLowerCase() + '\uFEFF',
    }

    const f = functions[GroupName];

    return library.Items.map(item => item[GroupName]?.map(f));
  }

  async getLibrarySize(libraryId) {
    if (!this.isAuthenticated)
      return;
    let response = await fetch(`${this.Server.Address}/Users/${this.User.Id}/Items?ParentId=${libraryId}&Limit=1`, {
      method: "GET",
      headers: this.headers
    });
    if (response.ok) {
      let data = await response.json();
      return data.TotalRecordCount;
    } else {
      this.onFetchError(response);
      return 0;
    }
  }

  async getVirtualFolders() {
    if (!this.isAuthenticated)
      return;
    let response = await fetch(`${this.Server.Address}/Library/VirtualFolders`, {
      method: "GET",
      headers: this.headers
    });
    if (response.ok) {
      let data = await response.json();
      this.VirtualFolders = data;
      return data;
    } else {
      this.onFetchError(response);
      return [];
    }
  }

  shouldUseMeiliSearch(libraryId) {
    const libraryName = this.libaryNameById(libraryId);
    const library = this.Libraries[libraryName];
    if (!library)
      return false;
    if(!this.Meilisearch.isAvailable)
      return false;
    return true;
  }

  async loadLibraryItems(libraryId, fastLoading = false) {
    if (this.shouldUseMeiliSearch(libraryId)) {
      try {
        return await this.loadLibraryItemsMeiliSearch(libraryId, fastLoading);
      } catch (error) {
        // e.g. the Meilisearch URL configured in the plugin is not reachable from the browser
        console.warn("Meilisearch search failed, loading the library from Jellyfin instead:", error);
        this.Meilisearch.isAvailable = false;
        const library = this.Libraries[this.libaryNameById(libraryId)];
        if (library?.Items) library.Items.length = 0; // drop a partial Meilisearch result (the loader below appends)
      }
    }
    return await this.loadLibraryItemsVanilla(libraryId, fastLoading);
  }

  async loadLibraryItemsMeiliSearch(libraryId, fastLoading = false) {
    if (!this.isAuthenticated || !this.Meilisearch?.isAvailable) return [];

    const libraryName = this.libaryNameById(libraryId);
    const library = this.Libraries[libraryName];

    const index = this.Meilisearch.Index;
    let loadLimit = this.searchParams.loadLimit;
    if (!loadLimit)
      loadLimit = this.Meilisearch.maxTotalHits;

    if (loadLimit > this.Meilisearch.maxTotalHits)
      loadLimit = this.Meilisearch.maxTotalHits;
    
    this.Libraries[libraryName].Items ??= [];
    this.Libraries[libraryName].Items.length = 0;

    console.log(`🔎 Loading ${libraryName} items via MeiliSearch...`);

    let startsWithFilters = "";
    if(library.Locations?.length > 0) {
      // Meilisearch filter strings are double-quoted: escape \ and " (Windows paths like C:\Media)
      startsWithFilters = library.Locations
      .map(loc => `(path STARTS WITH "${String(loc).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`)
      .join(" OR ");
      startsWithFilters = ` AND (${startsWithFilters})`;
    }

    const typeFilter = `(type = "${this.Meilisearch.TypeMap[library.CollectionType] || 'MediaBrowser.Controller.Entities.TV.Series'}")`;
    const finalFilter = `${typeFilter} ${startsWithFilters}`;

    let offset = 0;
    let totalHits = 0;

    while (true) {
      const result = await index.search("", {
        filter: finalFilter,
        limit: loadLimit,
        offset
      });


      const hits = result.hits || [];
      totalHits += hits.length;

      console.log(`MeiliSearch: Loading ${hits.length} items from offset ${offset}. Total hits so far: ${totalHits}`);

      for (const hit of hits) {
        if (!fastLoading) {
          this.Libraries[libraryName].Items.push({
            Id: hit.guid,
            Name: hit.name,
            Overview: hit.overview,
            ProductionYear: hit.productionYear,
            Genres: hit.genres || [],
            Studios: hit.studios || [],
            Tags: hit.tags || [],
            Path: hit.path,
            Type: hit.type,
            originalData: hit
          });

          if (hit.tags) this.searchParams.Tags.push(...hit.tags.map(t => t.toLowerCase() + '\uFEFF'));
          if (hit.genres) this.searchParams.Genres.push(...hit.genres.map(g => g.toLowerCase() + '\uFEFF'));
          if (hit.studios) this.searchParams.Studios.push(...hit.studios.map(s => s.toLowerCase() + '\uFEFF'));
        } else {
          this.Libraries[libraryName].Items.push({
            Id: hit.guid,
            Name: hit.name
          });
        }
      }

      if (hits.length < loadLimit) break;
      offset += loadLimit;
    }

    console.log(`✅ Loaded ${this.Libraries[libraryName].Items.length} items from MeiliSearch for ${libraryName}`);

    return this.Libraries[libraryName].Items;
  }


  // The fields kept per item in the library cache
  static toLibraryItem(item) {
    return {
      Id: item.Id,
      Name: item.Name,
      ImageId: item.ImageTags?.Primary,
      PremiereDate: item.PremiereDate,
      OfficialRating: item.OfficialRating,
      CommunityRating: item.CommunityRating,
      ProductionYear: item.ProductionYear,
      Genres: item.Genres,
      Studios: item.Studios,
      Tags: item.Tags,
      Overview: item.Overview,
      Type: item.Type,
      ItemsCount: item.RecursiveItemCount || item.ChildCount || item.MediaSources?.length,
      UserData: Jellyfin.pickUserData(item.UserData),
      ParentId: item.ParentId,
      Path: item.Path,
      originalData: item
    };
  }

  // PlayedPercentage is kept too: isPlayed() counts an item watched to 70 % or more
  static pickUserData(userData) {
    return {
      IsFavorite: userData?.IsFavorite,
      Played: userData?.Played,
      PlayCount: userData?.PlayCount,
      LastPlayedDate: userData?.LastPlayedDate,
      PlayedPercentage: userData?.PlayedPercentage
    };
  }

  // Jellyfin ids are GUIDs; some sources (e.g. Meilisearch) write them with dashes or in another case
  static itemKey(id) {
    return String(id ?? "").replace(/-/g, "").toLowerCase();
  }

  // Fisher-Yates: every order is equally likely (sort(() => 0.5 - Math.random()) is biased)
  static shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Fields requested for every library item (also used to refresh edited items)
  libraryItemFields(fastLoading = false) {
    const Fields = ["OriginalTitle"];
    if (!fastLoading)
      Fields.push(...[ "Overview", "Genres", "Studios", "Tags","ParentId", "Path" ])
    return Fields;
  }

  // A cached library is reused while its item count is the same; items edited on the server since the last sync
  // (title, cover, genres…) are fetched with MinDateLastSaved and replace their cached copy. Resolves the number of
  // updated items, or -1 when the request failed (the cache is kept as it was).
  async refreshChangedItems(libraryId) {
    const library = this.Libraries[this.libaryNameById(libraryId)];
    if (!library?.Items || !this.isAuthenticated) return 0;
    const since = library.LastSync;
    const startedAt = new Date().toISOString();
    library.LastSync = startedAt;
    if (!since) return 0; // cache written by an older version: edits are tracked from now on

    const FieldsText = encodeURIComponent(this.libraryItemFields().join(","));
    const IncludeItemsTypesText = encodeURIComponent(this.IncludeItemsTypes.join(","));
    const url = `${this.Server.Address}/Users/${this.User.Id}/Items?SortBy=IndexNumber&Fields=${FieldsText}&ImageTypeLimit=1&EnableImageTypes=Primary&ParentId=${libraryId}&includeItemTypes=${IncludeItemsTypesText}&MinDateLastSaved=${encodeURIComponent(since)}`;
    try {
      const response = await fetch(url, { method: "GET", headers: this.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const changed = (await response.json()).Items || [];
      if (!changed.length) return 0;
      const byKey = new Map(changed.map(item => [Jellyfin.itemKey(item.Id), Jellyfin.toLibraryItem(item)]));
      library.Items = library.Items.map(item => byKey.get(Jellyfin.itemKey(item.Id)) ?? item);
      console.log(`${library.Name}: ${changed.length} edited item(s) refreshed from the server.`);
      return changed.length;
    } catch (error) {
      library.LastSync = since;
      console.warn(`Could not check ${library.Name} for edited items:`, error);
      return -1;
    }
  }

  async loadLibraryItemsVanilla(libraryId, fastLoading = false) {
    if (!this.isAuthenticated) return [];

    const Fields = this.libraryItemFields(fastLoading);
    // const IncludeItemsTypes = ["Audio", "Video", "BoxSet", "Book", "Channel", "Movie", "LiveTvChannel", "Playlist", "Series", "TvChannel"]

    const libraryName = this.libaryNameById(libraryId);
    const librarySize = this.Libraries[libraryName].Count;
    const loadLimit = fastLoading ? librarySize : Math.min(this.searchParams.loadLimit, librarySize);
    const FieldsText = encodeURIComponent(Fields.join(","));
    const IncludeItemsTypesText = encodeURIComponent(this.IncludeItemsTypes.join(","));
    const headers = this.headers;

    this.Libraries[libraryName].Items ??= [];

    for (let startIndex = 0; startIndex < librarySize; startIndex += loadLimit) {
      let ncount = startIndex + loadLimit;
      if (ncount > librarySize)
        ncount = librarySize;
      
      console.log(`Queueing ${libraryName} Items from ${startIndex} to ${ncount} of ${librarySize}`);

      const url = `${this.Server.Address}/Users/${this.User.Id}/Items?SortBy=IndexNumber&Fields=${FieldsText}&ImageTypeLimit=1&EnableImageTypes=Primary&ParentId=${libraryId}&Limit=${loadLimit}&startIndex=${startIndex}&includeItemTypes=${IncludeItemsTypesText}`;

      await new Promise((resolve, reject) => {
        this.fetchQueue.fetch(
          url,
          { method: "GET", headers },
          (data, res) => {
            const items = data.Items || [];

            if (!fastLoading) {

              for (const item of items) {

                if (item.Tags) this.searchParams.Tags.push(...item.Tags.map(t => t.toLowerCase() + '\uFEFF'));
                if (item.Genres) this.searchParams.Genres.push(...item.Genres.map(g => g.toLowerCase() + '\uFEFF'));
                if (item.Studios) this.searchParams.Studios.push(...item.Studios.map(s => s.Name.toLowerCase() + '\uFEFF'));

                this.Libraries[libraryName].Items.push(Jellyfin.toLibraryItem(item));
              }
            } else {
              for (const item of items) {
                this.Libraries[libraryName].Items.push({
                  Id: item.Id,
                  ImageId: item.ImageTags?.Primary,
                  UserData: Jellyfin.pickUserData(item.UserData)
                });
              }
            }
            resolve(); 
          },
          (err) => {
            this.onFetchError(err);
            resolve();
          }
        );
      });
    }

    return this.Libraries[libraryName].Items;
  }

  async updateLibraryUserData(libraryId) {
    if (!this.isAuthenticated) return;
    if (!this.needsUserData)
      return;

    const libraryName = this.libaryNameById(libraryId);
    const library = this.Libraries[libraryName];
    if (!library || !library.Items) {
      console.warn(`Library ${libraryName} not found or has no items.`);
      return;
    }

    const Fields = ["UserData"];
    const FieldsText = encodeURIComponent(Fields.join(","));
    const headers = this.headers;

    const allItems = []

    console.log('Updating UserData for library ' + libraryName + '...')
    

    const url = `${this.Server.Address}/Users/${this.User.Id}/Items?SortBy=IndexNumber&Fields=${FieldsText}&ParentId=${libraryId}`;

    await new Promise((resolve, reject) => {
      this.fetchQueue.fetch(
        url,
        { method: "GET", headers },
        (data, res) => {
          const items = data.Items || [];
          for (const item of items) {
            allItems.push({
              Id: item.Id,
              UserData: Jellyfin.pickUserData(item.UserData)
            });
          }
          resolve();
        },
        (err) => {
          this.onFetchError(err);
          resolve();
        }
      );
    });

    // One lookup per item (a find() per item was O(n²) on large libraries)
    const userDataByKey = new Map(allItems.map(fetchedItem => [Jellyfin.itemKey(fetchedItem.Id), fetchedItem.UserData]));
    library.Items = library.Items.map(existingItem => {
      const updatedUserData = userDataByKey.get(Jellyfin.itemKey(existingItem.Id));
      if (updatedUserData) {
        return { ...existingItem, UserData: updatedUserData };
      }
      return existingItem;
    });

    await this.saveData(this.Server.Id, libraryId, "result", this.Libraries[libraryName]
    );

  }

  makeImageUrl(itemId, width = 480, height = 270, quality = 80) {
    if (!this.isAuthenticated)
      return;
    width = width ? `&fillWidth=${width}` : "&fillWidth=2000";
    height = height ? `&fillHeight=${height}` : "&fillHeight=2000";
    quality = quality ? `&quality=${quality}` : "&quality=100";
    let imageUrl = `${this.Server.Address}/Items/${itemId}/Images/Primary?${width}${height}${quality}`;
    return imageUrl;
  }

  showLoadingLibraries() {

    let container = document.getElementById("loadingLibrariesContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "loadingLibrariesContainer";
      container.style = `
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    `;
      document.body.appendChild(container);
    }

    container.innerHTML = "";

    const loadingLibraries = Object.values(this.Libraries).filter(lib => lib.Status === "Loading...");
    if (loadingLibraries.length === 0) return;

    for (const lib of loadingLibraries) {
      try {
        const progress = Math.min(100, Math.floor((lib.Items.length / lib.Count) * 100));
        const wrapper = document.createElement("div");

        wrapper.className = "loading-lib-bar";
        wrapper.style = `
        background: var(--surface, #1f2937);
        border-radius: 0.5rem;
        padding: 0.5rem 1rem;
        margin-bottom: 0.75rem;
        box-shadow: var(--shadow-lg, 0 4px 10px rgba(0,0,0,0.3));
        width: 300px;
        font-size: 0.85rem;
        color: var(--text-light, #fff);
      `;

        wrapper.innerHTML = `
        <div style="margin-bottom: 0.25rem; font-weight: bold;"></div>
        <div style="background: #2d3748; border-radius: 0.25rem; overflow: hidden; height: 0.5rem;">
          <div style="width: ${progress}%; background: var(--primary, #3b82f6); height: 100%; transition: width 0.3s ease;"></div>
        </div>
      `;

        // The library name comes from the server: shown as text, never parsed as HTML
        wrapper.firstElementChild.textContent = `${lib.Name} — ${lib.Items.length} / ${lib.Count}`;

        container.appendChild(wrapper);
      } catch (error) {}
    }

    if (!this._loadingAnimationFrame) {
      const loop = () => {
        const stillLoading = Object.values(this.Libraries).some(lib => lib.Status === "Loading...");
        if (stillLoading) {
          this.showLoadingLibraries(); 
          this._loadingAnimationFrame = requestAnimationFrame(loop);
        } else {
          this.hideLoadingLibraries();
        }
      };
      this._loadingAnimationFrame = requestAnimationFrame(loop);
    }
  }

  hideLoadingLibraries() {
    const container = document.getElementById("loadingLibrariesContainer");
    if (container) container.remove();

    if (this._loadingAnimationFrame) {
      cancelAnimationFrame(this._loadingAnimationFrame);
      this._loadingAnimationFrame = null;
    }
  }

  async setupMeiliSearch() {
    if(!window.meilisearch) {
      console.warn("Meilisearch library not loaded. Skipping Meilisearch setup.");
      return false;
    }
    await this.checkForMeiliSearch();
    if (!this.Meilisearch.isAvailable)
      return false;
    // The plugin page is public, but its configuration (URL + API key) needs an administrator
    if (!await this.getMeiliSearchApiKey() || !this.Meilisearch.Url) {
      console.warn("Meilisearch plugin found, but its configuration is not available to this user. Using Jellyfin search.");
      this.Meilisearch.isAvailable = false;
      return false;
    }
    this.Meilisearch.client = new meilisearch.Meilisearch({
      host: this.Meilisearch.Url,
      apiKey: this.Meilisearch.ApiKey,
    });

    this.Meilisearch.Index = this.Meilisearch.client.index(this.Meilisearch.IndexName);
    this.Meilisearch.Index.updatePagination({ "maxTotalHits": this.Meilisearch.maxTotalHits });
    // ensure the attributes type is filterable and sortable on the Meilisearch index

    this.searchParams.loadLimit = this.Meilisearch.maxTotalHits;

    const filterable = await this.Meilisearch.Index.getFilterableAttributes();
    const sortable = await this.Meilisearch.Index.getSortableAttributes();
    if (!filterable.includes('path') || !filterable.includes('type')) {
      await this.Meilisearch.Index.updateFilterableAttributes([...[...filterable, 'path', 'type'].filter((item, index, arr) => arr.indexOf(item) === index)]);
      console.log('✅ Added "path" as filterable attribute to Meilisearch index.');
    }
    if (!sortable.includes('path') || !sortable.includes('type')) {
      let newSortable = [...[...sortable, 'path', 'type'].filter((item, index, arr) => arr.indexOf(item) === index)];
      newSortable = newSortable.filter((item, index) => newSortable.indexOf(item) === index);
      await this.Meilisearch.Index.updateSortableAttributes(newSortable);
      console.log('✅ Added "path" as sortable attribute to Meilisearch index.');
    }
    return true;
  }

  async checkForMeiliSearch() {
    const response = await fetch(`${this.Server.Address}/web/configurationpage?name=Meilisearch`, {
      method: "GET",
      headers: {
        authorization: this.headers.authorization,
        "Content-Type": "text/html"
      },
    });
    if (!response.ok)
      return false;

    const text = await response.text();
    if (text.includes("[Meilisearch plugin]")) {
      const idMatch = text.match(/const id = '([^']+)'/);
      if (idMatch && idMatch[1]) {
        this.Meilisearch = {
          ...this.Meilisearch,
          Id: idMatch[1],
          isAvailable: true,
        }
        return true;
      }

    }
    return false;
  }

  async getMeiliSearchApiKey() {
    if (!this.Meilisearch.isAvailable)
      return null;
    const response = await fetch(`${this.Server.Address}/Plugins/${this.Meilisearch.Id}/Configuration`, {
      method: "GET",
      headers: this.headers,
    });
   
    if (!response.ok)
      return null;

    const data = await response.json();
    this.Meilisearch = {...this.Meilisearch, ...data}
    if(this.Meilisearch.IndexName == "")
      this.Meilisearch.IndexName = this.Server.ServerName;
    return this.Meilisearch.ApiKey;
    
  }

}