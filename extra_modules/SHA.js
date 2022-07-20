const crypto = require('crypto');

/**
 * hashes with the secure hashing algorithm 256
 * @param       {string} str   string to hash
 * @param       {any} salt  salt to apply to string
 * @param       {number} num   amount of times to hash, defaults to 1
 * @returns     {string}    base64 digested hash
 */
function SHA256(str,salt,num) {
  if(!num && num!==0)num=1;
  if(!str)return;
  let ret = str;
  for (let i = 0; i < num; i++) {
    ret = crypto
      .createHash("sha256")
      .update(ret+salt)
      .digest("base64");
  }
  return ret;
}

module.exports = {
  SHA256: SHA256
}
