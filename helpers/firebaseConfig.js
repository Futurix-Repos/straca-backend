const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
} = require("firebase/storage");
const serviceAccount = require("../flash-chat-3a9a7-firebase-adminsdk-tm1oj-d5e6152562.json");

// Initialize Firebase Admin SDK

const firebaseConfig = {
  apiKey: "AIzaSyB9-DcuPSxSSuCzYSyaT0BMb11knkONCg0",
  authDomain: "flash-chat-3a9a7.firebaseapp.com",
  projectId: "flash-chat-3a9a7",
  storageBucket: "flash-chat-3a9a7.appspot.com",
  messagingSenderId: "199556573157",
  appId: "1:199556573157:web:a245b4d586cce3a7ec710c",
  measurementId: "G-X8SEHCSGJ0"
};

try {
  initializeApp(firebaseConfig);

  console.log("===========> connected to FIREBASE <===========");
} catch (error) {
  console.log(error);
}

const storage = getStorage();

module.exports = { storage };
