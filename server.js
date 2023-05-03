import "newrelic"

import http from "http";
import express,{Router} from "express";
import useragent from "express-useragent";
import fileUpload from "express-fileupload";
import * as bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import * as mysql from "mysql2";
import * as ws from "ws";
import getIP from "./extra_modules/getip.js";
import {unsign} from "./extra_modules/unsign.js";
import { readFileSync, appendFile } from "fs";
import { format } from "util";
import { setup as SETUP_ROUTES} from "./routes/setup_all_routes.js"
import { verify as verifyHCaptcha_int } from "hcaptcha"
import hsts from "hsts"

import { ensureExists } from "./extra_modules/ensureExists.js"

import * as compress from "compression"
const compression = compress.default

import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = JSON.parse(readFileSync("server_config.json"));
const time = Date.now();
const original_log = console.log;
/**
 * custom logging function
 * @param  {number}     level               importance level if information
 * @param  {any}        info                information to format + log
 * @return {undefined}                      returns nothing
 */
function log_info(level, ...info) {
    let text = info;
    if (text === undefined || text.length === 0) {
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


const hcaptcha_secret = config.hcaptcha_secret
// wrapper for the HCaptcha verify function
function verifyHCaptcha(token) {
    return verifyHCaptcha_int(hcaptcha_secret,token,undefined,config.hcaptcha_sitekey)
}

const WebSocket = ws.WebSocketServer;

const router = Router();
const app = express();
const con = mysql.createPool({
    connectionLimit: config.mysql.connections,
    host: config.mysql.host,
    user: config.mysql.user,
    password: readFileSync(config.mysql.password_file).toString(),
    multipleStatements: true,
    supportBigNumbers: true,
});
const cookiesecret = readFileSync("cookiesecret.txt").toString();

/**
 * custom, bad random number generator
 * @param       {number} seed  seed for the number generator, defaults to current timestamp
 * @constructor
 */
class RNG {
    constructor(seed) {
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
    if (INDIVIDUAL_CALLS[ip] === undefined)
        INDIVIDUAL_CALLS[ip] = {};
    if (INDIVIDUAL_CALLS[ip][url] === undefined)
        INDIVIDUAL_CALLS[ip][url] = 0;
    if (INDIVIDUAL_CALLS[ip][url] === 0) {
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
    if (API_CALLS_ACCOUNT[username] === undefined)
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
    if (API_CALLS[ip] === undefined)
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
            } while (SESSIONS[session] !== undefined);
            SESSIONS[session] = ip;
            REVERSE_SESSIONS[ip] = session;
            setTimeout(function () {
                SESSIONS[session] = undefined;
                REVERSE_SESSIONS[ip] = undefined;
            }, 50000);
            res.cookie('session', session, { maxAge: 100000, httpOnly: true, secure: true });
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
    if (USER_CALLS[ip] === undefined)
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
app.use(fileUpload({
    limits: {
        files: 5,
        fileSize: 1_000_000
    }
}));

app.use(hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
}));

app.use(bodyParser.default.json({ limit: "100mb" }));
app.use(bodyParser.default.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser(cookiesecret));
app.use(compression())
let blocked_headers = [
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

app.use("/*", function (req, res, next) {
    res.set("x-powered-by", "ipost");
    for (let i = 0; i < blocked_headers.length; i++) {
        if (req.header(blocked_headers[i]) !== undefined) {
            res.json({ "error": "we don't allow proxies on our website." });
            return;
        }
    }
    let fullurl = req.baseUrl + req.path;
    if (fullurl !== "/") {
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
    "dirname": __dirname,
    config,
    hcaptcha: {
        "verify":verifyHCaptcha,
        "sitekey":config.hcaptcha_sitekey
    }
};

SETUP_ROUTES(router,con,commonfunctions)


router.get("/api/getChannels",  function (_req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    let sql = `select post_receiver_name from ipost.posts where post_is_private = '0' group by post_receiver_name;`;
    con.query(sql, [], function (err, result) {
        if (err)
            throw err;
        res.json(result);
    });
    /* #swagger.security = [{
        "appTokenAuthHeader": []
    }] */
});
/*

END /API/*

*/

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

httpsServer = spdy.createServer(credentials,app)
//httpsServer = https.createServer(credentials, app);
httpsServer.listen(config["ports"]["https"], function () {
    console.log(5, "HTTPS Server is listening");
});

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
        if (message.id === "switchChannel") {
            ws.channel = decodeURIComponent(message.data);
        }
    });
});
commonfunctions.wss = wss;
console.log(5, "starting up all services");
