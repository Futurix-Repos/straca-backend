const express = require("express");
const app = express();
const logger = require("morgan");

const multer = require('multer');
const upload = multer({ dest: 'uploads/' })

// Routes
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const commandesRoutes = require('./routes/commandes');
const pricingsRoutes = require('./routes/pricings');
const employeesRoutes = require('./routes/employees');
const transportTypesRoutes = require('./routes/transportTypes');
const measureUnitRoutes = require('./routes/measureUnits');
const countryRoutes = require('./routes/countries');
const dashboardRoutes = require('./routes/dashboard');
const productsRoutes = require('./routes/products');
const usersRoutes = require('./routes/users');
const permissionsRoute = require('./routes/permissions');
const jobRoute = require('./routes/jobs');
const blogRoute = require('./routes/blogs');
const trackingRoute = require('./routes/tracking');


const blogTypeRoutes = require('./routes/blogType');
const countryTypeRoutes = require('./routes/countryType');
const productTypeRoutes = require('./routes/productType');
const vehicleTypeRoutes = require('./routes/vehicleType');
const contractTypeRoutes = require('./routes/contractType');
const proximityRoutes = require('./routes/proximity');
const vehicleBrandRoutes = require('./routes/vehicleBrand');
const newsLetterRoutes = require('./routes/newsletter');

app.use(logger('[:date[web]] ":method :url" :status :res[content-length]'));

app.use('/auth', authRoutes);
app.use('/clients', clientsRoutes);
app.use('/commandes', commandesRoutes);
app.use('/pricings', pricingsRoutes);
app.use('/employees', employeesRoutes);
app.use('/transportTypes', transportTypesRoutes);
app.use('/packageTypes', productTypeRoutes);
app.use('/measureUnits', measureUnitRoutes);
app.use('/countries', countryRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/products', productsRoutes);
app.use('/permissions', permissionsRoute);
app.use('/users', usersRoutes);
app.use('/blogs', blogRoute);
app.use('/jobs', jobRoute);
app.use('/tracking', trackingRoute);


app.use('/blogType', blogTypeRoutes);
app.use('/countryType', countryTypeRoutes);
app.use('/productType', productTypeRoutes);
app.use('/vehicleType', vehicleTypeRoutes);
app.use('/contractType', contractTypeRoutes);
app.use('/proximity', proximityRoutes);
app.use('/vehicleBrand', vehicleBrandRoutes);
app.use('/newsLetter', newsLetterRoutes);






app.get('/', (req, res) => {
    res.send('Hello NODE API');
});

app.get('/blog', (req, res) => {
    res.send('Hello Blog');
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    res.json(req.file);
});

module.exports = app;
