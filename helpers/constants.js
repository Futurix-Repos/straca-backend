const crypto = require("crypto");
// const admin = require('firebase-admin');


module.exports.validPermissionNames = ['user', 'permission', 'employee', 'client', 'commande', 'country', 'measureUnit', 'packageType', 'pricing', 'product', 'transportType'];

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

module.exports.generateReference = (data) => {
    const hash = crypto.createHash("sha256");
    hash.update(data);
    return hash.digest("hex").toUpperCase().substring(0, 10);
};

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
