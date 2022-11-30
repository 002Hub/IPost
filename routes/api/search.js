export const setup = function (router, con, server) {
    router.get("/api/search",  function (req, res) {
        res.set("Access-Control-Allow-Origin", "");
        let type = req.query.type;
        let arg = encodeURIComponent(req.query.selector);
        if (type == "user") {
            let sql = `select User_Name,User_Bio,User_Avatar from ipost.users where User_Name like ? limit 10;`;
            con.query(sql, [`%${arg}%`], function (err, result) {
                if (err)
                    throw err;
                if (result[0] && result[0].User_Name) {
                    result["message"] = "search has been deprecated as of 11/30/2022"
                    res.json(result);
                }
                else {
                    res.json({ "error": "there is no such user!" });
                }
            });
        }
        else if (type == "post") {
            let sql = `select post_user_name,post_text,post_time,post_special_text,post_id from ipost.posts where post_text like ? and (post_receiver_name is null or post_receiver_name = 'everyone') order by post_id desc limit 20;`;
            con.query(sql, [`%${arg}%`], function (err, result) {
                if (err)
                    throw err;
                if (result[0]) {
                    result["message"] = "search has been deprecated as of 11/30/2022"
                    res.json(result);
                }
                else {
                    res.json({ "error": "there is no such post!", "message": "search has been deprecated as of 11/30/2022"});
                }
            });
        }
        else {
            res.json({ "error": "invalid type passed along, expected `user` or `post`", "message": "search has been deprecated as of 11/30/2022"});
        }
    });
}