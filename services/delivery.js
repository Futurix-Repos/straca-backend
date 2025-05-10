const blobStream = require("blob-stream");
const mongoose = require("mongoose");
const {
  logoBase64,
  checkIfNull,
  formatDate,
  printer,
} = require("../helpers/pdfHelper");
const { get } = require("axios");
const Delivery = mongoose.model("Delivery");
module.exports.exportDeliveryToPdf = async ({ deliveryId }) => {
  // Fetch delivery with populated fields
  const delivery = await Delivery.findById(deliveryId)
    .populate("order", "reference")
    .populate("departureAddress", "label")
    .populate("destination", "name location")
    .populate("vehicle", "registrationNumber")
    .populate("sender.user", "firstName lastName")
    .populate("sender.validateBy", "firstName lastName")
    .populate("receiver.user", "firstName lastName")
    .populate("receiver.validateBy", "firstName lastName")
    .populate({
      path: "productMeasureUnit",
      populate: [
        { path: "product", select: "name" },
        { path: "measureUnit", select: "label" },
      ],
    });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  let proofImageBase64 = null;
  if (delivery.receiver?.proof) {
    try {
      const response = await get(delivery.receiver.proof, {
        responseType: "arraybuffer",
      });
      proofImageBase64 = Buffer.from(response.data, "binary").toString(
        "base64",
      );
    } catch (error) {
      console.error("Failed to fetch proof image:", error.message);
      proofImageBase64 = null; // Handle failure gracefully
    }
  }

  // Define content structure
  const content = [
    // Logo
    {
      image: logoBase64,
      width: 200,
      margin: [0, 20],
    },
    // Title
    {
      text: "Détails du voyage",
      style: "header",
      margin: [0, 10],
    },
    // Delivery Info Section
    {
      text: "Informations du voyage",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Référence", style: "tableHeader" },
            { text: checkIfNull(delivery.reference), alignment: "left" },
          ],
          [
            { text: "Statut", style: "tableHeader" },
            {
              text: delivery.status
                ? {
                    PENDING: "En attente",
                    IN_PROGRESS: "En transit",
                    DELIVERED: "Livrée",
                    CANCELED: "Annulée",
                  }[delivery.status] || "-"
                : "-",
              alignment: "left",
            },
          ],
          [
            { text: "Créé le", style: "tableHeader" },
            { text: formatDate(delivery.createdAt), alignment: "left" },
          ],
          [
            { text: "Mis à jour le", style: "tableHeader" },
            { text: formatDate(delivery.updatedAt), alignment: "left" },
          ],
        ],
      },
      margin: [0, 5],
    },
    // Sender Info Section
    {
      text: "Expéditeur",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Nom", style: "tableHeader" },
            {
              text: checkIfNull(
                `${delivery.sender.user?.firstName || ""} ${delivery.sender.user?.lastName || ""}`,
              ),
              alignment: "left",
            },
          ],
          [
            { text: "Quantité", style: "tableHeader" },
            {
              text: checkIfNull(delivery.sender.quantity),
              alignment: "left",
            },
          ],
          [
            { text: "Note", style: "tableHeader" },
            { text: checkIfNull(delivery.sender.note), alignment: "left" },
          ],
          [
            { text: "Validé", style: "tableHeader" },
            {
              text: delivery.sender.validate ? "Oui" : "Non",
              alignment: "left",
            },
          ],
          [
            { text: "Validé par", style: "tableHeader" },
            {
              text: checkIfNull(
                `${delivery.sender.validateBy?.firstName || ""} ${delivery.sender.validateBy?.lastName || ""}`,
              ),
              alignment: "left",
            },
          ],
        ],
      },
      margin: [0, 5],
    },
    // Receiver Info Section
    {
      text: "Récepteur",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Nom", style: "tableHeader" },
            {
              text: checkIfNull(
                `${delivery.receiver?.user?.firstName || ""} ${delivery.receiver?.user?.lastName || ""}`,
              ),
              alignment: "left",
            },
          ],
          [
            { text: "Quantité", style: "tableHeader" },
            {
              text: checkIfNull(delivery.receiver?.quantity),
              alignment: "left",
            },
          ],
          [
            { text: "Note", style: "tableHeader" },
            { text: checkIfNull(delivery.receiver?.note), alignment: "left" },
          ],
          [
            { text: "Validé", style: "tableHeader" },
            {
              text: delivery.receiver?.validate ? "Oui" : "Non",
              alignment: "left",
            },
          ],
          [
            { text: "Validé par", style: "tableHeader" },
            {
              text: checkIfNull(
                `${delivery.receiver?.validateBy?.firstName || ""} ${delivery.receiver?.validateBy?.lastName || ""}`,
              ),
              alignment: "left",
            },
          ],
        ],
      },
      margin: [0, 5],
    },
    {
      text: "Preuve",
      style: "subheader",
      margin: [0, 10],
    },
    proofImageBase64
      ? {
          image: `data:image/jpeg;base64,${proofImageBase64}`,
          width: 200,
          height: 200,
          margin: [0, 5],
        }
      : {
          text: delivery.receiver?.proof
            ? "Erreur de chargement de l'image"
            : "Aucune preuve",
          alignment: "left",
          margin: [0, 5],
        },
    // Order Info Section
    {
      text: "Commande",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Référence", style: "tableHeader" },
            { text: checkIfNull(delivery.order?.reference), alignment: "left" },
          ],
        ],
      },
      margin: [0, 5],
    },
    // Locations Section
    {
      text: "Lieux",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Adresse de départ", style: "tableHeader" },
            {
              text: checkIfNull(delivery.departureAddress?.label),
              alignment: "left",
            },
          ],
          [
            { text: "Destination", style: "tableHeader" },
            {
              text: checkIfNull(
                `${delivery.destination?.name || ""} (lat: ${delivery.destination?.location?.lat || "-"}, lng: ${delivery.destination?.location?.lng || "-"})`,
              ),
              alignment: "left",
            },
          ],
        ],
      },
      margin: [0, 5],
    },
    // Vehicle Section
    {
      text: "Véhicule",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Numéro d'immatriculation", style: "tableHeader" },
            {
              text: checkIfNull(delivery.vehicle?.registrationNumber),
              alignment: "left",
            },
          ],
        ],
      },
      margin: [0, 5],
    },
    // Product Section
    {
      text: "Produit",
      style: "subheader",
      margin: [0, 10],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: "Nom du produit", style: "tableHeader" },
            {
              text: checkIfNull(delivery.productMeasureUnit?.product?.name),
              alignment: "left",
            },
          ],
          [
            { text: "Unité de mesure", style: "tableHeader" },
            {
              text: checkIfNull(
                delivery.productMeasureUnit?.measureUnit?.label,
              ),
              alignment: "left",
            },
          ],
        ],
      },
      margin: [0, 5],
    },
  ];

  // Generate document definition
  const docDef = {
    pageSize: "A4",
    pageOrientation: "portrait",
    content,
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        color: "#000A47",
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 16,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 12,
        color: "black",
      },
    },
    defaultStyle: {
      font: "Poppins",
    },
  };

  return new Promise((resolve, reject) => {
    const pdf = printer.createPdfKitDocument(docDef);

    pdf
      .pipe(blobStream())
      .on("finish", function () {
        console.log("Finished generating PDF");
        resolve(this.toBlob("application/pdf"));
      })
      .on("error", (err) => {
        console.error("Error generating PDF:", err);
        reject(err);
      });

    pdf.end();
  });
};
