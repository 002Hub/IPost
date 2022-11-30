import sharp from "sharp"
import { ensureExists } from "../../extra_modules/ensureExists.js"
import {SHA256} from "../../extra_modules/SHA.js";
import getIP from "../../extra_modules/getip.js";
import {getunsigned} from "../../extra_modules/unsign.js";

export const setup = function (router, con, server) {
    const config = server.config
    const HASHES_DB = config.cookies.server_hashes;
    const HASHES_COOKIE = config.cookies.client_hashes;
    const HASHES_DIFF = HASHES_DB - HASHES_COOKIE;
    router.post("/api/setavatar", function (req, res) {
        res.set("Access-Control-Allow-Origin", "");
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(410).send('No files were uploaded. (req.files)');
        }
        let avatar = req.files.avatar;
        if (!avatar) {
            return res.status(411).send('No files were uploaded. (req.files.)');
        }
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
            let filename = genstring(95) + ".webp";
            while (existsSync(avatars + "/" + filename) || filename == ".webp") { //generate new filename until it's unique
                filename = genstring(95) + ".webp";
            }
            sharp(avatar.data).resize({ //resize avatar to 100x100 and convert it to a webp, then store it
                width: 100,
                height: 100
            }).webp({
                effort: 6,
                mixed: true
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
        let unsigned = getunsigned(req, res);
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
                        //TODO: update username on dms
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
}