import fs from "fs";
import {SHA256} from "../../extra_modules/SHA.js";
import {unsign} from "../../extra_modules/unsign.js";
const config = JSON.parse(fs.readFileSync("server_config.json"));
const HASHES_DB = config.cookies.server_hashes;
const HASHES_COOKIE = config.cookies.client_hashes;
const HASHES_DIFF = HASHES_DB - HASHES_COOKIE;
export const setup = function (router, con, server) {
    router.use("/*",  function (req, res, next) {
        res.set("Access-Control-Allow-Origin", "*"); //we'll allow it for now
        let unsigned;
        if (req.body.user == undefined || req.body.pass == undefined) {
            if(!req.cookies.AUTH_COOKIE) {
                next()
                return
            }
            unsigned = unsign(req.cookies.AUTH_COOKIE, req, res);
            if (!unsigned){
                next()
                return
            }
        }
        else {
            unsigned = `${req.body.user} ${SHA256(req.body.pass, req.body.user, HASHES_COOKIE)}`;
            //basically we generate the unsigned cookie
            res.locals.isbot = true; //only bots use user+pass
        }
        let sql = `select User_Name,User_Bio,User_Avatar,User_Settings from ipost.users where User_Name=? and User_PW=?;`;
        let values = unsigned.split(" ");
        values[1] = SHA256(values[1], values[0], HASHES_DIFF);
        res.locals.bio = "";
        res.locals.avatar = "";
        res.locals.settings = {};
        con.query(sql, values, function (err, result) {
            if (err)
                throw err;
            if (result[0] && result[0].User_Name && result[0].User_Name == values[0]) {
                res.locals.username = values[0];
                res.locals.bio = result[0].User_Bio || "";
                res.locals.avatar = result[0].User_Avatar || "";
                res.locals.settings = JSON.parse(result[0].User_Settings);
                if (res.locals.settings == "null")
                    res.locals.settings = {};
                if (res.locals.settings === null)
                    res.locals.settings = {};
                
            }
            next()
        });
    });

    router.use("/api/*",  function (req, res, next) {
        res.set("Access-Control-Allow-Origin", "*"); //we'll allow it for now
        if (config["allow_getotheruser_without_cookie"] && req.originalUrl.split("\?")[0] == "/api/getotheruser") {
            next();
            return;
        }
        if (!server.increaseAPICall(req, res))return;

        if (res.locals.username != undefined) {
            next();
        }
        else {
            res.status(402);
            res.json({ "error": "you cannot access the api without being logged in" });
        }
    });
};
export default {
    setup
};
