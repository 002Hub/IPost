import fs from "fs";
const config = JSON.parse(fs.readFileSync("server_config.json"));
/**
 * gets ip of a request
 * @param {request} req
 * @returns ip of the given request, after taking preferred headers into account
 */
function getIP(req) {
    let ip = req.socket.remoteAddress;
    if (req.headers[config.preferred_ip_header] !== undefined && ip === config.only_prefer_when_ip)
        ip = req.headers[config.preferred_ip_header];
    return ip;
}
export default getIP;
