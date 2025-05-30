const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const { initFirebase } = require('./helpers/firebaseConfig');

const app = require("./app");
const server = express();

server.use(express.urlencoded({ limit: "10mb", extended: true }));
server.use(express.json({ limit: "10mb" }));

// Allow requests from http://localhost:3001 (your frontend origin)
server.use(
  cors({
    origin: [
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "https://dashboard.straca-sa.com",
      "https://dashboard.client.straca-sa.com",
      "https://straca-sa.com",
    ],
  }),
);

server.use(app);

const mongoUri = process.env.DB_URL;

mongoose.set("strictQuery", false);
mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("===========> connected to MongoDB <===========");
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(`Node API app is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });

// initialize Firebase
//   initFirebase();

// // Initialize Firebase Admin SDK
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   storageBucket: 'gs://flash-chat-3a9a7.appspot.com',
// }).then(() => {
//     console.log("===========> connected to FIREBASE <===========");
// })
// .catch((error) => {
//     console.log(error);
// });

module.exports = server;
