const express = require("express");
const app = express();
const logger = require("morgan");

const multer = require("multer");
const upload = multer();

// Routes
const authRoutes = require("./routes/auth");
const clientsRoutes = require("./routes/clients");
const orderRoutes = require("./routes/orders");
const pricingsRoutes = require("./routes/pricings");
const employeesRoutes = require("./routes/employees");
const transportTypesRoutes = require("./routes/transportTypes");
const measureUnitRoutes = require("./routes/measureUnits");
const countryRoutes = require("./routes/countries");
const dashboardRoutes = require("./routes/dashboard");
const productsRoutes = require("./routes/products");
const usersRoutes = require("./routes/users");
const permissionsRoute = require("./routes/permissions");
const jobRoute = require("./routes/jobs");
const blogRoute = require("./routes/blogs");
const vehicleRoute = require("./routes/vehicle");

const blogTypeRoutes = require("./routes/blogType");
const countryTypeRoutes = require("./routes/countryType");
const productTypeRoutes = require("./routes/productType");
const vehicleTypeRoutes = require("./routes/vehicleType");
const vehicleSourceRoutes = require("./routes/vehicleSource");
const vehicleModelRoutes = require("./routes/vehicleModel");
const vehicleBrandRoutes = require("./routes/vehicleBrand");
const contractTypeRoutes = require("./routes/contractType");
const proximityRoutes = require("./routes/proximity");
const newsLetterRoutes = require("./routes/newsletter");
const locationRoutes = require("./routes/location");
const productMeasureUnitRoutes = require("./routes/productsMeasureUnits");
const deliveryRoutes = require("./routes/delivery");
const addressesRoutes = require("./routes/address");
const deliveryTransfersRoutes = require("./routes/deliveryTransfer");

app.use(logger('[:date[web]] ":method :url" :status :res[content-length]'));

app.use("/auth", authRoutes);
app.use("/clients", clientsRoutes);
app.use("/orders", orderRoutes);

app.use("/employees", employeesRoutes);

app.use("/productTypes", productTypeRoutes);
app.use("/measureUnits", measureUnitRoutes);

app.use("/dashboard", dashboardRoutes);
app.use("/products", productsRoutes);
app.use("/productMeasureUnits", productMeasureUnitRoutes);
app.use("/permissions", permissionsRoute);
app.use("/users", usersRoutes);
app.use("/blogs", blogRoute);
app.use("/jobs", jobRoute);
app.use("/vehicles", vehicleRoute);
app.use("/vehicleBrands", vehicleBrandRoutes);
app.use("/vehicleTypes", vehicleTypeRoutes);
app.use("/vehicleSources", vehicleSourceRoutes);
app.use("/vehicleModels", vehicleModelRoutes);

app.use("/blogTypes", blogTypeRoutes);

app.use("/productTypes", productTypeRoutes);

app.use("/contractTypes", contractTypeRoutes);
app.use("/proximity", proximityRoutes);

app.use("/newsLetter", newsLetterRoutes);

app.use("/locations", locationRoutes);
app.use("/deliveries", deliveryRoutes);
app.use("/deliveryTransfers", deliveryTransfersRoutes);
app.use("/addresses", addressesRoutes);

app.get("/", (req, res) => {
  res.send("Hello NODE API");
});

app.get("/blog", (req, res) => {
  res.send("Hello Blog");
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  res.json(req.file);
});

module.exports = app;
