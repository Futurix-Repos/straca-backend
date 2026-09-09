/* global use */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use("straca");

// Trouve les plaques libres (aucun voyage non-validé en attente)
db.vehicles.aggregate([
  {
    $lookup: {
      from: "deliveries",
      let: { vid: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$vehicle", "$$vid"] },
            "sender.validate": false,
            "receiver.validate": false,
          },
        },
      ],
      as: "pending",
    },
  },
  { $match: { pending: { $size: 0 } } },
  { $project: { registrationNumber: 1 } },
  { $limit: 5 },
]);
