if (typeof module != 'undefined')
  Controller = require("../../scripts/js/JCGWEB/controller");

class Jellyfin {
  constructor(Host = "http://localhost:8096", Username = "", Pw = "", events = {
    onServerSetupError: () => { },
    onLoginSuccess: () => { },
    onLoginError: () => { },
    onLibraryLoad: () => { },
    onSearchFinish: () => { },
  }, needsUserData = false) {
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
      // People: [],
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
      sortBy: "Name", // Random, Name, OfficialRating, CommunityRating, ProductionYear, PremiereDate
      order: "asc", // asc, desc
    }

    this.currentSearchFilter = null //Will only be set after the first query

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

    // this.searchItems = Controller.wrap(this.searchItems);

    this.regex = {
      title: /^(?<title>.+?)\s+\(\d{4}\)\s+\[.*?=.+?\]/,
      year: /\((?<year>\d{4})\)/,
      id: /\[(?<provider>[a-zA-Z]+id)=(?<id>[a-zA-Z0-9]+)\]/
    }

    this.searchReady = false;
    this.needsUserData = needsUserData;

    this.VirtualFolders = [];

    // Our New Melisearch Integration, for faster queries
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
      } 
    }
    this.init();
  }

  async init() {
    // Get first the public info of the server
    await this.getPublicInfo();
    if (!this.Server.isOnline)
      throw new Error("Server is offline. Please check the address.")

    await this.setFastestAddress();

    // If the server is online, then we can try to login
    if (this.User.Username && this.User.Pw) {
      this.login().then(async () => {
        this.isAuthenticated = true;
        this.updateAuthHeader();
        await this.setupMeiliSearch();
        setTimeout(async () => {
          await this.getLibraries();
        }, 1000);
        this.searchReady = true;
      }).catch(err => console.error(err))
    } else
      throw new Error("Username and password are required for authentication.")
    return;
  }

  UpdateConfig(host, username, password) {
    this.Server.ExternalAddress = this.SanitizeServer(host);
    this.User.Username = username;
    this.User.Pw = password;
    this.init();
  }

  SanitizeServer(server) {
    return (server.endsWith("/") ? server.slice(0, -1) : server).trim()
  }

  onFetchError(response) {
    if (response.status === 401) {
      this.isAuthenticated = false;
      console.error("Authentication failed. Please check your credentials.");
    } else {
      console.error("Fetch error:", response.statusText);
    }
  }

  updateAuthHeader() {
    let TokenBit = this.User.Token ? `, Token="${this.User.Token}"` : "";
    this.headers.authorization = `MediaBrowser Client="${this.Server.Client}", Device="${this.Server.Device}", DeviceId="${this.Name}", Version="${this.Server.Version}"${TokenBit}`;
  }

  openDB(dbName, storeName) {
    return new Promise((resolve, reject) => {
      let db;

      // First check if the store exists
      const checkRequest = indexedDB.open(dbName);
      checkRequest.onsuccess = () => {
        db = checkRequest.result;

        // If store exists, return it
        if (db.objectStoreNames.contains(storeName)) {
          return resolve(db);
        }

        // Store missing → close db and reopen with bump
        const version = db.version + 1;
        db.close();

        const upgradeRequest = indexedDB.open(dbName, version);

        upgradeRequest.onupgradeneeded = (event) => {
          const upgradeDb = event.target.result;
          upgradeDb.createObjectStore(storeName);
        };

        upgradeRequest.onsuccess = () => resolve(upgradeRequest.result);
        upgradeRequest.onerror = () => reject(upgradeRequest.error);
      };

      checkRequest.onerror = () => reject(checkRequest.error);
    });
  }


  async saveData(dbName, storeName, key = "result", data) {
    const db = await this.openDB(dbName, storeName);
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(JSON.stringify(data), key);
    return tx.complete;
  }

  async loadData(dbName, storeName, key = "result") {
    const db = await this.openDB(dbName, storeName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => {
        const result = req.result;
        if (!result) return resolve(null); // Not found
        try {
          resolve(JSON.parse(result));
        } catch (error) {
          console.error("Error decompressing or parsing data:", error);
          resolve(null); // Resolve with null on error
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
    // await this.clearData(this.Server.Id, "People");
    for (const lName in this.Libraries) {
      await this.clearData(this.Server.Id, this.Libraries[lName].Id);
    }
    this.Libraries = {};
    this.areLibrariesLoaded = false;
    this.searchParams = {
      Tags: [],
      Genres: [],
      Studios: [],
      // People: [],
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
      sortBy: "Name", // Random, Name, OfficialRating, CommunityRating, ProductionYear, PremiereDate
      order: "asc", // asc, desc
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
        // Fallback for fetch-level or network errors
        this.onFetchError(error);
        this.events.onServerSetupError(error);
      }

      return null; // Optional: signal failure to caller
    }
  }

  async setFastestAddress() {
    // Check external Address and LocalAddress, to see wich one is reachable, and the fastest
    // do the code
    const controller = new AbortController();
    const signal = controller.signal;
    signal.timeout = 5000;

    const checkAddress = async (address) => {
      try {
        const start = performance.now();
        const response = await fetch(`${address}/System/Info/Public`, { method: "GET", signal: signal }); // 5-second timeout
        if (response.ok) {
          const end = performance.now();
          // send and abort to the signal, so the others that use the same signal stop
          controller.abort();
          return { address, time: end - start, reachable: true };
        }
      } catch (error) {
        // console.warn(`Address ${address} not reachable or timed out:`, error);
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
      this.events.onLoginSuccess(data);
      return data;
    } catch (error) {
      this.isAuthenticated = false;
      this.User.Token = null;
      this.User.Id = null;
      this.updateAuthHeader();
      if (response) {
        this.events.onLoginError(error, response);
        this.onFetchError(error, response);
      } else {
        this.events.onLoginError(error);
        this.onFetchError(error);
      }
    }
  }

  libraryIdByName(name) { // Get the library id by name
    return this.Libraries[name] ? this.Libraries[name].Id : null;
  }

  libaryNameById(id) { // Get the library name by id
    for (const lId in this.Libraries) {
      if (this.Libraries[lId].Id === id)
        return this.Libraries[lId].Name;
    }
    return null;
  }

  async getLibraries() {
    if (!this.isAuthenticated) return;

    // Start a variable, so we can know the time it run
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

    // We get the VirtualFolders here, so we can actually add then to the correct library
    await this.getVirtualFolders();

    this.Libraries = {};
    let toReagroupd = [];


    // Try to load the Tags, Genres, Studios and People
    this.searchParams.Tags = await this.loadData(this.Server.Id, "Tags", "result") || [];
    this.searchParams.Genres = await this.loadData(this.Server.Id, "Genres", "result") || [];
    this.searchParams.Studios = await this.loadData(this.Server.Id, "Studios", "result") || [];
    // this.searchParams.People = await this.loadData(this.Server.Id, "People", "result") || [];

    for (let index = 0; index < data.Items.length; index++) {
      const library = data.Items[index];
      const Count = await this.getLibrarySize(library.Id);
        // if any of the Tags, Genres, Studios or People are empty, this will automatically be added to the updatedLibraries

        // add to library.Locations the info locations from the VirtualFolders where VirtualFolder ItemId is = to library.Id
        if (library.CollectionType == "boxsets") {
          if(!this.Libraries[library.Name])
            continue;
          this.Libraries[library.Name].Status = 'Loaded';
          this.Libraries[library.Name].Count = 0;
          toReagroupd.push(library.Id)
          this.hideLoadingLibraries();
          continue;
        }

        const virtualFolder = this.VirtualFolders.find(vf => vf.ItemId === library.Id);
        if (virtualFolder) {
          library.Locations = virtualFolder.Locations;
        }
        

        try {
          const loadedData = await this.loadData(this.Server.Id, library.Id, "result");
          if (loadedData) {
            if (loadedData.Count == Count && loadedData.Items.length == Count) {
              console.log(`${loadedData.Name} loaded from cache.`)
              this.Libraries[library.Name] = loadedData;
              this.Libraries[library.Name].Status = 'Loaded';
              this.Libraries[library.Name].Count = Count;
              this.Libraries[library.Name].CollectionType = library.CollectionType;
              this.Libraries[library.Name].Type = library.Type;
              this.Libraries[library.Name].Path = library.Path;
              this.Libraries[library.Name].Locations = library.Locations;
              toReagroupd.push(library.Id);
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

        // if Type is boxsets, let's just skip for now
        if (library.CollectionType == "boxsets") {
          this.Libraries[library.Name].Status = 'Loaded';
          this.Libraries[library.Name].Count = 0;
          toReagroupd.push(library.Id)
          this.hideLoadingLibraries();
          continue;
        }

        this.showLoadingLibraries();
        
        this.Libraries[library.Name].Count = Count;
        // return;
        const items = await this.loadLibraryItems(library.Id);
        if (!items || items.length == 0) {
          this.Libraries[library.Name].Status = 'Loading Error';
          continue;
        }
        console.log(`Loaded ${items.length} items from library ${library.Name}`)
        this.Libraries[library.Name].Items = items;
        this.Libraries[library.Name].Count = items.length;

        this.saveData(this.Server.Id, library.Id, "result", this.Libraries[library.Name]);
        this.Libraries[library.Name].Status = 'Loaded';

        if (!toReagroupd.includes(library.Id))
          toReagroupd.push(library.Id);

        // For debug porposes, i only need the first one to run, break it here
        // break;
    }

    // For each getLibraryItemsGroups, runs the getLibraryItemsGroups for Tags, Genres, Studios and People
    // do the loop in getLibraryItemsGroups
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
        // this.getLibraryItemsGroups(libraryId, "People").then(people => {
        //   if(people.length > 0)
        //     this.searchParams.People = this.searchParams.People.concat(...people); 
        // }),
        this.updateLibraryUserData(libraryId),
      ]);
    }

    // Deduplicate & sanitize metadata
    this.searchParams.Tags = [...new Set(this.searchParams.Tags)].sort().eachWordUp();
    this.searchParams.Genres = [...new Set(this.searchParams.Genres)].sort().eachWordUp();
    this.searchParams.Studios = [...new Set(this.searchParams.Studios)].sort().eachWordUp();
    // this.searchParams.People = [...new Set(this.searchParams.People)].sort().eachWordUp();

    // Let's save the Tags, Genres and Studios
    this.saveData(this.Server.Id, "Tags", "result", this.searchParams.Tags);
    this.saveData(this.Server.Id, "Genres", "result", this.searchParams.Genres);
    this.saveData(this.Server.Id, "Studios", "result", this.searchParams.Studios);
    // this.saveData(this.Server.Id, "People", "result", this.searchParams.People);

    this.areLibrariesLoaded = true;
    this.events.onLibraryLoad(data);
    const endTime = performance.now();
    this.hideLoadingLibraries()
    console.log(`All libraries loaded in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
    return data;
  }

  async nextPage() {
    if (!this.searchParams.hasNextPage)
      return;
    this.searchParams.page++;
    this.searchParams.offset = (this.searchParams.page - 1) * this.searchParams.limit;
    return await this.searchItems(null, null, null);
  }

  async previousPage() {
    if (!this.searchParams.hasPreviousPage)
      return;
    this.searchParams.page--;
    this.searchParams.offset = (this.searchParams.page - 1) * this.searchParams.limit;
    return await this.searchItems(null, null, null);
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
    return item.UserData && ((item.UserData.Played) || (item.UserData.PlayedPercentage >= 70) || (item.UserData.PlayCount > 0)) && item.CollectionType != "BoxSet";
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


  async searchItems(Name, library, query) {
    if (!query) {
      query = {}
      if (Name)
        query.Name = Name.trim();
      if (library)
        query.Library = library.trim();
    }


    this.searchParams = { ...this.searchParams, ...query };

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

    // Validate library exists
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

    // If SearchParams has PlayedOnly or UnplayedOnly we will filter by it
    if (this.searchParams.PlayedOnly) {
      items = items.filter(this.isPlayed);
    } else if (this.searchParams.UnplayedOnly) {
      items = items.filter(item => !this.isPlayed(item));
    }

    items = await searchInArray(items, this.searchParams.Name)

    // Sort items
    const sortKey = this.searchParams.sortBy;
    if (sortKey === "Random") {
      items = items.sort(() => 0.5 - Math.random());
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

        // fallback
        return 0;
      });
    }

    this.searchParams.hasPreviousPage = this.hasPreviousPage();
    this.searchParams.hasNextPage = this.hasNextPage(items);

    items = items.slice(this.searchParams.offset, this.searchParams.offset + this.searchParams.limit);

    this.events.onSearchFinish(items)
    return items;
  }

  async refreshItem(item, Recursive = true, ImageRefreshMode = "Default", MetadataRefreshMode = "Default", ReplaceAllImages = false, RegenerateTrickplay = false, ReplaceAllMetadata = false) {
    if (!this.isAuthenticated) {
      console.warn("Not authenticated. Cannot refresh item.");
      return null;
    }
    try {
      const response = await fetch(`${this.Server.Address}/Items/${item.Id}/Refresh?Recursive=${Recursive}&ImageRefreshMode=${ImageRefreshMode}&MetadataRefreshMode=${MetadataRefreshMode}&ReplaceAllImages=${ReplaceAllImages}&RegenerateTrickplay=${RegenerateTrickplay}&ReplaceAllMetadata=${ReplaceAllMetadata}`, {
        method: "POST", // Changed to POST as per the provided curl example
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
      People: p => (p.Name?.toLowerCase() || p.toLowerCase()) + '\uFEFF',
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

  async loadLibraryItems(libraryId, fastLoading = false) {
    if (this.Meilisearch.isAvailable) {
      return await this.loadLibraryItemsMeiliSearch(libraryId, fastLoading);
    } else {
      return await this.loadLibraryItemsVanilla(libraryId, fastLoading);
    }
    
  }

  async loadLibraryItemsMeiliSearch(libraryId, fastLoading = false) {
    if (!this.isAuthenticated || !this.Meilisearch?.isAvailable) return [];

    const libraryName = this.libaryNameById(libraryId);
    const library = this.Libraries[libraryName];
    if (!library || !library.Locations?.length) {
      console.warn(`Library ${libraryName} has no locations, skipping MeiliSearch load.`);
      return [];
    }

    const index = this.Meilisearch.Index;
    let loadLimit = this.searchParams.loadLimit;
    if (loadLimit)
      loadLimit = loadLimit * 4
    else
      loadLimit = 1000;

    if (loadLimit > 1000)
      loadLimit = 1000; //Meilisearch 1000 rows Cap

    // Ensure Items container exists
    this.Libraries[libraryName].Items ??= [];
    this.Libraries[libraryName].Items.length = 0;

    console.log(`🔎 Loading ${libraryName} items via MeiliSearch...`);

    // --- Build the STARTS WITH filters dynamically from library.Locations
    const startsWithFilters = library.Locations
      .map(loc => `(path STARTS WITH "${loc}")`)
      .join(" OR ");

    const typeFilter = `type = "${this.Meilisearch.TypeMap[library.CollectionType] || 'MediaBrowser.Controller.Entities.TV.Series'}"`;
    const finalFilter = `(${typeFilter}) AND (${startsWithFilters})`;

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

      // Log where a message, so we know, the offset and the amount to load
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

          // Collect metadata for filters (Genres, Studios, Tags)
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

      if (hits.length < loadLimit) {
        console.log('THIS BROKE HERE')
        break
      } // ✅ finished pagination
      offset += loadLimit;
    }

    console.log(`✅ Loaded ${this.Libraries[libraryName].Items.length} items from MeiliSearch for ${libraryName}`);

    return this.Libraries[libraryName].Items;
  }


  async loadLibraryItemsVanilla(libraryId, fastLoading = false) {
    if (!this.isAuthenticated) return [];

    const Fields = ["OriginalTitle"];
    const IncludeItemsTypes = ["Audio", "Video", "BoxSet", "Book", "Channel", "Movie", "LiveTvChannel", "Playlist", "Series", "TvChannel"]

    if (!fastLoading)
      Fields.push(...[
        // "People", //This is way to heavy, take so much time
        "Overview", "Genres", "Studios", "Tags",
        // "DateLastMediaAdded", "RecursiveItemCount", "ChildCount",
        // "MediaSources", "MediaSourceCount",
        "ParentId", "Path"
      ])
      

    const libraryName = this.libaryNameById(libraryId);
    const librarySize = this.Libraries[libraryName].Count;
    const loadLimit = fastLoading ? librarySize : Math.min(this.searchParams.loadLimit, librarySize);
    const FieldsText = encodeURIComponent(Fields.join(","));
    const IncludeItemsTypesText = encodeURIComponent(IncludeItemsTypes.join(","));
    const headers = this.headers;

    // Ensure fresh container
    this.Libraries[libraryName].Items ??= [];

    // const pendingFetches = [];

    for (let startIndex = 0; startIndex < librarySize; startIndex += loadLimit) {
      let ncount = startIndex + loadLimit;
      if (ncount > librarySize)
        ncount = librarySize;
      
      console.log(`Queueing ${libraryName} Items from ${startIndex} to ${ncount} of ${librarySize}`);

      const url = `${this.Server.Address}/Users/${this.User.Id}/Items?SortBy=IndexNumber&Fields=${FieldsText}&ImageTypeLimit=1&EnableImageTypes=Primary&ParentId=${libraryId}&Limit=${loadLimit}&startIndex=${startIndex}&includeItemTypes=${IncludeItemsTypesText}`;

      // Wrap each fetch task into a Promise to await later
      // const p = new Promise((resolve, reject) => {
      await new Promise((resolve, reject) => {
        this.fetchQueue.fetch(
          url,
          { method: "GET", headers },
          (data, res) => {
            const items = data.Items || [];

            if (!fastLoading) {

              for (const item of items) {

                // ⛏️ Extract metadata while mutating searchParams
                if (item.Tags) this.searchParams.Tags.push(...item.Tags.map(t => t.toLowerCase() + '\uFEFF'));
                if (item.Genres) this.searchParams.Genres.push(...item.Genres.map(g => g.toLowerCase() + '\uFEFF'));
                if (item.Studios) this.searchParams.Studios.push(...item.Studios.map(s => s.Name.toLowerCase() + '\uFEFF'));
                if (item.People) this.searchParams.People.push(...item.People.map(p => p.Name.toLowerCase() + '\uFEFF'));

                this.Libraries[libraryName].Items.push({
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
                  People: item.People,
                  Overview: item.Overview,
                  Type: item.Type,
                  ItemsCount: item.RecursiveItemCount || item.ChildCount || item.MediaSources?.length,
                  UserData: {
                    IsFavorite: item.UserData?.IsFavorite,
                    Played: item.UserData?.Played,
                    PlayCount: item.UserData?.PlayCount,
                    LastPlayedDate: item.UserData?.LastPlayedDate
                  },
                  ParentId: item.ParentId,
                  Path: item.Path,
                  originalData: item
                });
              }
            } else {
              for (const item of items) {
                this.Libraries[libraryName].Items.push({
                  Id: item.Id,
                  ImageId: item.ImageTags?.Primary,
                  UserData: {
                    IsFavorite: item.UserData?.IsFavorite,
                    Played: item.UserData?.Played,
                    PlayCount: item.UserData?.PlayCount,
                    LastPlayedDate: item.UserData?.LastPlayedDate
                  }
                });
              }
            }
            resolve(); // ✅ Resolve this page
          },
          (err) => {
            this.onFetchError(err);
            resolve(); // Still resolve to allow others to complete
          }
        );
      });

      // pendingFetches.push(p);
    }

    // ⏳ Wait all paginated fetch tasks to complete
    // await Promise.all(pendingFetches);
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
    // const pendingFetches = [];

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
              UserData: {
                IsFavorite: item.UserData?.IsFavorite,
                Played: item.UserData?.Played,
                PlayCount: item.UserData?.PlayCount,
                LastPlayedDate: item.UserData?.LastPlayedDate
              }
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
    // pendingFetches.push(p);
    // await Promise.all(pendingFetches);

    // Update the UserData for each item in the library
    library.Items = library.Items.map(existingItem => {
      const updatedUserData = allItems.find(fetchedItem => fetchedItem.Id === existingItem.Id);
      if (updatedUserData) {
        return { ...existingItem, UserData: updatedUserData.UserData };
      }
      return existingItem;
    });

    // Save the updated library data back to IndexedDB
    await this.saveData(this.Server.Id, libraryId, "result", this.Libraries[libraryName]
    );

  }

  makeImageUrl(itemId, width = 480, height = 270, quality = 80) { // Make the image url
    if (!this.isAuthenticated)
      return;
    width = width ? `&fillWidth=${width}` : "&fillWidth=2000";
    height = height ? `&fillHeight=${height}` : "&fillHeight=2000";
    quality = quality ? `&quality=${quality}` : "&quality=100";
    let imageUrl = `${this.Server.Address}/Items/${itemId}/Images/Primary?${width}${height}${quality}`;
    return imageUrl;
  }

  showLoadingLibraries() {
    // Create container if it doesn't exist
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

    container.innerHTML = ""; // Clear existing

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
        <div style="margin-bottom: 0.25rem; font-weight: bold;">
          ${lib.Name} — ${lib.Items.length} / ${lib.Count}
        </div>
        <div style="background: #2d3748; border-radius: 0.25rem; overflow: hidden; height: 0.5rem;">
          <div style="width: ${progress}%; background: var(--primary, #3b82f6); height: 100%; transition: width 0.3s ease;"></div>
        </div>
      `;

        container.appendChild(wrapper);
      } catch (error) {}
    }

    // 🌀 Loop to auto-refresh until done
    if (!this._loadingAnimationFrame) {
      const loop = () => {
        const stillLoading = Object.values(this.Libraries).some(lib => lib.Status === "Loading...");
        if (stillLoading) {
          this.showLoadingLibraries(); // Recursively refresh
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
    await this.getMeiliSearchApiKey();
    this.Meilisearch.client = new meilisearch.Meilisearch({
      host: this.Meilisearch.Url,
      apiKey: this.Meilisearch.ApiKey,
    });

    this.Meilisearch.Index = this.Meilisearch.client.index(this.Meilisearch.IndexName);
    this.Meilisearch.Index.updatePagination({ "maxTotalHits": 20000 });

    const filterable = await this.Meilisearch.Index.getFilterableAttributes();
    const sortable = await this.Meilisearch.Index.getSortableAttributes();
    if (!filterable.includes('path')) {
      await this.Meilisearch.Index.updateFilterableAttributes([...filterable, 'path']);
      console.log('✅ Added "path" as filterable attribute to Meilisearch index.');
    }
    if (!sortable.includes('path') || !sortable.includes('type')) {
      let newSortable = [...sortable, 'path', 'type']
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