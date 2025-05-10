const axios = require("axios");

// Wialon API configuration
const WIALON_API_URL = "https://hst-api.wialon.eu/wialon/ajax.html";
const WIALON_TOKEN = process.env.WIALON_TOKEN;

let sessionId = null;

const axiosInstance = axios.create({
  baseURL: WIALON_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const wialonServices = {
  // Login to get a session ID
  login: async () => {
    try {
      const response = await axios.post(
        `${WIALON_API_URL}?svc=token/login&params={"token":"${WIALON_TOKEN}"}`,
        {},
      );

      if (response.data && response.data.eid) {
        sessionId = response.data.eid;
        console.log("Successfully logged in, session ID:", sessionId);
        return sessionId;
      } else {
        throw new Error("Failed to retrieve session ID");
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  // Make an API request with automatic session renewal
  makeRequest: async (service, params) => {
    // If no session exists, login first
    if (!sessionId) {
      console.error("Session ID is missing");
      await wialonServices.login();
    }

    // Make the request with the current session ID
    const url = `${WIALON_API_URL}?svc=${service}&params=${JSON.stringify(params)}&sid=${sessionId}`;
    const response = await axios.post(url, {});

    // Check if the response indicates an expired session
    if (response.data && response.data.error === 1) {
      console.log("Session expired, logging in again...");
      // Login again to get a new session ID
      await wialonServices.login();

      // Retry the request with the new session ID
      const retryUrl = `${WIALON_API_URL}?svc=${service}&params=${JSON.stringify(params)}&sid=${sessionId}`;
      const retryResponse = await axios.post(retryUrl, {});
      return retryResponse.data;
    }

    return response.data;
  },

  // Search item by ID
  searchItemById: async ({ itemId, flags = 256 } = {}) => {
    return wialonServices.makeRequest("core/search_item", {
      id: itemId,
      flags,
    });
  },

  searchItems: async (
    {
      spec = {
        itemsType: "avl_unit",
        propName: "sys_name",
        propValueMask: "*",
        sortType: "sys_name",
      },
      force = 1,
      flags = 1025,
      from = 0,
      to = 0,
    } = {
      spec: {
        itemsType: "avl_unit",
        propName: "sys_name",
        propValueMask: "*",
        sortType: "sys_name",
      },
      force: 1,
      flags: 1025,
      from: 0,
      to: 0,
    },
  ) => {
    return wialonServices.makeRequest("core/search_items", {
      spec,
      force,
      flags,
      from,
      to,
    });
  },
};

module.exports = wialonServices;
