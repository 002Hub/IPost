const xor = require("../extra_modules/xor.js")
const crypto = require("crypto")

const randomString = (length = 4) => {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;

};

const attempts = 500000

const per = attempts/100

for(let i=0;i<attempts;i++) {
    let msg = randomString(100)
    let b = randomString(10)
    let xored = xor(msg,b)

    let c = randomString(10)

    let unxored = xor(xored,c)

    if(unxored == msg && b != c) {
        console.error(b,c,"have a collision?!?")
        process.abort(i+1) //non-zero
    }

    if(i%10000==0) {
        console.log("progress: ",i+"/"+attempts,i/per+"%");
    }
}

console.log("completed simple randomString xor")

for(let i=0;i<attempts;i++) {
    let msg = randomString(100)
    let b = crypto.randomBytes(10).toString("hex")
    let xored = xor(msg,b)

    let c = crypto.randomBytes(10).toString("hex")

    let unxored = xor(xored,c)

    if(unxored == msg && b != c) {
        console.error(b,c,"have a collision?!?")
        process.abort(i+1) //non-zero
    }

    if(i%10000==0) {
        console.log("progress: ",i+"/"+attempts,i/per+"%");
    }
}

console.log("completed simple randomBytes xor")
