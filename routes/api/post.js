import sharp from "sharp";
import {writeFile} from "fs";

const image_types = {
    "png":true,
    "jpg":true,
    "jpeg":true,
    "webp":true,
    "jfif":true
}

export const setup = function (router, con, server) {
    const PIDS = {}; //[pid]: true/"already_used"

    function isNotNull(a) {
        return typeof a !== "undefined" && a !== null
    }

    function createPID(){
        let pid = server.genstring(10); //collision chance is low enough, but we'll check anyways
        while (PIDS[pid] != undefined) {
            pid = server.genstring(10);
            console.log(5, "pid collision");
        }
        PIDS[pid] = true;
        setTimeout(function() {
            PIDS[pid] = undefined;
        }, 40000);
        return pid
    }

    router.get("/api/pid",  function (req, res) {
        res.set("Access-Control-Allow-Origin", "*");
        res.json({ "pid": createPID() });
    });
    router.post("/api/post",  function (req, res) {
        if (!req.body.message) {
            res.status(410)
            res.json({ "error": "no message to post" });
            return;
        }
        if ((typeof req.body.message) != "string") {
            res.status(411)
            res.json({ "error": "no message to post" });
            return;
        }
        if ((typeof req.body.pid) != "string") {
            res.status(412)
            res.json({ "error": "no pid given" });
            return;
        }
        if (req.body.pid.length != 10 || PIDS[req.body.pid] !== true) {
            res.status(413)
            res.json({ "error": "invalid pid given" });
            return;
        }
        PIDS[req.body.pid] = "already_used";
        let reply_id;
        if (!req.body.reply_id || req.body.reply_id < 0) {
            reply_id = 0;
        }
        else {
            reply_id = req.body.reply_id;
        }
        if(typeof reply_id == "string") {
            reply_id = parseInt(reply_id,10)
            if(isNaN(reply_id)) {
                res.status(414)
                res.json({ "error": "no valid reply id given" });
                return;
            }
        }
        if ((typeof reply_id) != "number") {
            res.status(415)
            res.json({ "error": "no valid reply id given" });
            return;
        }
        if (req.body.message.length > 1000) {
            res.status(416)
            res.json({ "error": "message too long" });
            return;
        }
        req.body.message = encodeURIComponent(req.body.message.trim());
        if (req.body.message.length > 3000) {
            res.status(417)
            res.json({ "error": "message too long" }); //check again after URI encoding it
            return;
        }
        req.body.receiver = encodeURIComponent(req.body.receiver || "");
        if (req.body.receiver == "")
            req.body.receiver = "everyone";
        if (!req.body.message) {
            res.status(418)
            res.json({ "error": "no message to post" });
            return;
        }
        console.log(req.body);
        let __dirname = server.dirname

        const file_names = ["","","","",""]
        if(isNotNull(req.files)) {
            for(let file_index=0;file_index<5;file_index++) {
                if(isNotNull(req.files[`file_${file_index}`])) {
                    let file = req.files[`file_${file_index}`]
                    const file_id = server.genstring(20)
                    const file_name = `${file_id}/${(file.name.substring(0,25)).replace(/\.[^/.]+$/, "")}`
                    let extension = file.name.substring(file.name.lastIndexOf("\.")+1)
                    file_names[file_index]=`${file_name}${(extension in image_types && ".webp") || extension}`
                    server.ensureExists(`${__dirname}/user_uploads/${file_id}`,undefined,async (err)=>{
                        if(err) {
                            console.error(err)
                            return;
                        }
                        if(extension in image_types) {
                            writeFile(`${__dirname}/user_uploads/${file_name}.webp`,await sharp(file.data).webp({mixed:true,effort:6}).toBuffer(),(err2)=>{
                                if(err2)console.error(err2)
                            })
                            server.ensureExists(`${__dirname}/user_uploads/previews/${file_id}`,undefined,async (error) => {
                                if(error) {
                                    console.error(error)
                                    return;
                                }
                                writeFile(`${__dirname}/user_uploads/previews/${file_name}.webp`,await sharp(file.data).resize(50,28,{fit: "inside"}).webp({mixed:true,effort:6}).toBuffer(),(error2)=>{
                                    if(error2)console.error(error2)
                                })
                            })
                        } else {
                            file.mv(`${__dirname}/user_uploads/${file_name}.${extension}`,(err2)=>{
                                if(err2)console.error(err2)
                            })
                        }
                    })
                } else {
                    break
                }
            }
        }
        

        let sql = `insert into ipost.posts (post_user_name,post_text,post_time,post_receiver_name,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4) values (?,?,?,?,?,?,?,?,?,?,?);`;
        let values = [encodeURIComponent(res.locals.username), req.body.message, Date.now(), req.body.receiver, res.locals.isbot, reply_id,...file_names];
        con.query(sql, values, function (err, result) {
            if (err){
                res.status(500)
                res.json({"error":"there's been an interal error"})
                console.error(err)
                return;
            }
            let post_obj = {
                post_user_name: encodeURIComponent(res.locals.username),
                post_text: req.body.message,
                post_time: Date.now(),
                post_special_text: "",
                post_receiver_name: req.body.receiver,
                post_from_bot: res.locals.isbot,
                post_reply_id: reply_id,
                user_avatar: res.locals.avatar,
                files: file_names
            };
            let message = {
                message: "new_post",
                data: post_obj
            };
            let messagestr = JSON.stringify(message);
            //console.log(5,server.wss.clients);       /* DEBUG: Log websocket clients */
            server.wss.clients.forEach(function(ws) {
                //console.log(5,ws); /* DEBUG: Log websocket clients */
                ws.send(messagestr);
            });
            res.json({ "success": "successfully posted message" });
            console.log(5, `posted new message by ${res.locals.username} : ${req.body.message}`);
        });
    });
    return createPID
};
export default {
    setup
};
