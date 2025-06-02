// services/vehicleTrackingService.js
const axios = require("axios");
const Vehicle = require("../models/vehicleModel"); // Ajustez le chemin
const wialonServices = require("../helpers/iotHelper");
const { computeFuelValue, getSensorByP } = require("../helpers/iotModule");

class VehicleTrackingService {
  constructor() {
    this.influxConfig = {
      host: process.env.INFLUX_HOST,
      token: process.env.INFLUX_TOKEN,
      database: process.env.INFLUX_DATABASE,
    };

    this.headers = {
      Authorization: `Bearer ${this.influxConfig.token}`,
      "Content-Type": "text/plain",
    };

    // Stocker les intervals de tracking actifs
    this.activeTrackings = new Map();

    // Initialiser la base de données au démarrage
    this.initializeDatabase();
  }

  // Initialiser la base de données InfluxDB
  async initializeDatabase() {
    try {
      await axios.post(
        `${this.influxConfig.host}/api/v3/configure/database`,
        { db: this.influxConfig.database },
        {
          headers: {
            ...this.headers,
            "Content-Type": "application/json",
          },
        },
      );
      console.log(`✅ InfluxDB database '${this.influxConfig.database}' ready`);
    } catch (error) {
      if (error.response?.status !== 409) {
        // 409 = déjà existe
        console.error(
          "❌ Error initializing InfluxDB database:",
          error.response?.data || error.message,
        );
      } else {
        console.log(
          `ℹ️  InfluxDB database '${this.influxConfig.database}' already exists`,
        );
      }
    }
  }

  // Récupérer les données du véhicule depuis l'API Wialon (version simplifiée)
  async fetchVehicleData(vehicleId) {
    try {
      const vehicle = await Vehicle.findById(vehicleId);

      if (!vehicle?.tracking?.id) {
        throw new Error(`Vehicle ${vehicleId} has no tracking ID`);
      }

      const dataPos = await wialonServices.searchItemById({
        itemId: vehicle.tracking.id,
        flags: 4294967295,
      });

      if (dataPos.error) {
        throw new Error("Error fetching vehicle data from Wialon");
      }

      // Utiliser vos fonctions existantes pour calculer la température
      const tempRaw = dataPos?.item?.prms?.io_26?.v;
      const tempSensor = getSensorByP(dataPos?.item?.sens, "io_26*const10");

      // Utiliser vos fonctions existantes pour calculer le carburant
      const fuelRaw = dataPos?.item?.prms?.io_273?.v;
      const fuelSensor = getSensorByP(dataPos?.item?.sens, "io_273");
      const fuelValue =
        fuelRaw !== undefined &&
        fuelSensor?.tbl &&
        Array.isArray(fuelSensor.tbl)
          ? computeFuelValue(fuelRaw, fuelSensor.tbl)
          : fuelRaw;

      // Extraire seulement les données nécessaires pour le tracking
      const trackingData = {
        id: vehicle.id,
        tracking: vehicle.tracking,
        pos: {
          lat: dataPos?.item?.pos?.y,
          lng: dataPos?.item?.pos?.x,
          speed: dataPos?.item?.pos?.s || 0,
        },
        temp: {
          value: tempRaw !== undefined ? tempRaw * 10 : null,
          unit: tempSensor?.m || "°C",
        },
        active:
          dataPos?.item?.prms?.io_239?.v !== null
            ? dataPos.item.prms.io_239.v === 1
            : null,
        fuel: {
          value: fuelValue,
          unit: fuelSensor?.m || "l",
        },
      };

      return trackingData;
    } catch (error) {
      console.error(
        `Error fetching vehicle data for ${vehicleId}:`,
        error.message,
      );
      throw error;
    }
  }

  // Sauvegarder une position dans InfluxDB
  async saveVehiclePosition(vehicleData, deliveryId = null) {
    try {
      const timestamp = Date.now() * 1000000; // nanoseconds
      const plate = vehicleData.tracking.plate.replace(/\s/g, "_");

      // Construire la ligne de données avec delivery_id optionnel
      let tags = `vehicle_id=${vehicleData.id},plate=${plate},tracking_id=${vehicleData.tracking.id}`;
      if (deliveryId) {
        tags += `,delivery_id=${deliveryId}`;
      }

      const fields = `lat=${vehicleData.pos.lat || 0},lng=${vehicleData.pos.lng || 0},speed=${vehicleData.pos.speed || 0},fuel_value=${vehicleData.fuel.value || 0},temp_value=${vehicleData.temp.value || 0},active=${vehicleData.active || false}`;

      const lineProtocol = `vehicle_position,${tags} ${fields} ${timestamp}`;

      await axios.post(
        `${this.influxConfig.host}/api/v3/write_lp?db=${this.influxConfig.database}`,
        lineProtocol,
        { headers: this.headers },
      );

      console.log(
        `📍 Position saved for vehicle ${vehicleData.tracking.plate} ${deliveryId ? `(delivery: ${deliveryId})` : ""}`,
      );
      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error(
        "❌ Error saving vehicle position:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Démarrer le tracking d'une livraison
  async startDeliveryTracking(deliveryId, vehicleId, intervalSeconds = 30) {
    try {
      console.log(
        `🚚 Starting tracking for delivery ${deliveryId} (vehicle: ${vehicleId}) every ${intervalSeconds}s`,
      );

      // Vérifier que le tracking n'est pas déjà actif
      if (this.activeTrackings.has(deliveryId)) {
        console.log(`⚠️  Tracking already active for delivery ${deliveryId}`);
        return { success: false, message: "Tracking already active" };
      }

      // Premier enregistrement immédiat
      try {
        const initialData = await this.fetchVehicleData(vehicleId);
        await this.saveVehiclePosition(initialData, deliveryId);
      } catch (error) {
        console.warn(`⚠️  Initial position save failed: ${error.message}`);
      }

      // Configurer l'intervalle de tracking
      const intervalId = setInterval(async () => {
        try {
          const vehicleData = await this.fetchVehicleData(vehicleId);
          await this.saveVehiclePosition(vehicleData, deliveryId);
        } catch (error) {
          console.error(
            `❌ Tracking error for delivery ${deliveryId}:`,
            error.message,
          );
          // Ne pas arrêter le tracking pour une erreur ponctuelle
        }
      }, intervalSeconds * 1000);

      // Stocker l'interval pour pouvoir l'arrêter plus tard
      this.activeTrackings.set(deliveryId, {
        intervalId,
        vehicleId,
        startTime: new Date(),
        intervalSeconds,
      });

      console.log(`✅ Tracking started for delivery ${deliveryId}`);
      return {
        success: true,
        message: "Tracking started",
        trackingInfo: {
          deliveryId,
          vehicleId,
          intervalSeconds,
          startTime: new Date(),
        },
      };
    } catch (error) {
      console.error(`❌ Error starting delivery tracking:`, error.message);
      throw error;
    }
  }

  // Arrêter le tracking d'une livraison
  async stopDeliveryTracking(deliveryId) {
    try {
      const trackingInfo = this.activeTrackings.get(deliveryId);

      if (!trackingInfo) {
        console.log(`⚠️  No active tracking found for delivery ${deliveryId}`);
        return { success: false, message: "No active tracking found" };
      }

      // Arrêter l'intervalle
      clearInterval(trackingInfo.intervalId);

      // Supprimer de la liste des trackings actifs
      this.activeTrackings.delete(deliveryId);

      const duration = Math.round(
        (Date.now() - trackingInfo.startTime.getTime()) / 1000,
      );
      console.log(
        `🛑 Tracking stopped for delivery ${deliveryId} (duration: ${duration}s)`,
      );

      return {
        success: true,
        message: "Tracking stopped",
        duration: duration,
      };
    } catch (error) {
      console.error(`❌ Error stopping delivery tracking:`, error.message);
      throw error;
    }
  }

  // Obtenir l'historique d'une livraison
  async getDeliveryHistory(deliveryId, format = "json") {
    try {
      const query = {
        db: this.influxConfig.database,
        q: `SELECT time, lat, lng, speed, fuel_value, temp_value, active 
            FROM vehicle_position 
            WHERE delivery_id = '${deliveryId}' 
            ORDER BY time ASC`,
        format: format,
      };

      const response = await axios.post(
        `${this.influxConfig.host}/api/v3/query_sql`,
        query,
        {
          headers: {
            ...this.headers,
            "Content-Type": "application/json",
          },
        },
      );

      return {
        success: true,
        data: response.data,
        count: Array.isArray(response.data) ? response.data.length : 0,
      };
    } catch (error) {
      console.error(
        `❌ Error getting delivery history:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Obtenir la position actuelle d'un véhicule
  async getCurrentPosition(vehicleId) {
    try {
      const vehicleData = await this.fetchVehicleData(vehicleId);
      return {
        success: true,
        data: vehicleData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Error getting current position:`, error.message);
      throw error;
    }
  }

  // Obtenir les statistiques de tracking
  getTrackingStats() {
    const stats = {
      activeTrackings: this.activeTrackings.size,
      deliveries: [],
    };

    for (const [deliveryId, info] of this.activeTrackings) {
      stats.deliveries.push({
        deliveryId,
        vehicleId: info.vehicleId,
        startTime: info.startTime,
        duration: Math.round((Date.now() - info.startTime.getTime()) / 1000),
        intervalSeconds: info.intervalSeconds,
      });
    }

    return stats;
  }

  // Nettoyer tous les trackings (utile pour shutdown propre)
  stopAllTrackings() {
    console.log(
      `🧹 Stopping all active trackings (${this.activeTrackings.size})`,
    );

    for (const [deliveryId, info] of this.activeTrackings) {
      clearInterval(info.intervalId);
      console.log(`  - Stopped tracking for delivery ${deliveryId}`);
    }

    this.activeTrackings.clear();
    console.log("✅ All trackings stopped");
  }
}

// Singleton instance
const vehicleTrackingService = new VehicleTrackingService();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down vehicle tracking service...");
  vehicleTrackingService.stopAllTrackings();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down vehicle tracking service...");
  vehicleTrackingService.stopAllTrackings();
  process.exit(0);
});

module.exports = vehicleTrackingService;
