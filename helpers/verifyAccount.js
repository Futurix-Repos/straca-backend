const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

module.exports.authorizePublic = (tokenToVerify) => {
  return async (req, res, next) => {
    const authToken = req.headers.authorization;
    const [bearer, token] = authToken?.split(" ") ?? [null, null];

    if (bearer === "Bearer" && token) {
      if (token === tokenToVerify) next();
      else res.status(401).json({ message: "Unauthorized-Invalid Token" });
    } else res.status(401).json({ message: "Invalid authorization header" });
  };
};

module.exports.authorizeJwt = (req, res, next) => {
  const authToken = req.headers.authorization;
  const [bearer, token] = authToken?.split(" ") ?? [null, null];

  if (bearer === "Bearer" && token) {
    const secretKey = process.env.JWT_KEY;

    jwt.verify(token, secretKey, function (err, decoded) {
      if (decoded) {
        User.findById(decoded.userId)
          .populate({ path: "role", populate: { path: "permissions" } })
          .exec()
          .then((user) => {
            if (!user)
              return res.status(401).json({
                message: `User with email ${decoded.email} not found`,
              });

            if (user.confirmed !== true)
              return res.status(401).json({
                message: `Cet utilisateur ${decoded.email} n'est pas confirmé`,
              });

            req.user = user;
            next();
          })
          .catch((err) => {
            console.log(err);
            res.status(500).json({ error: err });
          });
      } else res.status(401).json({ message: "Unauthorized-Invalid Token" });
    });
  } else res.status(401).json({ message: "Invalid authorization header" });
};

module.exports.verifyAccount = (permissionsToVerify) => {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) return res.status(403).json({ message: "Utilisateur non connecté" });

    // admin type = legacy super_admin, bypass all checks
    if (user.type === "admin") return next();

    // Clients cannot access internal routes
    if (user.type === "client") return res.status(403).json({ message: "Accès refusé" });

    const role = user.role;

    // No role assigned yet (pre-migration): allow through like before
    if (!role) return next();

    // super_admin bypasses all permission checks (must come before active check)
    if (role.code === "super_admin") return next();

    if (!role.active)
      return res.status(403).json({ message: "Votre rôle a été désactivé" });

    const userPermissions = role.permissions ?? [];

    const hasAll = permissionsToVerify.every((required) =>
      userPermissions.some(
        (p) => p.name === required.name && p.action === required.action
      )
    );

    if (hasAll) return next();

    return res.status(403).json({ message: "Permission insuffisante" });
  };
};
