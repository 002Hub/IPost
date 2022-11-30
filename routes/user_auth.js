import {SHA256} from "../extra_modules/SHA.js";
import * as signature from "cookie-signature";
import getIP from "../extra_modules/getip.js";
import {readFileSync} from "fs"

const cookiesecret = readFileSync("cookiesecret.txt").toString();

export const setup = function (router, con, server) {
    const config = server.config
    const DID_I_FINALLY_ADD_HTTPS = server.DID_I_FINALLY_ADD_HTTPS
    const increaseAPICall = server.increaseAPICall
    const HASHES_DB = config.cookies.server_hashes;
    const HASHES_COOKIE = config.cookies.client_hashes;
    const HASHES_DIFF = HASHES_DB - HASHES_COOKIE;

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
                if(req.body.r !== undefined) {
                    res.redirect(decodeURIComponent(req.body.r))
                } else {
                    res.redirect("/user");
                }
            });
        });
    });
    router.post("/login",  function (req, res) {
        if (!increaseAPICall(req, res))
            return;
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
                if(req.body.r !== undefined) {
                    res.redirect(decodeURIComponent(req.body.r))
                } else {
                    res.redirect("/user");
                }
            }
            else {
                console.log(5,"login failed, username: ", username);
                res.redirect("/login?success=false?reason=noUser");
            }
        });
    });
}