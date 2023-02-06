import fs from "fs";
import {SHA256} from "../../extra_modules/SHA.js";
import {unsign} from "../../extra_modules/unsign.js";
const config = JSON.parse(fs.readFileSync("server_config.json"));
const HASHES_DB = config.cookies.server_hashes;
const HASHES_COOKIE = config.cookies.client_hashes;
const HASHES_DIFF = HASHES_DB - HASHES_COOKIE;

export const setup = function (router, con, server) {
    router.use("/*", (req, res, next) => {
        res.set("Access-Control-Allow-Origin", "*"); //we'll allow it for now
        let unsigned;
        if (req.body.user == undefined || req.body.pass == undefined) {
            if(typeof req.get("ipost-auth-token") === "string") {
                try{
                    req.body.auth = JSON.parse(req.get("ipost-auth-token"))
                } catch(err) {
                    console.log("error parsing header",err)
                }
            }
            if(req.body.auth != undefined) {
                if(typeof req.body.auth === "string") {
                    try{
                        req.body.auth = JSON.parse(req.body.auth)
                    } catch(err) {
                        console.log("error parsing",err)
                    }
                } else 
                if(
                    typeof req.body.auth            !== "object" || 
                    typeof req.body.auth.secret     !== "string" || 
                    typeof req.body.auth.appid      !== "number" || 
                    typeof req.body.auth.auth_token !== "string" || 
                    req.body.auth.secret.length     !== 200      || 
                    req.body.auth.auth_token.length !== 100      ||
                    Buffer.from(req.body.auth.secret,"base64").length !== 150
                ) {
                    res.status(420).send("invalid authentication object")
                    return;
                } else {
                    //secret    : string(200 chars)
                    //appid     : number
                    //auth_token: string(100 chars)
                    let sql = "select User_ID,User_Name,User_Bio,User_Avatar,User_Settings from ipost.auth_tokens inner join ipost.application on auth_token_isfrom_application_id=application_id inner join ipost.users on auth_token_u_id=User_ID where auth_token=? and application_secret=? and application_id=?"
                    con.query(sql,[SHA256(req.body.auth.auth_token,req.body.auth.appid, HASHES_DB),SHA256(req.body.auth.secret,req.body.auth.appid, HASHES_DB),req.body.auth.appid],(err,result) => {
                        if(err) throw err;

                        if(result.length != 1) {
                            res.status(420).send("invalid authentication object (or server error?)")
                            return;
                        }

                        res.locals.userid = result[0].User_ID;
                        res.locals.username = result[0].User_Name;
                        res.locals.bio = result[0].User_Bio || "";
                        res.locals.avatar = result[0].User_Avatar || "";
                        res.locals.settings = result[0].User_Settings || {};

                        res.locals.isbot = true; //only apps/bots use auth tokens

                        next()
                    })
                    return;
                }
            } else {
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
            
        }
        else {
            unsigned = `${req.body.user} ${SHA256(req.body.pass, req.body.user, HASHES_COOKIE)}`;
            res.set("message","user+pass authentication is deprecated as of february 2023, consider switching to auth tokens")
            //basically we generate the unsigned cookie
            res.locals.isbot = true; //only bots use user+pass
        }
        let sql = `select User_ID,User_Name,User_Bio,User_Avatar,User_Settings from ipost.users where User_Name=? and User_PW=?;`;
        let values = unsigned.split(" ");
        values[1] = SHA256(values[1], values[0], HASHES_DIFF);
        res.locals.bio = "";
        res.locals.avatar = "";
        res.locals.settings = {};
        con.query(sql, values, function (err, result) {
            if (err)
                throw err;
            if (result[0] && result[0].User_Name && result[0].User_Name == values[0]) {

                res.locals.userid   = result[0].User_ID;
                res.locals.username = result[0].User_Name;
                res.locals.bio      = result[0].User_Bio || "";
                res.locals.avatar   = result[0].User_Avatar || "";
                res.locals.settings = result[0].User_Settings || {};
                
            }
            next()
        });
    });

    router.use("/api/*", (req, res, next) => {
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
