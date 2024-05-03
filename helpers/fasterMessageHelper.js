const axios = require("axios")

const axiosMsg = axios.create({
    baseURL: "https://fastermessage.com/api/v1",
    headers: {
        "x-api-key": process.env.FASTER_MSG_API_KEY,
    },
});

//Send Message to user
module.exports.sendMsg = async (PhoneNumber, Message) => {
    console.log("=====> SendMSG")
    return axiosMsg.get(`/sms/send`, {
        params: {
            from: 'ASCOLINE',
            to: PhoneNumber,
            text: Message,
        },
    });
};