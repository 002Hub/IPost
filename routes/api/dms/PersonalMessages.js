const xor = require("../../../extra_modules/xor.js")

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

            let sql = `select ${columns.join(",")} from ipost.dms where (dms_channel = ?) order by dms_id desc;`
            con.query(sql, [xor(encodeURIComponent(res.locals.username),otherperson)], function (err, result) {
                if (err) throw err;
                res.json(result)
            });
        })
    }
}