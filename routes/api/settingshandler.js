const allowed_settings = {
    "ACCR": ["boolean"]
};
export const setup = function (router, con, server) {
    router.get("/api/settings", function (req, res) {
        res.json(res.locals.settings);
    });
    router.post("/api/settings", function (req, res) {
        if (!req.body.setting) {
            res.status(410)
            res.json({ "error": "no setting to change" });
            return;
        }
        if ((typeof req.body.setting) != "string") {
            res.status(411)
            res.json({ "error": "no setting to change" });
            return;
        }
        let types = allowed_settings[req.body.setting];
        let allowed = false;
        let got = typeof req.body.value;
        for (let index = 0; index < types.length; index++) {
            if (types[index] == got) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            console.log(5, "incorrect type given, received, expected", typeof req.body.value, allowed_settings[req.body.setting]);
            res.status(412)
            res.json({ "error": "no new setting value given" });
            return;
        }
        let setting_to_change = req.body.setting;
        let setting_new_value = req.body.value;
        res.locals.settings[setting_to_change] = setting_new_value;
        console.log(5, "changing settings", setting_to_change, setting_new_value, res.locals.settings);
        let sql = "update ipost.users set User_Settings=? where User_Name=?";
        let values = [JSON.stringify(res.locals.settings), res.locals.username];
        con.query(sql, values, function (err, result) {
            if (err) {
                res.status(500)
                res.json({ "status": "error", "code": err });
                return;
            }
            res.json({ "status": "success" });
        });
    });
};
export default {
    setup
};
