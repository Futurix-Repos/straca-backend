const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const { validPermissionNames } = require("./constants");
module.exports.authorizeJwt = (req, res, next) => {
  const authToken = req.headers.authorization;
  const [bearer, token] = authToken?.split(" ") ?? [null, null];

  if (bearer === "Bearer" && token) {
    const secretKey = process.env.JWT_KEY;

    jwt.verify(token, secretKey, function (err, decoded) {
      if (decoded) {
        User.findById(decoded.userId)
          .populate("permissions")
          .exec()
          .then((user) => {
            // If the email doesn't exist, return a 401 Unauthorized status code
            if (!user)
              return res.status(401).json({
                message: `User with email ${decoded.email} not found`,
              });
            else {
              req.user = user;
              next();
            }
          })
          .catch((err) => {
            // If there's an error during the process, return a 500 Internal Server Error
            console.log(err);
            res.status(500).json({
              error: err,
            });
          });
      } else res.status(401).json({ message: "Unauthorized-Invalid Token" });
    });
  } else res.status(401).json({ message: "Invalid authorization header" });
};
module.exports.verifyAccount = (permissionsToVerify) => {
  return async (req, res, next) => {
    const user = req.user;

    if (user) {
      if (user.type === "employee") {
        if (user.permissions.length === 0)
          res.status(403).json({ message: "The user doesn't have permission" });
        else if (
          !permissionsToVerify.every(
            (verify) =>
              validPermissionNames.includes(verify.name) &&
              (verify.action === "update" ||
                verify.action === "read" ||
                verify.action === "create" ||
                verify.action === "delete")
          )
        )
          res
            .status(403)
            .json({ message: "The user permission to verify is not correct" });
        else if (
          user.permissions.every((permission) =>
            permissionsToVerify.find(
              (verify) =>
                verify.name === permission.name &&
                verify.action === permission.action
            )
          )
        )
          next();
        else
          res.status(403).json({ message: "The user doesnt have permissions" });
      } else next();
    } else res.status(403).json({ message: "The user is not connected" });
  };
};
