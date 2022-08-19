import {web_version} from "unsafe_encrypt"

module.exports = {
    "setup": function(router,con,server) {
        router.get("/api/getPersonalPosts", async function(req,res) {
            res.set("Access-Control-Allow-Origin","")
        
            let otherperson = encodeURIComponent(req.query.otherperson||"")
        
            if(typeof otherperson != "string" || otherperson.length > 100 || otherperson=="") {
                res.status(400).json({"error": "invalid otherperson given"})
                return
            }
        
            const columns = [
                "dms_user_name","dms_text","dms_time","dms_special_text","dms_id","dms_from_bot","dms_reply_id"
            ]
            //dms_user_name = sender
            //dms_receiver = receiver
            //if (sender == current and receiver == other) or (receiver == current and sender == other)
            let sql = `select ${columns.join(",")} from ipost.dms where ((dms_receiver = ? and dms_user_name = ?) or (dms_receiver = ? and dms_user_name = ?)) order by dms_id desc;`
            con.query(sql, [otherperson,encodeURIComponent(res.locals.username),encodeURIComponent(res.locals.username),otherperson], function (err, result) {
                if (err) throw err;
                res.json(result)
            });
        })

        router.get("/api/dms/conversations", async function(req,res) {
            res.set("Access-Control-Allow-Origin","*")
        
            const columns = [
                "dms_user_name","dms_receiver"
            ]

            let uriencusername = encodeURIComponent(res.locals.username)

            let sql = `select ${columns.join(",")} from ipost.dms where ((dms_receiver = ?) or (dms_user_name = ?)) group by dms_receiver,dms_user_name;`
            con.query(sql, [uriencusername,uriencusername], function (err, result) {
                if (err) throw err;
                res.json(result)
            });
        })

        router.get("/api/dms/encrypt.js", async function(req,res) {
            res.set("Access-Control-Allow-Origin","*")
            res.send(web_version())
        })

        //
        router.get("/api/dms/getDM", async function(req,res) {
            res.set("Access-Control-Allow-Origin","*")
            let arg = req.query.id
            let uriencusername = encodeURIComponent(res.locals.username)
            let sql = `select dms_user_name,dms_text,dms_time,dms_special_text,dms_id,dms_from_bot,dms_reply_id,dms_receiver from ipost.dms where dms_id=? and (dms_user_name=? or dms_receiver=?);`
            con.query(sql, [arg,uriencusername,uriencusername], function (err, result) {
              if (err) throw err;
              if(result[0]) {
                res.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
                res.json(result[0])
              } else {
                res.json({"error":"there is no such dm!"})
              }
            });
          })
    }
}