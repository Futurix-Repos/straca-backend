const express = require("express");
const newsLetter = require("../models/newsletter");
const router = express.Router();
const mongoose = require("mongoose");

//create a newsLetter
router.post("/", async(req, res) =>{
    try {
        const {email} = req.body;
        const existingEmail = await newsLetter.findOne({email});
        if(existingEmail) {
           return res.status(409).json({message: "Email Already exists"});
        }
        // Generate a new ObjectId for the _id field
        const newId = new mongoose.Types.ObjectId();

        // Assign the generated _id to req.body
        req.body._id = newId;
        const newEmail = await  newsLetter.create(req.body);
        res.status(201).json(newEmail);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Internal Server Error"});
    }
});
module.exports = router;