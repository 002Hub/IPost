import "newrelic"

import http from "http";
import * as express from "express";
import useragent from "express-useragent";
import fileUpload from "express-fileupload";
import * as bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import * as signature from "cookie-signature";
import * as mysql from "mysql";
import * as ws from "ws";
import sharp from "sharp"
import {SHA256} from "./extra_modules/SHA.js";
import getIP from "./extra_modules/getip.js";
import {unsign} from "./extra_modules/unsign.js";
import { readFileSync, mkdir, existsSync, appendFile, unlinkSync, writeFileSync, readFile } from "fs";
import { format } from "util";
import { setup as optionssetup } from "./routes/api/options.js";
import { setup as allsetup } from "./routes/api/all.js";
import { setup as settingshandlersetup } from "./routes/api/settingshandler.js";
import { setup as postsetup } from "./routes/api/post.js";
import { setup as dmsPersonalMessagessetup } from "./routes/api/dms/PersonalMessages.js";
import { setup as dmspostsetup } from "./routes/api/dms/post.js";

import * as compress from "compression"
const compression = compress.default

import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


async function addTextOnImage(text,buf) {
    try {
        let img = await sharp(buf)

        const metadata = await img.metadata()

        const width = metadata.width;
        const height = metadata.height;

        const svgImage = `
        <svg width="${width}" height="${height}">
        <style>
        .title { fill: #001; font-size: 30px; font-weight: bold;}
        </style>
        <text x="50%" y="50%" text-anchor="middle" class="title">${text}</text>
        </svg>
        `;

        return await img
            .composite([
            {
                input: Buffer.from(svgImage),
                top: 0,
                left: 0,
            },
            ]).webp({effort:6}).toBuffer()
    } catch (error) {
        console.log(error);
    }
}

/**
 * makes sure that a given folder exists, if it doesn't it creates one for you
 * @param  {string}   path               the path of the folder
 * @param  {permission}   mask               permission mask for the new folder to have
 * @param  {Function} cb                 callback, gives null if the folder exists, otherwise gives the error
 * @return {undefined}        see: callback
 */
function ensureExists(path, mask, cb) {
    if (typeof mask == 'function') { // Allow the `mask` parameter to be optional
        cb = mask;
        mask = 0o744;
    }
    mkdir(path, mask, function (err) {
        if (err) {
            if (err.code == 'EEXIST')
                cb(null); // Ignore the error if the folder already exists
            else
                cb(err); // Something else went wrong
        }
        else
            cb(null); // Successfully created folder
    });
}
const config = JSON.parse(readFileSync("server_config.json"));
const time = Date.now();
const original_log = console.log;
/**
 * custom logging function
 * @param  {number} level               importance level if information
 * @param  {any} info                information to format + log
 * @return {undefined}       returns nothing
 */
function log_info(level, ...info) {
    let text = info;
    if (text == undefined || text.length == 0) {
        text = level;
        level = 5;
    }
    if (config["logs"] && config["logs"]["level"] && config["logs"]["level"] >= level) {
        let tolog = `[INFO] [${Date.now()}] : ${format(text)} \n`;
        original_log(tolog); //still has some nicer colors
        ensureExists(__dirname + '/logs/', function (err) {
            if (err) {
                process.stderr.write(tolog); //just write it to stderr
            }
            else {
                appendFile(__dirname + "/logs/" + time, tolog, function (err) {
                    if (err) {
                        process.stderr.write(err);
                    }
                });
            }
        });
    }
}
console.log = log_info;

const WebSocket = ws.WebSocketServer;

import {EventEmitter} from 'events';
import merge from 'merge-descriptors';

/**
 * Create an express application.
 *
 * @return {Function}
 * @api public
 */

 function createApplication() {
    var app = function(req, res, next) {
      app.handle(req, res, next);
    };
  
    merge(app, EventEmitter.prototype, false);
    merge(app, express.application, false);
  
    // expose the prototype that will get set on requests
    app.request = Object.create(express.request, {
      app: { configurable: true, enumerable: true, writable: true, value: app }
    })
  
    // expose the prototype that will get set on responses
    app.response = Object.create(express.response, {
      app: { configurable: true, enumerable: true, writable: true, value: app }
    })
  
    app.init();
    return app;
}

const router = express.Router();
const app = createApplication();
const HASHES_DB = config.cookies.server_hashes;
const HASHES_COOKIE = config.cookies.client_hashes;
const HASHES_DIFF = HASHES_DB - HASHES_COOKIE;
const DID_I_FINALLY_ADD_HTTPS = true;
const con = mysql.createPool({
    connectionLimit: config.mysql.connections,
    host: config.mysql.host,
    user: config.mysql.user,
    password: readFileSync(config.mysql.password_file).toString()
});
const dir = __dirname + "/";
const cookiesecret = readFileSync("cookiesecret.txt").toString();
/**
 * quick function to convert data to base64
 * @param  {any} data               data to encode in base64
 * @return {string}      base64 encoded data
 */
function b64(data) {
    let buff = Buffer.from(data);
    return buff.toString('base64');
}
/**
 * custom, bad random number generator
 * @param       {number} seed  seed for the number generator, defaults to current timestamp
 * @constructor
 */
function RNG(seed) {
    if (!seed)
        seed = Date.now();
    this.seed = seed;
    this.random = function (min, max) {
        if (!min)
            min = 0;
        if (!max) {
            max = min;
            min = 0;
        }
        this.seed += Math.log(Math.abs(Math.sin(this.seed)) * 100);
        return Math.abs(Math.sin(this.seed)) * max + min;
    };
    this.rand = function (min, max) {
        return Math.floor(this.random(min, max));
    };
}
/**
 * waits x ms
 * @param  {number} ms               amount of ms to sleep for
 * @return {promise}    promise that gets resolved after x ms
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const rand = new RNG();
const genstring_characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const genstring_charactersLength = genstring_characters.length;
/**
 * generates a semi-random string
 * @param  {number} length               length of string to generate
 * @return {string}        semi-random string generated
 */
function genstring(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += genstring_characters.charAt(rand.rand(genstring_charactersLength));
    }
    return result;
}
/**
 * handles client errors, used by expressJS
 */
function clientErrorHandler(err, req, res, next) {
    if (err) {
        if (req.xhr) {
            res.status(200).send({ error: 'Something failed!' });
        }
        else {
            console.log(1, err);
        }
    }
    else {
        next();
    }
}
/**
 * utility function to get a key by its value in an object
 * @param  {object} object               object to get key from
 * @param  {any} value                value to get key from
 * @return {any}        key to the given value inside the object
 */
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}
var API_CALLS = {};
var API_CALLS_ACCOUNT = {};
var USER_CALLS = {};
var SESSIONS = {};
var REVERSE_SESSIONS = {};
var INDIVIDUAL_CALLS = {};
/**
 * clears current api call list (per IP)
 * @return {undefined} returns nothing
 */
function clear_api_calls() {
    API_CALLS = {};
}
/**
 * clears current api account call list (per account)
 * @return {undefined} returns nothing
 */
function clear_account_api_calls() {
    API_CALLS_ACCOUNT = {};
}
/**
 * clears current user file call list (per IP)
 * @return {undefined} returns nothing
 */
function clear_user_calls() {
    USER_CALLS = {};
}
setInterval(clear_api_calls, config.rate_limits.api.reset_time);
setInterval(clear_account_api_calls, config.rate_limits.api.reset_time);
setInterval(clear_user_calls, config.rate_limits.user.reset_time);
function increaseIndividualCall(url, req) {
    let conf = config["rate_limits"]["individual"][url];
    if (!conf) {
        //if(!url.startsWith("/avatars/")) //ignore avatars /* DEBUG: inidividual ratelimiters */
            //console.log(5, "url not in individual ratelimiter", url); /* DEBUG: inidividual ratelimiters */
        return true;
    }
    if (!conf["enabled"])
        return true;
    let ip = getIP(req);
    if (INDIVIDUAL_CALLS[ip] == undefined)
        INDIVIDUAL_CALLS[ip] = {};
    if (INDIVIDUAL_CALLS[ip][url] == undefined)
        INDIVIDUAL_CALLS[ip][url] = 0;
    if (INDIVIDUAL_CALLS[ip][url] == 0) {
        setTimeout(function () {
            INDIVIDUAL_CALLS[ip][url] = 0;
        }, conf["reset_time"]);
    }
    INDIVIDUAL_CALLS[ip][url]++;
    if (INDIVIDUAL_CALLS[ip][url] >= conf["max"]) {
        console.log(3, "ratelimiting someone on", url, INDIVIDUAL_CALLS[ip][url], conf["max"],ip);
        return false;
    }
    return true;
}
function increaseAccountAPICall(req, res) {
    let cookie = req.cookies.AUTH_COOKIE;
    if (!cookie) {
        return true;
    }
    let unsigned = unsign(cookie, req, res);
    if (!unsigned) {
        return true; //if there's no account, why not just ignore it
    }
    unsigned = decodeURIComponent(unsigned);
    if (!unsigned)
        return false;
    let values = unsigned.split(" ");
    let username = values[0];
    if (API_CALLS_ACCOUNT[username] == undefined)
        API_CALLS_ACCOUNT[username] = 0;
    if (API_CALLS_ACCOUNT[username] >= config.rate_limits.api.max_per_account) {
        res.status(429);
        res.send("You are sending way too many api calls!");
        return false;
    }
    return true;
}
function increaseAPICall(req, res, next) {
    let ip = getIP(req);
    if (API_CALLS[ip] == undefined)
        API_CALLS[ip] = 0;
    if (API_CALLS[ip] >= config.rate_limits.api.max_without_session) {
        if (REVERSE_SESSIONS[ip] && req.cookies.session !== REVERSE_SESSIONS[ip]) { //expected a session, but didn't get one
            res.status(429);
            res.send("You are sending way too many api calls!");
            return;
        }
        if (!req.cookies.session) {
            let session;
            do {
                session = genstring(300);
            } while (SESSIONS[session] != undefined);
            SESSIONS[session] = ip;
            REVERSE_SESSIONS[ip] = session;
            setTimeout(function () {
                SESSIONS[session] = undefined;
                REVERSE_SESSIONS[ip] = undefined;
            }, 50000);
            res.cookie('session', session, { maxAge: 100000, httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
            console.log(3, "sending session to " + ip);
        }
    }
    if (API_CALLS[ip] >= config.rate_limits.api.max_with_session) {
        res.status(429);
        res.send("You are sending too many api calls!");
        console.log(3, "rate limiting " + ip);
        return false;
    }
    API_CALLS[ip]++;
    if (!increaseAccountAPICall(req, res))
        return false; //can't forget account-based ratelimits
    if (next)
        next();
    return true;
}
function increaseUSERCall(req, res, next) {
    let ip = getIP(req);
    if (USER_CALLS[ip] == undefined)
        USER_CALLS[ip] = 0;
    if (USER_CALLS[ip] >= config.rate_limits.user.max) {
        res.status(429);
        res.send("You are sending too many requests!");
        console.log(2, "rate limiting " + ip);
        return false;
    }
    USER_CALLS[ip]++;
    if (next)
        next();
    return true;
}
console.log(5, "loading routes");
app.use(useragent.express());
app.use(fileUpload());

app.use(bodyParser.default.json({ limit: "100mb" }));
app.use(bodyParser.default.urlencoded({ limit: "100mb", extended: true }));
app.use(clientErrorHandler);
app.use(cookieParser(cookiesecret));
app.use(compression())
var blocked_headers = [
    'HTTP_VIA',
    'HTTP_X_FORWARDED_FOR',
    'HTTP_FORWARDED_FOR',
    'HTTP_X_FORWARDED',
    'HTTP_FORWARDED',
    'HTTP_CLIENT_IP',
    'HTTP_FORWARDED_FOR_IP',
    'VIA',
    'X_FORWARDED_FOR',
    'FORWARDED_FOR',
    'X_FORWARDED',
    'FORWARDED',
    'CLIENT_IP',
    'FORWARDED_FOR_IP',
    'HTTP_PROXY_CONNECTION'
];
if (!config.disallow_proxies_by_headers) {
    blocked_headers = [];
}
app.use(function (_req, res, next) {
    res.set("X-XSS-Protection", "1; mode=block");
    next();
});
if (DID_I_FINALLY_ADD_HTTPS) {
    //auto redirect to https
    app.use((req, res, next) => {
        if (req.secure) {
            //already secure
            next();
        }
        else {
            //redirect to https
            res.redirect('https://' + req.headers.host + req.url);
        }
    });
}
app.use("/*", function (req, res, next) {
    res.set("x-powered-by", "ipost");
    for (let i = 0; i < blocked_headers.length; i++) {
        if (req.header(blocked_headers[i]) != undefined) {
            res.json({ "error": "we don't allow proxies on our website." });
            return;
        }
    }
    let fullurl = req.baseUrl + req.path;
    if (fullurl != "/") {
        fullurl = fullurl.substring(0, fullurl.length - 1);
    }
    if (!increaseIndividualCall(fullurl, req)) {
        res.status(429);
        res.json({ "error": "you are sending too many requests!" });
        return;
    }
    next();
});
console.log(5, "finished loading user routes, starting with api routes");
/*

START /API/*

*/
var wss;
var commonfunctions = {
    increaseAPICall,
    increaseUSERCall,
    increaseAccountAPICall,
    increaseIndividualCall,
    wss,
    genstring,
    ensureExists,
    "dirname": __dirname
};
optionssetup(router, con, commonfunctions);
allsetup(router, con, commonfunctions);
settingshandlersetup(router, con, commonfunctions);
const get_pid = postsetup(router, con, commonfunctions);
dmsPersonalMessagessetup(router, con, commonfunctions);
const get_dmpid = dmspostsetup(router, con, commonfunctions);

router.get("/api/getFileIcon/*",async function(req,res){
    let path = req.path.split("/api/getFileIcon/")[1]
    if(path.length > 4) {
        res.status(410).json({"error":"file ending is too long"})
        return;
    }
    addTextOnImage(path,await sharp("./images/empty_file.png").toBuffer()).then(buf => {
        res.set("content-type","image/png")
        res.send(buf)
    })
})

router.get("/api/search",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "");
    let type = req.query.type;
    let arg = encodeURIComponent(req.query.selector);
    if (type == "user") {
        let sql = `select User_Name,User_Bio,User_Avatar from ipost.users where User_Name like ? limit 10;`;
        con.query(sql, [`%${arg}%`], function (err, result) {
            if (err)
                throw err;
            if (result[0] && result[0].User_Name) {
                res.json(result);
            }
            else {
                res.json({ "error": "there is no such user!" });
            }
        });
    }
    else if (type == "post") {
        let sql = `select post_user_name,post_text,post_time,post_special_text,post_id from ipost.posts where post_text like ? and (post_receiver_name is null or post_receiver_name = 'everyone') order by post_id desc limit 20;`;
        con.query(sql, [`%${arg}%`], function (err, result) {
            if (err)
                throw err;
            if (result[0]) {
                res.json(result);
            }
            else {
                res.json({ "error": "there is no such post!" });
            }
        });
    }
    else {
        res.json({ "error": "invalid type passed along, expected `user` or `post`" });
    }
});
router.post("/api/setavatar", function (req, res) {
    res.set("Access-Control-Allow-Origin", "");
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(410).send('No files were uploaded. (req.files)');
    }
    let avatar = req.files.avatar;
    if (!avatar) {
        return res.status(411).send('No files were uploaded. (req.files.)');
    }
    let DOSbuf = Buffer.from('ffd8ffc1f151d800ff51d800ffdaffde', 'hex'); //causes DOS
    if (avatar.data.includes(DOSbuf)) {
        console.log(3, "DOS image was caught");
        return res.status(412).send('No files were uploaded. (req.files.)');
    }
    //DOS introduced through jimp (uses jpeg-js)
    const avatars = __dirname + '/avatars/';
    ensureExists(avatars, function (err) {
        if (err) {
            return res.status(500).json({ "error": "there's been an internal server error." });
        }
        if (res.locals.avatar) {
            try {
                unlinkSync(avatars + res.locals.avatar);
            } catch(ignored){}
        }
        let filename = genstring(96) + ".png";
        while (existsSync(avatars + "/" + filename) || filename == ".png") {
            console.log(5, "already have file: ", filename);
            original_log("already have file: ", filename);
            filename = genstring(96) + ".png";
        }
        sharp(avatar.data).resize({
            width: 100,
            height: 100
          }).toBuffer().then(function(data){
            writeFileSync(avatars + filename,data)
            let sql = `update ipost.users set User_Avatar=? where User_Name=?`;
            con.query(sql, [filename, encodeURIComponent(res.locals.username)], function (err) {
                if (err)
                    throw err;
                res.json({ "success": "updated avatar" });
            });
        })
    });         
});
router.get("/api/getuser",  function (_req, res) {
    res.json({ "username": res.locals.username, "bio": res.locals.bio, "avatar": res.locals.avatar });
});
router.get("/api/getalluserinformation",  function (req, res) {
    res.set("Access-Control-Allow-Origin", ""); //we don't want that here
    let unsigned = unsign.getunsigned(req, res);
    if (!unsigned)
        return;
    unsigned = decodeURIComponent(unsigned);
    let sql = `select * from ipost.users where User_Name=? and User_PW=?;`;
    let values = unsigned.split(" ");
    values[1] = SHA256(values[1], values[0], HASHES_DIFF);
    con.query(sql, values, function (err, result) {
        if (err)
            throw err;
        if (result[0] && result[0].User_Name && result[0].User_Name == values[0]) {
            res.status(200);
            res.json(result[0]);
        }
        else {
            res.status(402);
            res.json({ "error": "you cannot access the api without being logged in" });
        }
    });
});
router.get("/api/getotheruser",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    let username = req.query.user;
    let sql = `select User_Name,User_Bio,User_Avatar from ipost.users where User_Name=?;`;
    con.query(sql, [username], function (err, result) {
        if (err)
            throw err;
        if (result[0] && result[0].User_Name && result[0].User_Name == username) {
            res.json({ "username": username, "bio": result[0].User_Bio, "avatar": result[0].User_Avatar, "publicKey": result[0].User_PublicKey });
        }
        else {
            res.json({ "error": "there is no such user!" });
        }
    });
});
router.get("/api/getPosts/*",  function (_req, res) {
    res.set("Access-Control-Allow-Origin", "");
    res.redirect("/api/getPosts");
});
router.get("/api/getPosts",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.query.channel != undefined) {
        let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,User_Avatar,file_0,file_1,file_2,file_3,file_4 from ipost.posts inner join ipost.users on (User_Name = post_user_name) where post_receiver_name = ? group by post_id order by post_id desc limit 30;`;
        con.query(sql, [encodeURIComponent(req.query.channel)], function (err, result) {
            if (err)
                throw err;
            res.json(result);
        });
    }
    else { //fallback
        let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4 from ipost.posts where (post_receiver_name is null or post_receiver_name = 'everyone') group by post_id order by post_id desc limit 30;`;
        con.query(sql, [], function (err, result) {
            if (err)
                throw err;
            res.json(result);
        });
    }
});
router.get("/api/getPostsLowerThan",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.query.channel != undefined) {
        let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4 from ipost.posts where ((post_receiver_name = ?) and (post_id < ?)) group by post_id order by post_id desc limit 30;`;
        con.query(sql, [encodeURIComponent(req.query.channel), req.query.id], function (err, result) {
            if (err)
                throw err;
            res.json(result);
        });
    }
    else { //fallback
        let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4 from ipost.posts where ((post_receiver_name is null or post_receiver_name = 'everyone') and (post_id < ?)) group by post_id order by post_id desc limit 30;`;
        con.query(sql, [req.query.id], function (err, result) {
            if (err)
                throw err;
            res.json(result);
        });
    }
});
router.get("/api/getPost",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    let arg = req.query.id;
    let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,post_receiver_name,User_Avatar,file_0,file_1,file_2,file_3,file_4 from ipost.posts inner join ipost.users on (User_Name = post_user_name) where post_id=?;`;
    con.query(sql, [arg], function (err, result) {
        if (err)
            throw err;
        if (result[0]) {
            res.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            res.json(result[0]);
        }
        else {
            res.json({ "error": "there is no such post!" });
        }
    });
});
router.get("/api/getChannels",  function (_req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    let sql = `select post_receiver_name from ipost.posts where post_is_private = '0' group by post_receiver_name;`;
    con.query(sql, [], function (err, result) {
        if (err)
            throw err;
        res.json(result);
    });
});
router.post("/api/setBio",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "");
    let bio = req.body.Bio;
    if (!bio) {
        res.status(410);
        res.json({ "error": "no bio set!" });
        return;
    }
    bio = encodeURIComponent(bio);
    if (bio.length > 100) {
        res.status(411);
        res.json({ "error": "the bio is too long!" });
        return;
    }
    let sql = `update ipost.users set User_Bio=? where User_Name=?`;
    con.query(sql, [bio, encodeURIComponent(res.locals.username)], function (err) {
        if (err)
            throw err;
        res.json({ "success": "updated bio" });
    });
});
router.post("/api/changePW", (req, res) => {
    res.set("Access-Control-Allow-Origin", "");
    if ((typeof req.body.newPW) != "string") {
        res.json({ "error": "incorrect password" });
        return;
    }
    if ((typeof req.body.currentPW) != "string") {
        res.json({ "error": "incorrect password" });
        return;
    }
    if (req.body.newPW.length < 10) {
        res.status(410);
        res.json({ "error": "password is too short" });
        return;
    }
    let hashed_pw = SHA256(req.body.currentPW, res.locals.username, HASHES_DB);
    let hashed_new_pw = SHA256(req.body.newPW, res.locals.username, HASHES_DB);
    let sql = `select * from ipost.users where User_Name=? and User_PW=?;`;
    let values = [res.locals.username, hashed_pw];
    con.query(sql, values, function (err, result) {
        if (err)
            throw err;
        if (result[0] && result[0].User_Name && result[0].User_Name == res.locals.username) {
            let sql = `update ipost.users set User_PW=? where User_Name=? and User_PW=?;`;
            let values = [hashed_new_pw, res.locals.username, hashed_pw];
            con.query(sql, values, (err2) => {
                if (err2)
                    throw err2;
                let ip = getIP(req);
                let setTo = `${res.locals.username} ${SHA256(req.body.newPW, res.locals.username, HASHES_COOKIE)}`
                let cookiesigned = signature.sign(setTo, cookiesecret + ip);
                res.cookie('AUTH_COOKIE', cookiesigned, { maxAge: Math.pow(10, 10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
                res.json({ "success": "successfully changed password" });
            });
        }
        else {
            res.json({ "error": "invalid password" });
        }
    });
});
router.post("/api/changeUsername",  function (req, res) {
    res.set("Access-Control-Allow-Origin", "");
    if ((typeof req.body.newUsername) != "string") {
        res.status(410);
        res.json({ "error": "incorrect username" });
        return;
    }
    if ((typeof req.body.currentPW) != "string") {
        res.status(411);
        res.json({ "error": "incorrect password" });
        return;
    }
    if (req.body.newUsername.length > 100) {
        res.status(412);
        res.json({ "error": "username is too long" });
        return;
    }
    if (req.body.newUsername == res.locals.username) {
        res.status(413);
        res.json({ "error": "username can't be the current one" });
        return;
    }
    let hashed_pw = SHA256(req.body.currentPW, res.locals.username, HASHES_DB);
    let hashed_new_pw = SHA256(req.body.currentPW, req.body.newUsername, HASHES_DB);
    let sql = `select * from ipost.users where User_Name=?;`; //check if pw is correct
    let values = [res.locals.username];
    con.query(sql, values, function (err, result) {
        if (err)
            throw err;
        if (result[0] && result[0].User_PW == hashed_pw) {
            let sql = `select * from ipost.users where User_Name=?;`; //check if newUsername isn't already used
            let values = [req.body.newUsername];
            con.query(sql, values, function (err, result) {
                if (err)
                    throw err;
                if (result[0]) {
                    res.json({ "error": "user with that username already exists" });
                    return;
                }
                let sql = `update ipost.users set User_PW=?,User_Name=? where User_Name=? and User_PW=?;`; //change username in users
                let values = [hashed_new_pw, req.body.newUsername, res.locals.username, hashed_pw];
                con.query(sql, values, function (err) {
                    if (err)
                        throw err;
                    let ip = getIP(req);
                    let setTo = `${req.body.newUsername} ${SHA256(req.body.currentPW, req.body.newUsername, HASHES_COOKIE)}`
                    let cookiesigned = signature.sign(setTo, cookiesecret + ip);
                    res.cookie('AUTH_COOKIE', cookiesigned, { maxAge: Math.pow(10, 10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
                    //updated username in the users table, but not yet on posts
                    let sql = `update ipost.posts set post_user_name=? where post_user_name=?;`; //change username of every past post sent
                    let values = [req.body.newUsername, res.locals.username, hashed_pw];
                    con.query(sql, values, () => {
                        res.json({ "success": "successfully changed username" }); //done
                    });
                });
            });
        }
        else {
            res.json({ "error": "invalid password" });
        }
    });
});
/*

END /API/*

*/
router.get("/users/*",  function (req, res) {
    if (!increaseUSERCall(req, res))
        return;
    res.sendFile(dir + "views/otheruser.html");
});
router.get("/css/*", (request, response) => {
    if (!increaseUSERCall(request, response))
        return;
    if (existsSync(__dirname + request.originalUrl)) {
        response.sendFile(__dirname + request.originalUrl);
    }
    else {
        response.status(404).send("no file with that name found");
    }
    return;
});
router.get("/js/*", (request, response) => {
    if (!increaseUSERCall(request, response))
        return;
    if (existsSync(__dirname + request.originalUrl)) {
        response.sendFile(__dirname + request.originalUrl);
    }
    else {
        response.status(404).send("no file with that name found");
    }
    return;
});
router.get("/images/*", (request, response) => {
    if (!increaseUSERCall(request, response))
        return;
    if (existsSync(__dirname + request.originalUrl)) {
        response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
        response.sendFile(__dirname + request.originalUrl);
    }
    else if(existsSync(__dirname + request.originalUrl.toLowerCase())){
        response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
        response.sendFile(__dirname + request.originalUrl.toLowerCase());
    }
    else {
        response.status(404).send("no file with that name found");
    }
    return;
});

router.get("/user_uploads/*", (request, response) => {
    if (!increaseUSERCall(request, response))
        return;
    if (existsSync(__dirname + request.originalUrl)) {
        response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
        response.sendFile(__dirname + request.originalUrl);
    }
    else {
        response.status(404).send("no file with that name found");
    }
    return;
});

router.get("/avatars/*", (request, response) => {
    if (!increaseUSERCall(request, response))
        return;
    response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
    let originalUrl = request.originalUrl.split("?").shift();
    if (existsSync(dir + originalUrl + ".png")) {
        return response.sendFile(dir + originalUrl + ".png");
    }
    if (existsSync(dir + originalUrl)) {
        return response.sendFile(dir + originalUrl);
    }
    response.status(404).send("No avatar with that name found");
});
router.get("/logout",  function (_req, res) {
    res.cookie("AUTH_COOKIE", "", { maxAge: 0, httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
    res.redirect("/");
});

import ejs from "ejs"
import LRU from "lru-cache"

ejs.cache = new LRU({max:20})

const load_var_cache = new LRU({
    max: 20,
    maxSize: 10000,
    sizeCalculation: (value) => {
        return value.length
    },
    ttl: 1000 * 60,
    allowStale: true,
    updateAgeOnGet: true,
    updateAgeOnHas: true
})

import {minify as min_js} from "uglify-js"
import Clean from 'clean-css';
import Minifier from 'html-minifier-terser';

function load_var(fina) {
    if(load_var_cache.get(fina))return load_var_cache.get(fina)
    if(!existsSync(fina)) {
        console.log(1,"tried loading non-existent file",fina)
        load_var_cache.set(fina,"")
        return "";
    }
    let out = readFileSync(fina)
    if(fina.endsWith(".js")) {
        out = min_js(out.toString()).code
    }
    else if(fina.endsWith(".css")) {
        const {
            styles,
        } = new Clean({}).minify(out.toString());
        out = styles
    }

    load_var_cache.set(fina,out)
    
    return out
}

function get_channels(){
    return new Promise(function(resolve, reject) {
        let sql = `select post_receiver_name from ipost.posts where post_is_private = '0' group by post_receiver_name;`;
        con.query(sql, [], function (err, result) {
            if (err)reject(err)

            let out = []

            for(let channel of result){
                if(channel.post_receiver_name == "")continue;
                out[out.length] = channel.post_receiver_name
            }

            resolve(out)
        });
    })
}

import { web_version } from "unsafe_encrypt";

let global_page_variables = {
    globalcss: load_var("./css/global.css"),
    httppostjs: load_var("./js/httppost.js"),
    navbar: load_var("./extra_modules/navbar.html"),
    markdownjs: load_var("./js/markdown.js"),
    htmlescapejs: load_var("./js/htmlescape.js"),
    warnmessagejs: load_var("./js/warn_message.js"),
    loadfile: load_var,
    getChannels: get_channels,
    getPID: get_pid,
    getDMPID: get_dmpid,
    encryptJS: min_js(web_version().toString()).code,
    cookiebanner: `<script id="cookieyes" type="text/javascript" src="https://cdn-cookieyes.com/client_data/3cf33f6b631f3587bf83813b/script.js" async></script>`,
    newrelic: load_var("./extra_modules/newrelic_monitor.html")
}

 function handleUserFiles(request, response, overrideurl) {
    if (!increaseUSERCall(request, response))return;
    if(typeof overrideurl != "string")overrideurl = undefined;

    let originalUrl = overrideurl || request.originalUrl.split("?").shift();

    let path = ""
    //console.log("handling user file")
    if (existsSync(dir + "views" + originalUrl)) {
        //console.log("exists without additional path");
        path = dir + "views" + originalUrl
        if(originalUrl.endsWith(".txt")) {
            response.set('Content-Type', 'text/plain');
            //console.log("sending txt file")
            readFile(path,(err,data)=> {
                if(err)return
                response.send(data)
            })
            return
        }
        //return response.sendFile(dir + "views" + originalUrl);
    }
    if (existsSync(dir + "views/" + originalUrl + "index.html")) {
        path = dir + "views/" + originalUrl + "index.html"
    }
    if (existsSync(dir + "views/" + originalUrl + ".html")) {
        path = dir + "views/" + originalUrl + ".html"
        //return response.sendFile(dir + "views/" + originalUrl + ".html");
    }
    if (existsSync(dir + "views" + originalUrl + ".html")) {
        path = dir + "views" + originalUrl + ".html"
        //return response.sendFile(dir + "views" + originalUrl + ".html");
    }

    if(path != "" && originalUrl != "/favicon.ico" && originalUrl != "/api/documentation/") {
        global_page_variables.user = { "username": response.locals.username, "bio": response.locals.bio, "avatar": response.locals.avatar }
        ejs.renderFile(path,global_page_variables,{async: true},async function(err,str){
            str = await str
            err = await err
            if(err) {
                console.log(1,err)
                response.status(500)
                response.send("error")
                //TODO: make error page
                return
            }
            try {
                str = await Minifier.minify(str,{
                    removeComments: true,
                    removeCommentsFromCDATA: true,
                    removeCDATASectionsFromCDATA: true,
                    collapseWhitespace: true,
                    collapseBooleanAttributes: true,
                    removeAttributeQuotes: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true
                })
            } catch(ignored){
                console.log(2,"error minifying",originalUrl);
            }

            try {
                response.send(str)
            } catch(err) {
                console.error(err)
            }
        })
        return;
    }

    if(originalUrl == "/favicon.ico") {
        response.set('Cache-Control', 'public, max-age=2592000');
        response.sendFile(dir + "/views/favicon.ico")
        return
    }

    if(originalUrl == "/api/documentation/") {
        readFile(path,function(_err,res){
            response.send(res.toString())
        })
        return
    }

    console.log(5,"no file found",originalUrl);
    try {
        response.status(404).send("No file with that name found");
    } catch(err) {
        console.error(err)
    }
}

router.get("/", function (req, res) {
    // if (!increaseUSERCall(req, res))
    //     return;
    handleUserFiles(req,res,"/index")
    //res.sendFile(dir + "views/index.html");
});

router.get("/*", handleUserFiles);

router.post("/register",  function (req, res) {
    for (let i = 0; i < 10; i++) { //don't want people spam registering
        if (!increaseAPICall(req, res))
            return;
    }
    res.status(200);
    if ((typeof req.body.user) != "string") {
        res.status(416);
        res.json({ "error": "incorrect username" });
        return;
    }
    if ((typeof req.body.pass) != "string") {
        res.status(417);
        res.json({ "error": "incorrect password" });
        return;
    }
    let username = req.body.user.toString();
    username = username.replace(/\s/gi, "");
    let password = req.body.pass.toString();
    if (!username) {
        res.status(410);
        res.redirect("/register?success=false&reason=username");
        return;
    }
    if (username == "") {
        res.status(411);
        res.redirect("/register?success=false&reason=username");
        return;
    }
    if (password.length < 10) {
        res.status(412);
        res.send("password is too short");
        return;
    }
    if (username.length > 25) {
        res.status(413);
        res.send("username is too long");
        return;
    }
    if (username.search("@") != -1) {
        res.status(414);
        res.send("username can't contain @-characters");
        return;
    }
    if (!password) {
        res.status(415);
        res.redirect("/register?success=false&reason=password");
        return;
    }
    let userexistssql = `SELECT User_Name from ipost.users where User_Name = ?`;
    con.query(userexistssql, [encodeURIComponent(username)], function (_error, result) {
        if (result && result[0] && result[0].User_Name) {
            res.status(418);
            res.redirect("/register?success=false&reason=already_exists");
            return;
        }
        let less_hashed_pw = SHA256(password, username, HASHES_DIFF);
        let hashed_pw = SHA256(less_hashed_pw, username, HASHES_COOKIE);
        let ip = getIP(req);
        let setTo = `${username} ${SHA256(password, username, HASHES_COOKIE)}`
        let cookiesigned = signature.sign(setTo, cookiesecret + ip);
        ip = SHA256(ip, setTo, HASHES_DB);
        const default_settings = {};
        let values = [encodeURIComponent(username), hashed_pw, Date.now(), ip, ip, JSON.stringify(default_settings)];
        let sql = `INSERT INTO ipost.users (User_Name, User_PW, User_CreationStamp, User_CreationIP, User_LastIP, User_Settings) VALUES (?, ?, ?, ?, ?, ?);`;
        con.query(sql, values, function (err) {
            if (err)
                throw err;
            res.cookie('AUTH_COOKIE', cookiesigned, { maxAge: Math.pow(10, 10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
            res.redirect("/user?success=true");
        });
    });
});
router.post("/login",  function (req, res) {
    if (!increaseAPICall(req, res))
        return;
    if (!increaseAPICall(req, res))
        return;
    //login is counted twice (think of bruteforces man)
    if ((typeof req.body.user) != "string") {
        res.status(416);
        res.json({ "error": "incorrect username" });
        return;
    }
    if ((typeof req.body.pass) != "string") {
        res.status(417);
        res.json({ "error": "incorrect password" });
        return;
    }
    if (!req.body.user) {
        res.status(410);
        res.send("no username given");
        return;
    }
    if (!req.body.pass) {
        res.status(411);
        res.send("no password given");
        return;
    }
    let username = req.body.user.toString();
    username = username.replace(" ", "");
    let password = req.body.pass.toString();
    if (!username) {
        res.status(412);
        res.send("no username given");
        return;
    }
    if (username.length > 25) {
        res.status(413);
        res.send("username is too long");
        return;
    }
    if (password.length < 10) {
        res.status(414);
        res.send("password is too short");
        return;
    }
    if (!password) {
        res.status(415);
        res.send("no password given");
        return;
    }

    const no_ip_lock = username.endsWith("@unsafe")
    username = username.replace("@unsafe","")

    let less_hashed_pw = SHA256(password, username, HASHES_DIFF);
    let hashed_pw = SHA256(less_hashed_pw, username, HASHES_COOKIE);
    let userexistssql = `SELECT * from ipost.users where User_Name = ? and User_PW = ?;`;
    con.query(userexistssql, [encodeURIComponent(username), hashed_pw], function (_error, result) {
        if (result && result[0]) {
            let ip = getIP(req);
            let setTo = `${username} ${SHA256(password, username, HASHES_COOKIE)}`
            let cookiesigned = signature.sign(setTo, cookiesecret + (!no_ip_lock ? ip : ""));
            res.cookie('AUTH_COOKIE', cookiesigned, { maxAge: Math.pow(10, 10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
            ip = SHA256(ip, setTo, HASHES_DB);
            if (result[0].User_LastIP != ip) {
                let sql = `update ipost.users set User_LastIP = ? where User_Name = ?;`;
                con.query(sql, [ip, encodeURIComponent(username)], function (error) {
                    if (error)
                        throw error;
                });
            }
            res.redirect("/user?success=true");
        }
        else {
            console.log(5,"login failed, username: ", username);
            res.redirect("/login?success=false?reason=noUser");
        }
    });
});
console.log(5, "finished loading routes");
app.use(router);
const httpServer = http.createServer(app);
httpServer.listen(config["ports"]["http"], function () {
    console.log(5, "HTTP Server is listening");
});
const privateKey = readFileSync(config["ssl"]["privateKey"]).toString();
const certificate = readFileSync(config["ssl"]["certificate"]).toString();
const credentials = { key: privateKey, cert: certificate };
var httpsServer;

import spdy from "spdy"

if (DID_I_FINALLY_ADD_HTTPS) {
    httpsServer = spdy.createServer(credentials,app)
    //httpsServer = https.createServer(credentials, app);
    httpsServer.listen(config["ports"]["https"], function () {
        console.log(5, "HTTPS Server is listening");
    });
}
else {
    httpsServer = httpServer;
}
wss = new WebSocket({
    server: httpsServer,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024 * 16
    }
});
wss.on("connection", function connection(ws) {
    ws.channel = "everyone";
    console.log(5,"new connection");
    ws.on("message", function incoming(message) {
        message = JSON.parse(message);
        if (message.id == "switchChannel") {
            ws.channel = decodeURIComponent(message.data);
        }
    });
});
commonfunctions.wss = wss;
console.log(5, "starting up all services");
