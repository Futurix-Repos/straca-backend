const express = require('express');
const router = express.Router();
const UserModel = require('../models/userModel');
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount");



router.get('/', authorizeJwt, verifyAccount([{name: 'user', action: "read"}]), async (req, res) => {

    const filter = {};
    const search = req.query.search;
    const type = req.query.type

    if (search) {
        filter.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
        ];
    }

    if (type) {
        if (type === "admin" || type === "employee" || type === "client") {
            filter.type = type;
        }
    }

    try {
        const users = await UserModel.find(filter).populate('permissions');
        res.status(200).json(users);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', authorizeJwt, verifyAccount([{name: 'user', action: "update"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!user) {
            return res.status(404).json({ message: `Cannot find any user with ID ${id}` });
        }
        res.status(200).json(user);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;