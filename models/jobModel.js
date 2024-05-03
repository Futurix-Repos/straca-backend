const mongoose = require("mongoose");

const validContractTypes = ["fulltime", "parttime"];

const jobSchema = new mongoose.Schema(
  {
    post: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    proximity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proximity',
      required: true
    },
    contractType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContractType',
      required: true,
    },
    dateOfCreation: {
      type: Date,
      default: Date.now,
    },
    salary: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
