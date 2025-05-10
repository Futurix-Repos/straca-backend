const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { spacesClient } = require("./spacesConfig");
const spaceImageUploadHelper = async (imageFile, path = "images/") => {
  if (!imageFile) {
    return "";
  }

  try {
    // Generate a unique filename with timestamp
    const timestamp = Date.now().toString();
    const fileName = `${timestamp}_${imageFile.originalname}`;
    // Ensure path doesn't start with a slash and ends without one
    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    const key = `${normalizedPath}/${fileName}`; // e.g., images/timestamp_filename

    // Prepare the upload command
    const command = new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
      Body: imageFile.buffer,
      ACL: "public-read",
      ContentType: imageFile.mimetype,
    });

    // Upload the file
    await spacesClient.send(command);

    // Construct the public URL
    const downloadURL = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.cdn.digitaloceanspaces.com/${key}`;
    console.log("=======> File successfully uploaded:", downloadURL);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading file:", error.message);
    throw error;
  }
};

const spaceImageDeleteHelper = async (fileUrl) => {
  if (!fileUrl) {
    return;
  }

  try {
    // Extract the key from the URL
    const urlParts = fileUrl.split(
      `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.cdn.digitaloceanspaces.com/`,
    );
    if (urlParts.length < 2) {
      throw new Error("Invalid file URL");
    }
    const key = urlParts[1];

    // Prepare the delete command
    const command = new DeleteObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
    });

    // Delete the file
    await spacesClient.send(command);
    console.log("=======> File successfully deleted:", fileUrl);
  } catch (error) {
    console.error("Error deleting file:", error.message);
    throw error;
  }
};

module.exports = { spaceImageUploadHelper, spaceImageDeleteHelper };
