const crypto = require("crypto");
// const admin = require('firebase-admin');

module.exports.ORDER_STATUS = {
  INITIATED: "INITIATED",
  IN_PROGRESS: "IN_PROGRESS",
  FINISHED: "FINISHED",
  CANCELED: "CANCELED",
};

module.exports.validPermissionNames = [
  // Admin
  "user", "role", "permission",
  // People
  "employee", "driver", "client",
  // Operations
  "commande", "delivery", "deliveryTransfer", "vehicleAssignment",
  "vehicle", "prestataire", "product", "pricing",
  // Content & reporting
  "blog", "job", "section", "report",
  // Catalog (covers all reference/config data)
  "catalog",
  // Legacy names kept for backward compatibility
  "country", "measureUnit", "productType", "transportType",
];

module.exports.ROLES = {
  SUPER_ADMIN: "super_admin",
  OPERATIONS: "operations",
  COMPTABILITE: "comptabilite",
  LECTEUR: "lecteur",
  POINTEUR: "pointeur",
};

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
