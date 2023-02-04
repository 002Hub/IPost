import crypto from "crypto";

let SHA256_cache = {}

function _SHA256(str) {
    return crypto
            .createHash("sha256")
            .update(str)
            .digest("base64");
}

/**
 * hashes with the secure hashing algorithm 256
 * @param       {string} str   string to hash
 * @param       {any} salt  salt to apply to string
 * @param       {number} num   amount of times to hash, defaults to 1
 * @returns     {string}    base64 digested hash
 */
function SHA256(str, salt, num) {
    if (!num && num !== 0)
        num = 1;
    if (!str)
        return;
    let identifier = _SHA256(str+salt+num.toString())
    if(SHA256_cache[identifier] != undefined) {
        return SHA256_cache[identifier];
    }
    let ret = str;
    for (let i = 0; i < num; i++) {
        ret = _SHA256(ret + salt)
    }
    SHA256_cache[identifier] = ret;
    setTimeout(()=>{
        SHA256_cache[identifier] = undefined
    },10000) //cache for 10s
    return ret;
}
export { SHA256 };
export default {
    SHA256: SHA256
};
