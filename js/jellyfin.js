if (typeof module != 'undefined')
  Controller = require("../../scripts/js/JCGWEB/controller");

class Jellyfin {
  constructor(Host = "http://localhost:8096", Username = "", Pw = "", events = {
    onServerSetupError: () => { },
    onLoginSuccess: () => { },
    onLoginError: () => { },
    onLibraryLoad: () => { },
    onSearchFinish: () => { },
  }) {
    const defaultEvents = {
      onServerSetupError: () => { },
      onLoginSuccess: () => { },
      onLoginError: () => { },
      onLibraryLoad: () => { },
      onSearchFinish: () => { },
    }
    events = { ...defaultEvents, ...events };
    this.Server = {
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
      "Accept": "application/json",
      "authorization": "",
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
      People: [],
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

    this.regex = {
      title: /^(?<title>.+?)\s+\(\d{4}\)\s+\[.*?=.+?\]/,
      year: /\((?<year>\d{4})\)/,
      id: /\[(?<provider>[a-zA-Z]+id)=(?<id>[a-zA-Z0-9]+)\]/
    }
    this.init()
  }

  async init() {
    // Get first the public info of the server
    await this.getPublicInfo();
    if (!this.Server.isOnline)
      throw new Error("Server is offline. Please check the address.")

    // If the server is online, then we can try to login
    if (this.User.Username && this.User.Pw) {
      this.login().then(async () => {
        this.isAuthenticated = true;
        this.updateAuthHeader();
        await this.getLibraries()
      }).catch(err => console.error(err))
    } else
      throw new Error("Username and password are required for authentication.")
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
    await this.clearData(this.Server.Id, "People");
    for (const lName in this.Libraries) {
      await this.clearData(this.Server.Id, this.Libraries[lName].Id);
    }
    this.Libraries = {};
    this.areLibrariesLoaded = false;
    this.searchParams = {
      Tags: [],
      Genres: [],
      Studios: [],
      People: [],
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

  backupSearchParams() {
    this.searchParamsToRestore = { ...this.searchParams }
  }

  restoreSearchParams() {
    this.searchParams = { ...this.searchParamsToRestore }
  }

  async login() {
    let response;
    try {
      response = await fetch(`${this.Server.ExternalAddress}/Users/AuthenticateByName`, {
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
    const response = await fetch(`${this.Server.ExternalAddress}/UserViews?userId=${this.User.Id}`, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      this.onFetchError(response);
      return;
    }

    const data = await response.json();
    this.Libraries = {};

    let toReagroupd = [];

    // Try to load the Tags, Genres, Studios and People
    this.searchParams.Tags = await this.loadData(this.Server.Id, "Tags", "result") || [];
    this.searchParams.Genres = await this.loadData(this.Server.Id, "Genres", "result") || [];
    this.searchParams.Studios = await this.loadData(this.Server.Id, "Studios", "result") || [];
    this.searchParams.People = await this.loadData(this.Server.Id, "People", "result") || [];

    const promises = data.Items.map(async (library) => {
      const Count = await this.getLibrarySize(library.Id);
      // if any of the Tags, Genres, Studios or People are empty, this will automatically be added to the updatedLibraries

      try {
        const loadedData = await this.loadData(this.Server.Id, library.Id, "result");
        if (loadedData) {
          if (loadedData.Count == Count && loadedData.Items.length == Count) {
            console.log(`${loadedData.Name} loaded from cache.`)
            this.Libraries[library.Name] = loadedData;
            this.Libraries[library.Name].Status = 'Loaded';
            this.Libraries[library.Name].Count = Count;
            toReagroupd.push(library.Id);
            return loadedData;
          }
        }
      } catch (error) { }

      if (!this.isLibrarySizeChanged(library.Id, Count))
        return this.Libraries[library.Name];

      this.Libraries[library.Name] = {
        Id: library.Id,
        Name: library.Name,
        ImageId: library.ImageTags?.Primary,
        Items: [],
        Count: 0,
        Status: 'Loading...'
      };

      this.showLoadingLibraries();

      this.Libraries[library.Name].Count = Count;
      const items = await this.loadLibraryItems(library.Id); //.then((items) => {
      if (!items || items.length == 0)
        return this.Libraries[library.Name].Status = 'Loading Error'
      console.log(`Loaded ${items.length} items from library ${library.Name}`)
      this.Libraries[library.Name].Items = items;
      this.Libraries[library.Name].Count = items.length;

      this.saveData(this.Server.Id, library.Id, "result", this.Libraries[library.Name]);
      this.Libraries[library.Name].Status = 'Loaded';

      if (!toReagroupd.includes(library.Id))
        toReagroupd.push(library.Id);
      return this.Libraries[library.Name];
    });

    await Promise.all(promises);

    // For each getLibraryItemsGroups, runs the getLibraryItemsGroups for Tags, Genres, Studios and People
    // do the loop in getLibraryItemsGroups
    for (const libraryId of toReagroupd) {
      await Promise.all([
        this.getLibraryItemsGroups(libraryId, "Tags").then(tags => this.searchParams.Tags.push(...tags.flat())),
        this.getLibraryItemsGroups(libraryId, "Genres").then(genres => this.searchParams.Genres.push(...genres.flat())),
        this.getLibraryItemsGroups(libraryId, "Studios").then(studios => this.searchParams.Studios.push(...studios.flat())),
        this.getLibraryItemsGroups(libraryId, "People").then(people => this.searchParams.People.push(...people.flat())),
        this.updateLibraryUserData(libraryId),
      ]);
    }

    // Deduplicate & sanitize metadata
    this.searchParams.Tags = [...new Set(this.searchParams.Tags)].sort().eachWordUp();
    this.searchParams.Genres = [...new Set(this.searchParams.Genres)].sort().eachWordUp();
    this.searchParams.Studios = [...new Set(this.searchParams.Studios)].sort().eachWordUp();
    this.searchParams.People = [...new Set(this.searchParams.People)].sort().eachWordUp();

    // Let's save the Tags, Genres and Studios
    this.saveData(this.Server.Id, "Tags", "result", this.searchParams.Tags);
    this.saveData(this.Server.Id, "Genres", "result", this.searchParams.Genres);
    this.saveData(this.Server.Id, "Studios", "result", this.searchParams.Studios);
    this.saveData(this.Server.Id, "People", "result", this.searchParams.People);

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
    this.Controller.startDelayMs = delay;
  }

  isPlayed(item) {
    return item.UserData && ((item.UserData.Played) || (item.UserData.PlayedPercentage >= 70) || (item.UserData.PlayCount > 0)) && item.Type != "BoxSet";
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
      const response = await fetch(`${this.Server.ExternalAddress}/Items/${item.Id}/Refresh?Recursive=${Recursive}&ImageRefreshMode=${ImageRefreshMode}&MetadataRefreshMode=${MetadataRefreshMode}&ReplaceAllImages=${ReplaceAllImages}&RegenerateTrickplay=${RegenerateTrickplay}&ReplaceAllMetadata=${ReplaceAllMetadata}`, {
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
      People: p => p.Name.toLowerCase() + '\uFEFF',
      Studios: s => s.Name.toLowerCase() + '\uFEFF',
      Genres: g => g.toLowerCase() + '\uFEFF',
      Tags: t => t.toLowerCase() + '\uFEFF',
    }

    const f = functions[GroupName];

    return library.Items.map(item => item[GroupName]?.map(f));
  }

  async getLibrarySize(libraryId) {
    if (!this.isAuthenticated)
      return;
    //https://flik.jcgweb.com.br/Users/33b0af0c69d54da3aac45eb12f635a4e/Items?ParentId=af92f2d68eea947c7f9df41836afb987&Limit=0
    let response = await fetch(`${this.Server.ExternalAddress}/Users/${this.User.Id}/Items?ParentId=${libraryId}&Limit=0`, {
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

  async loadLibraryItems(libraryId, fastLoading = false) {
    if (!this.isAuthenticated) return [];

    const Fields = ["OriginalTitle"];

    if (!fastLoading)
      Fields.push(...[
        "Overview", "Genres", "People", "Studios", "Tags",
        "DateLastMediaAdded", "RecursiveItemCount", "ChildCount",
        "MediaSources", "MediaSourceCount"
      ])

    const libraryName = this.libaryNameById(libraryId);
    const librarySize = this.Libraries[libraryName].Count;
    const loadLimit = fastLoading ? librarySize : Math.min(this.searchParams.loadLimit, librarySize);
    const FieldsText = encodeURIComponent(Fields.join(","));
    const headers = this.headers;

    // Ensure fresh container
    // this.Libraries[libraryName].Items = [];
    const allItems = []

    const pendingFetches = [];

    for (let startIndex = 0; startIndex < librarySize; startIndex += loadLimit) {
      console.log(`Queueing ${libraryName} Items from ${startIndex} to ${startIndex + loadLimit}`);

      const url = `${this.Server.ExternalAddress}/Users/${this.User.Id}/Items?SortBy=IndexNumber&Fields=${FieldsText}&ImageTypeLimit=1&EnableImageTypes=Primary&ParentId=${libraryId}&Limit=${loadLimit}&startIndex=${startIndex}`;

      // Wrap each fetch task into a Promise to await later
      const p = new Promise((resolve, reject) => {
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

                allItems.push({
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
                  originalData: item
                });
              }
            } else {
              for (const item of items) {
                allItems.push({
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

      pendingFetches.push(p);
    }

    // ⏳ Wait all paginated fetch tasks to complete
    await Promise.all(pendingFetches);
    return allItems;
  }

  async updateLibraryUserData(libraryId) {
    if (!this.isAuthenticated) return;
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
    const pendingFetches = [];

    console.log('Updating UserData for library ' + libraryName + '...')
    

    const url = `${this.Server.ExternalAddress}/Users/${this.User.Id}/Items?SortBy=IndexNumber&Fields=${FieldsText}&ParentId=${libraryId}`;

    const p = new Promise((resolve, reject) => {
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
    pendingFetches.push(p);
    await Promise.all(pendingFetches);

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
    let imageUrl = `${this.Server.ExternalAddress}/Items/${itemId}/Images/Primary?${width}${height}${quality}`;
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


}