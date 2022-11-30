export const setup = function (router, con, server) {
    router.get("/api/getPosts/*",  function (_req, res) {
        res.set("Access-Control-Allow-Origin", "");
        res.redirect("/api/getPosts");
    });
    router.get("/api/getPosts",  function (req, res) {
        res.set("Access-Control-Allow-Origin", "*");
        if (req.query.channel != undefined) {
            let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,User_Avatar,file_0,file_1,file_2,file_3,file_4 from ipost.posts inner join ipost.users on (User_Name = post_user_name) where post_receiver_name = ? group by post_id order by post_id desc limit 30;`;
            con.query(sql, [encodeURIComponent(req.query.channel)], function (err, result) {
                if (err)
                    throw err;
                res.json(result);
            });
        }
        else { //fallback
            let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4 from ipost.posts where (post_receiver_name is null or post_receiver_name = 'everyone') group by post_id order by post_id desc limit 30;`;
            con.query(sql, [], function (err, result) {
                if (err)
                    throw err;
                res.json(result);
            });
        }
    });
    router.get("/api/getPostsLowerThan",  function (req, res) {
        res.set("Access-Control-Allow-Origin", "*");
        if (req.query.channel != undefined) {
            let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4 from ipost.posts where ((post_receiver_name = ?) and (post_id < ?)) group by post_id order by post_id desc limit 30;`;
            con.query(sql, [encodeURIComponent(req.query.channel), req.query.id], function (err, result) {
                if (err)
                    throw err;
                res.json(result);
            });
        }
        else { //fallback
            let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,file_0,file_1,file_2,file_3,file_4 from ipost.posts where ((post_receiver_name is null or post_receiver_name = 'everyone') and (post_id < ?)) group by post_id order by post_id desc limit 30;`;
            con.query(sql, [req.query.id], function (err, result) {
                if (err)
                    throw err;
                res.json(result);
            });
        }
    });
    router.get("/api/getPost",  function (req, res) {
        res.set("Access-Control-Allow-Origin", "*");
        let arg = req.query.id;
        let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id,post_receiver_name,User_Avatar,file_0,file_1,file_2,file_3,file_4 from ipost.posts inner join ipost.users on (User_Name = post_user_name) where post_id=?;`;
        con.query(sql, [arg], function (err, result) {
            if (err)
                throw err;
            if (result[0]) {
                res.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
                res.json(result[0]);
            }
            else {
                res.json({ "error": "there is no such post!" });
            }
        });
    });
}