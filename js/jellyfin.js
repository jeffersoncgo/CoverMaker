if (typeof module != 'undefined')
  Controller = require("../../scripts/js/JCGWEB/controller");

class Jellyfin {
  constructor(Host = "http://localhost:8096", Username = "", Pw = "", events = {
    onServerSetupError: () => {},
    onLoginSuccess: () => {},
    onLoginError: () => {},
    onLibraryLoad: () => {},
    onSearchFinish: () => {},
  }) {
    const defaultEvents = {
      onServerSetupError: () => {},
      onLoginSuccess: () => {},
      onLoginError: () => {},
      onLibraryLoad: () => {},
      onSearchFinish: () => {},
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
      offset: 0,
      page: 1,
      hasNextPage: true,
      sortBy: "Name", // Random, Name, OfficialRating, CommunityRating, ProductionYear, PremiereDate
      order: "asc", // asc, desc
    }

    this.currentSearchFilter = null //Will only be set after the first query

    this.Libraries = {}

    this.areLibrariesLoaded = false;

    this.isAuthenticated = false;
    this.Name = "jellyfin-splashmaker";
    this.events = events;

    this.Controller = new Controller(this.searchItems.bind(this));
    this.searchItems = this.Controller;
    this.searchItems = this.searchItems.exec.bind(this.searchItems);
    this.searchItems.Controller = this.Controller;
    this.init()
  }

  async init() {
    // Get first the public info of the server
    await this.getPublicInfo();
    if (!this.Server.isOnline)
      return console.error("Server is offline. Please check the address.");

    // If the server is online, then we can try to login
    if (this.User.Username && this.User.Pw) {
      let login = await this.login();
      if (login) {
        this.isAuthenticated = true;
        this.updateAuthHeader();
        await this.getLibraries()
      }
    } else
      return console.error("Username and password are required for authentication.");
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
    this.searchParamsToRestore = {...this.searchParams}
  }

  restoreSearchParams() {
    this.searchParams = {...this.searchParamsToRestore}
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
        this.events.onLoginError(response);
        this.onFetchError(response);
      } else {
        this.events.onLoginError(error);
        this.onFetchError(error);
      }
    }
  }

  libraryIdByName(name) { // Get the library id by name
    return this.Libraries[name] ? this.Libraries[name].Id : null;
  }

  async getLibraries() { // Get the available libraries for the user
    if (!this.isAuthenticated)
      return;
    let response = await fetch(`${this.Server.ExternalAddress}/UserViews?userId=${this.User.Id}`, {
      method: "GET",
      headers: this.headers,
    });
    if (response.ok) {
      let data = await response.json();
      this.Libraries = {}

      const promises = data.Items.map(async library => {
        const items = await this.loadLibraryItems(library.Id);

        this.Libraries[library.Name] = {
          Id: library.Id,
          Name: library.Name,
          ImageId: library.ImageTags?.Primary,
          Items: items,
          Count: items.length
        };
      });

      await Promise.all(promises); 

      // Remove duplicated, empty and repeated tags
      this.searchParams.Tags = [...new Set(this.searchParams.Tags)].sort();
      this.searchParams.Genres = [...new Set(this.searchParams.Genres)].sort();
      this.searchParams.Studios = [...new Set(this.searchParams.Studios)].sort();

      this.areLibrariesLoaded = true;
      this.events.onLibraryLoad(data);
      return data;
    } else {
      this.onFetchError(response);
    }
  }

  async nextPage() {
    if(!this.searchParams.hasNextPage)
      return;
    this.searchParams.page++;
    this.searchParams.offset = (this.searchParams.page - 1) * this.searchParams.limit;
    return await this.searchItems(null, null, null);
  }

  async previousPage() {
    if(!this.searchParams.hasPreviousPage)
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

  async loadLibraryItems(libraryId) { // Get the items in a specific library
    if (!this.isAuthenticated)
      return;
      const Fields = [
        "PrimaryImageAspectRatio",
        "Genres",
        "Overview",
        // "People", //Is too slow
        "Studios",
        "Tags",
      ]
    const FieldsText = encodeURIComponent(Fields.join(","))
    let response = await fetch(`${this.Server.ExternalAddress}/Users/${this.User.Id}/Items?SortBy=Random&Fields=${FieldsText}&ImageTypeLimit=1&EnableImageTypes=Primary&ParentId=${libraryId}`, {
      method: "GET",
      headers: this.headers,
    });
    if (response.ok) {
      let data = await response.json();
      return data.Items.map(item => {
        this.searchParams.Tags.push(...item.Tags);
        this.searchParams.Genres.push(...item.Genres);
        this.searchParams.Studios.push(...item.Studios);
        // this.searchParams.People.push(...item.People);
        return {
          Id: item.Id, //c07c4089d60376701fc62e3fe008cdcc
          Name: item.Name, //Contatos de 4º Grau
          ImageId: item.ImageTags.Primary, //17113beff6c0842baced46c6541baea5
          PremiereDate: item.PremiereDate, //2009-11-05T00:00:00.0000000Z
          OfficialRating: item.OfficialRating, //16
          CommunityRating: item.CommunityRating, //6.3
          ProductionYear: item.ProductionYear, //2009
          Genres: item.Genres,
          Studios: item.Studios,
          Tags: item.Tags,
          Overview: item.Overview,
          // People: item.People,
        };
      });
  } else {
      this.onFetchError(response);
      return []
    }
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
}