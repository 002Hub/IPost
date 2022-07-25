const fs = require('fs');
const SHA = require("../../extra_modules/SHA.js")
const unsign = require("../../extra_modules/unsign.js")
const config = JSON.parse(fs.readFileSync("server_config.json"))
const HASHES_DB = config.cookies.server_hashes
const HASHES_COOKIE = config.cookies.client_hashes
const HASHES_DIFF = HASHES_DB - HASHES_COOKIE

module.exports = {
  "setup": function(router,con,server) {
    router.use("/api/*",async function(req,res,next) {
      res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
      if(config["allow_getotheruser_without_cookie"] && req.originalUrl.split("\?")[0] == "/api/getotheruser") {
        next()
        return
      }
      if(!server.increaseAPICall(req,res))return;
      let unsigned;
      if(req.body.user == undefined || req.body.pass == undefined) {
        unsigned = unsign.getunsigned(req,res)
        if(!unsigned)return
      } else {
        unsigned = `${req.body.user} ${SHA.SHA256(req.body.pass,req.body.user,HASHES_COOKIE)}`
        //basically we generate the unsigned cookie
        res.locals.isbot = true //only bots use user+pass
      }
      let sql = `select User_Name,User_Bio,User_Avatar,User_Settings from ipost.users where User_Name=? and User_PW=?;`
      let values = unsigned.split(" ")
      values[1] = SHA.SHA256(values[1],values[0],HASHES_DIFF)
      res.locals.bio = ""
      res.locals.avatar = ""
      res.locals.publicKey = ""
      res.locals.privateKey = ""
      res.locals.settings = {}
      con.query(sql, values, function (err, result) {
        if (err) throw err;
        if(result[0] && result[0].User_Name && result[0].User_Name == values[0]) {
          res.locals.username = values[0];
          res.locals.bio = result[0].User_Bio || ""
          res.locals.avatar = result[0].User_Avatar || ""
          res.locals.publicKey = result[0].User_PublicKey || ""
          res.locals.privateKey = result[0].User_PrivateKey || ""
          res.locals.settings = JSON.parse(result[0].User_Settings)
          if(res.locals.settings == "null")res.locals.settings = {}
          if(res.locals.settings == null)res.locals.settings = {}

          next()
        } else {
          res.status(400)
          res.json({"error":"you cannot access the api without being logged in"})
        }
      });
    })
  }
}
