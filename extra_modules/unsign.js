import * as signature from "cookie-signature";
import fs from "fs";
import getIP from "./getip.js";
const cookiesecret = fs.readFileSync("cookiesecret.txt").toString();
/**
 * usignes a string
 * @param  {string} text               text to unsign
 * @param  {request} req                request object, used for getting the ip for unsigning
 * @param  {response} res                response object
 * @return {string/boolean}      unsigned text, or if unsigning was unsuccessful, false
 */
function unsign(text, req, res) {
    let ip = getIP(req);
    let unsigned = signature.unsign(text, cookiesecret + ip);
    if (!unsigned) {
        unsigned = signature.unsign(text, cookiesecret); //unsafe login?
        if(!unsigned)return false;
        return unsigned
    }
    return unsigned;
}
/**
 * unsignes the auth cookie of a request, also sends json response if auth cookie was invalid
 * @param  {request} req               request object
 * @param  {response} res               response object
 * @return {string/boolean}     unsigned cookie, or if unsigning was unsuccessful, false
 */
function getunsigned(req, res) {
    let cookie = req.cookies.AUTH_COOKIE;
    if (!cookie) {
        res.status(403);
        res.json({ "error": "you are not logged in! (no cookie)" });
        return;
    }
    let unsigned = unsign(cookie, req, res);
    if (!unsigned) {
        try {
            res.status(401);
            res.json({ "error": "Bad auth cookie set" });
        }
        catch (ignored) { } //sometimes it errors, gotta debug soon
        return false;
    }
    return decodeURIComponent(unsigned);
}
export { unsign };
export { getunsigned };
export default {
    unsign: unsign,
    getunsigned: getunsigned
};
