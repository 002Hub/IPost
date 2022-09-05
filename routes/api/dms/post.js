import xor from "../../../extra_modules/xor.js";
export const setup = function (router, con, server) {
    const PIDS = {}; //[pid]: true/"already_used"

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


    router.get("/api/dms/pid",  function (req, res) {
        res.set("Access-Control-Allow-Origin", "*");
        res.json({ "pid": createPID() });
    });
    router.post("/api/dms/post",  function (req, res) {
        if (!req.body.message) {
            res.json({ "error": "no message to post" });
            return;
        }
        if ((typeof req.body.message) != "string") {
            res.json({ "error": "no message to post" });
            return;
        }
        if ((typeof req.body.pid) != "string") {
            res.json({ "error": "no pid given" });
            return;
        }
        if (req.body.pid.length != 10 || PIDS[req.body.pid] !== true) {
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
        if ((typeof reply_id) != "number") {
            res.json({ "error": "no valid reply id given" });
            return;
        }
        if (req.body.message.length > 1000) {
            res.json({ "error": "message too long" });
            return;
        }
        req.body.message = encodeURIComponent(req.body.message.trim());
        if (req.body.message.length > 3000) {
            res.json({ "error": "message too long" }); //check again after URI encoding it
            return;
        }
        req.body.receiver = encodeURIComponent(req.body.receiver || "");
        if (req.body.receiver == "" || req.body.receiver == encodeURIComponent(res.locals.username) || req.body.receiver.length > 100) {
            res.status(400).json({ "error": "invalid receiver given" });
            return;
        }
        let otherperson = req.body.receiver;
        if (!req.body.message) {
            res.json({ "error": "no message to post" });
            return;
        }
        let sql = `insert into ipost.dms (dms_user_name,dms_text,dms_time,dms_receiver,dms_from_bot,dms_reply_id) values (?,?,?,?,?,?);`;
        let values = [encodeURIComponent(res.locals.username), req.body.message, Date.now(), otherperson, res.locals.isbot, reply_id];
        con.query(sql, values, function (err, result) {
            if (err)
                throw err;
            // let post_obj = {
            //     post_user_name: encodeURIComponent(res.locals.username),
            //     post_text: req.body.message,
            //     post_time: Date.now(),
            //     post_special_text: "",
            //     post_receiver_name: req.body.receiver,
            //     post_from_bot: res.locals.isbot,
            //     post_reply_id: reply_id
            // }
            // let message = {
            //     message: "new_post",
            //     data: post_obj
            // }
            // let messagestr = JSON.stringify(message)
            // server.wss.clients.forEach(function(ws) {
            //     if(ws.channel == decodeURIComponent(req.body.receiver)) {
            //         ws.send(messagestr)
            //     }
            // });
            res.json({ "success": "successfully posted dm" });
            console.log(5, `posted new dm by ${res.locals.username} to ${otherperson} : ${xor(encodeURIComponent(res.locals.username), otherperson)}`);
        });
    });
    return createPID
};
export default {
    setup
};
