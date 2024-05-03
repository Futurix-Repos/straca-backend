const axios = require("axios")
const {generateReference} = require("./constants");
const uuid = require("uuid");


const axiosInstance = axios.create({
    baseURL: "https://qosic.net:8443/QosicBridge/user",
    headers: {
        "Content-Type": "application/json",
        Authorization:
            "Basic " +
            Buffer.from(
                process.env.QOS_USERNAME + ":" + process.env.QOS_PASSWORD,
            ).toString("base64"),
    },
});


const services = {
    makePayment: async (phoneNumber, amount, network) => {
        let clientId =
            network === "MTN"
                ? process.env.QOS_MTN_CLIENT_ID
                : process.env.QOS_MOOV_CLIENT_ID;

        return axiosInstance.post(
            network === "MTN" ? "/requestpayment" : "/requestpaymentmv",
            {
                msisdn: phoneNumber,
                amount: amount,
                transref: generateReference(uuid.v4()),
                clientid: clientId,
            }
        );
    },

    getTransactionStatus: async (transref, network) => {
        let clientId;

        clientId =
            network === "MTN"
                ? process.env.QOS_MTN_CLIENT_ID
                : process.env.QOS_MOOV_CLIENT_ID;

        return axiosInstance.post("/gettransactionstatus", {
            transref: transref,
            clientid: clientId,
        });
    },
};

module.exports = services;