const { storage } = require("./firebaseConfig");

// import { ref, getDownloadURL } from "firebase/storage";
const {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
} = require("firebase/storage");

const imageUploadHelper = async (imageFile) => {
  if (!imageFile) {
    return "";
  }

  // Upload file to Firebase Storage
  const timestamp = Date.now().toString();
  const fileName = `${timestamp}_${imageFile.originalname}`;

  // create ref
  const storageRef = ref(storage, `images/${fileName}`);

  // Create file metadata including the content type
  const metadata = {
    contentType: imageFile.mimetype,
  };

  // By using uploadBytesResumable we can control the progress of uploading like pause, resume, cancel
  const snapshot = await uploadBytesResumable(
    storageRef,
    imageFile.buffer,
    metadata
  );

  // Grab the public url
  const downloadURL = await getDownloadURL(snapshot.ref);
  console.log("=======> File successfully uploaded.");

  return downloadURL;
};

module.exports = imageUploadHelper;
