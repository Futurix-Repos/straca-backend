const crypto = require("crypto");
// const admin = require('firebase-admin');

module.exports.ORDER_STATUS = {
  INITIATED: "INITIATED",
  IN_PROGRESS: "IN_PROGRESS",
  FINISHED: "FINISHED",
  CANCELED: "CANCELED",
};

//TODO rewrite permissions
module.exports.validPermissionNames = [
  "user",
  "permission",
  "employee",
  "client",
  "commande",
  "country",
  "measureUnit",
  "productType",
  "pricing",
  "product",
  "transportType",
];

module.exports.makeid = (length) => {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

module.exports.generateReference = ({ data, prefix = "", length = 10 }) => {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return `${prefix}${hash.digest("hex").toUpperCase().substring(0, length)}`;
};

module.exports.calculTotalOfItem = ({ item, next }) => {};

// async function uploadImage(imageFile) {
//     try {
//       // Upload file to Firebase Storage
//       const bucket = admin.storage().bucket();
//       const timestamp = Date.now().toString();
//       const fileName = `${timestamp}_${imageFile.originalname}`;
//       const fileUpload = await bucket.upload(imageFile.path, {
//         destination: `images/${fileName}`,
//       });

//       // Get the download URL for the uploaded image
//       const imageUrl = await fileUpload[0].getSignedUrl({ action: 'read', expires: '03-09-2491' });

//       return imageUrl;
//     } catch (error) {
//       console.error('Error uploading image:', error);
//       throw new Error('Error uploading image');
//     }
//   }

//   module.exports = { uploadImage };
