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

    function validateMessage(message) {
        if (!message) {
            throw {
                statusCode: 410,
                message: "no message to post"
            }
        }
        if ((typeof message) !== "string") {
            throw {
                statusCode: 411,
                message: "no message to post"
            }
        }
        if (message.length > 1000) {
            throw {
                statusCode: 416,
                message: "message too long"
            }
        }
        message = encodeURIComponent(message.trim());
        if (message.length > 3000) {
            throw {
                statusCode: 417,
                message: "message too long"
            }
        }
        if (!message) {
            throw {
                statusCode: 418,
                message: "no message to post"
            }
        } //backup check
        return message
    }

    function validatePID(pid) {
        if (!pid || typeof pid !== "string") {
            throw {
                statusCode: 412,
                message: "no pid given"
            }
        }
        if (pid.length !== 10 || PIDS[pid]!==true) {
            throw {
                statusCode: 413,
                message: "invalid pid given"
            }
        }
        PIDS[pid] = "already_used";
    }

    function validateReplyID(rid) {
        let reply_id;
        if (!rid || rid < 0) {
            reply_id = 0
        }
        if(typeof rid === "string" && rid !== "") {
            reply_id = parseInt(rid,10)
            if(isNaN(reply_id)) {
                throw {
                    statusCode: 414,
                    message: "no valid reply id given"
                }
            }
        }
        if (typeof reply_id !== "number") {
            throw {
                statusCode: 415,
                message: "no valid reply id given"
            } //backup case
        }
        return reply_id
    }

    function validateReceiver(rec) {
        let receiver = encodeURIComponent(rec || "");
        if (receiver == "")
            receiver = "everyone";
        return receiver
    }

    router.post("/api/post",  async (req, res) => {
        try {
          let message   = validateMessage(req.body.message);
          validatePID(req.body.pid);
          let reply_id  = validateReplyID(req.body.reply_id);
          let receiver  = validateReceiver(req.body.receiver);

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
                      writeFile(`${__dirname}/user_uploads/previews/${file_name}.webp`,await sharp(file.data).resize(100,100,{fit: "inside"}).webp({mixed:true,effort:6}).toBuffer(),(error2)=>{
                        if(error2)console.error(error2)
                      })
                    })
                  } else {
                    file.mv(`${__dirname}/user_uploads/${file_name}.${extension}`,(err2)=>{
                       if(err2)console.error(err2)
                    })
                  }
                })
              }
            }
          }

          let sql = `
          START TRANSACTION;
          insert into ipost.posts (post_user_name,post_text,post_time,post_receiver_name,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4) values (?,?,?,?,?,?,?,?,?,?,?);
          SELECT LAST_INSERT_ID() as ID;
          COMMIT;
          `;
          let values = [encodeURIComponent(res.locals.username), message, Date.now(), receiver, res.locals.isbot, reply_id,...file_names];
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
                files: file_names,
                post_id: result[0].ID
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
        } catch (error) {
            if(error.statusCode) {
                res.status(error.statusCode)
                res.json({ "error": error.message, "status": error.statusCode });
            } else {
                console.error("some error: ", error)
                res.status(500)
                res.json({"error":"internal server error", "status": 500})
            }
        }
    });
    return createPID
};
export default {
    setup
};
