const fs = require("fs");
const util = require('util');

function ensureExists(path, mask, cb) {
    if (typeof mask == 'function') { // Allow the `mask` parameter to be optional
        cb = mask;
        mask = 0o744;
    }
    fs.mkdir(path, mask, function(err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null); // Ignore the error if the folder already exists
            else cb(err); // Something else went wrong
        } else cb(null); // Successfully created folder
    });
}

const config = JSON.parse(fs.readFileSync("server_config.json"))

const time = Date.now()
const original_log = console.log
function log_info(level, ...info) {
  let text = info
  if(text == undefined || text.length == 0) {
    text = level
    level = 5
  }
  if(config["logs"] && config["logs"]["level"] && config["logs"]["level"] >= level) {
    let tolog = `[INFO] [${Date.now()}] : ${util.format(text)} \n`
    original_log(tolog) //still has some nicer colors
    ensureExists(__dirname + '/logs/', function(err) {
        if(err) {
          process.stderr.write(tolog) //just write it to stderr
        } else {
          fs.appendFile(__dirname+"/logs/"+time,tolog,function(err){
            if(err){
              process.stderr.write(err)
            }
          })
        }
    });
  }
}

console.log = log_info



const http = require('http');
const https = require('https');
const crypto = require("crypto");
const express = require("express");
const useragent = require('express-useragent');
const fileUpload = require('express-fileupload');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const signature = require('cookie-signature')
const mysql = require('mysql');
const csurf = require("csurf");
const WebSocket = require("ws").Server;
const Jimp = require('jimp');

const router = express.Router();
const app = express();

const csrfProtection = csurf({ cookie: true })

const HASHES_DB = config.cookies.server_hashes
const HASHES_COOKIE = config.cookies.client_hashes
const HASHES_DIFF = HASHES_DB - HASHES_COOKIE

const DID_I_FINALLY_ADD_HTTPS = true

const con = mysql.createPool({
  connectionLimit : config.mysql.connections,
  host: config.mysql.host,
  user: config.mysql.user,
  password: fs.readFileSync(config.mysql.password_file).toString()
});

const dir = __dirname + "/"

const cookiesecret = fs.readFileSync("cookiesecret.txt").toString()

function SHA256(str,salt,num) {
  if(!num && num!==0)num=1;
  if(!str)return;
  let ret = str;
  for (let i = 0; i < num; i++) {
    ret = crypto
      .createHash("sha256")
      .update(ret+salt)
      .digest("base64");
  }
  return ret;
}

function b64(data) {
  let buff = Buffer.from(data);
  return buff.toString('base64');
}

function RNG(seed) {
  if(!seed)seed = Date.now();
  this.seed = seed

  this.random = function(min,max) {
    if(!min)min=0
    if(!max){
      max=min
      min=0
    }
    this.seed += Math.log(Math.abs(Math.sin(this.seed))*100)
    return Math.abs(Math.sin(this.seed))*max + min
  }
  this.rand = function(min,max) {
    return Math.floor(this.random(min,max))
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const rand = new RNG()
const genstring_characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const genstring_charactersLength = genstring_characters.length;
function genstring(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += genstring_characters.charAt(rand.rand(genstring_charactersLength));
  }
  return result;
}

function clientErrorHandler(err, req, res, next) {
  if(err) {
    if (req.xhr) {
      res.status(200).send({ error: 'Something failed!' });
    } else {
      console.log(1,err);
    }
  } else {
    next()
  }
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function unsign(text,req,res) {
  let ip = req.socket.remoteAddress
  let unsigned = signature.unsign(text,cookiesecret+ip)
  if(!unsigned) {
    return false
  }
  return unsigned
}

function getunsigned(req,res) {
  let cookie = req.cookies.AUTH_COOKIE
  if(!cookie){
    res.status(400)
    res.json({"error":"you are not logged in! (no cookie)"})
    return
  }
  let unsigned = unsign(cookie,req,res)
  if(!unsigned){
    try {
      res.status(400)
      res.json({"error":"Bad auth cookie set"})
    } catch (ignored) {} //sometimes it errors, gotta debug soon
    return false
  }
  return decodeURIComponent(unsigned)
}

var API_CALLS = {}
var API_CALLS_ACCOUNT = {}
var USER_CALLS = {}
var SESSIONS = {}
var REVERSE_SESSIONS = {}
var INDIVIDUAL_CALLS = {}
function clear_api_calls() {
  API_CALLS = {}
}
function clear_account_api_calls() {
  API_CALLS_ACCOUNT = {}
}
function clear_user_calls() {
  USER_CALLS = {}
}
setInterval(clear_api_calls, config.rate_limits.api.reset_time)
setInterval(clear_account_api_calls, config.rate_limits.api.reset_time)
setInterval(clear_user_calls, config.rate_limits.user.reset_time)

function increaseIndividualCall(url,req) { //true = continue, false = ratelimit
  let conf = config["rate_limits"]["individual"][url]
  if(!conf) {
    console.log(5,"uri not in individual ratelimiter",url);
    return true;
  }
  if(!conf["enabled"])return true;
  let ip = req.socket.remoteAddress
  if(INDIVIDUAL_CALLS[ip]==undefined)INDIVIDUAL_CALLS[ip] = {}
  if(INDIVIDUAL_CALLS[ip][url]==undefined)INDIVIDUAL_CALLS[ip][url] = 0
  if(INDIVIDUAL_CALLS[ip][url] == 0) {
    setTimeout(function(){
      INDIVIDUAL_CALLS[ip][url] = 0
    },conf["reset_time"])
  }

  INDIVIDUAL_CALLS[ip][url]++;

  if(INDIVIDUAL_CALLS[ip][url] >= conf["max"]){
    console.log(5,"ratelimiting someone on", url, INDIVIDUAL_CALLS[ip][url],conf["max"]);
    return false;
  }

  return true;
}

function increaseAccountAPICall(req,res) {
  let cookie = req.cookies.AUTH_COOKIE
  if(!cookie){
    return true;
  }
  let unsigned = unsign(cookie,req,res)
  if(!unsigned) {

    return true;//if there's no account, why not just ignore it
  }
  unsigned = decodeURIComponent(unsigned)
  if(!unsigned)return false;
  let values = unsigned.split(" ")
  let username = values[0]
  if(API_CALLS_ACCOUNT[username]==undefined)API_CALLS_ACCOUNT[username]=0
  if(API_CALLS_ACCOUNT[username] >= config.rate_limits.api.max_per_account) {
    res.status(429)
    res.send("You are sending way too many api calls!")
    return false;
  }
  return true
}

function increaseAPICall(req,res,next) {
  let ip = req.socket.remoteAddress
  if(API_CALLS[ip]==undefined)API_CALLS[ip]=0
  if(API_CALLS[ip] >= config.rate_limits.api.max_without_session) {
    if(REVERSE_SESSIONS[ip] && req.cookies.session !== REVERSE_SESSIONS[ip]) { //expected a session, but didn't get one
      res.status(429)
      res.send("You are sending way too many api calls!")
      return
    }
    if(!req.cookies.session){
      let session
      do {
        session = genstring(300)
      } while (SESSIONS[session] != undefined);
      SESSIONS[session]=ip
      REVERSE_SESSIONS[ip]=session
      setTimeout(function(){
        SESSIONS[session]=undefined
        REVERSE_SESSIONS[ip]=undefined
      },50000)
      res.cookie('session',session, { maxAge: 100000, httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
      console.log(3,"sending session to " + ip);
    }

  }
  if(API_CALLS[ip] >= config.rate_limits.api.max_with_session) {
    res.status(429)
    res.send("You are sending too many api calls!")
    console.log(3,"rate limiting " + ip);
    return false
  }
  API_CALLS[ip]++;

  if(!increaseAccountAPICall(req,res))return false; //can't forget account-based ratelimits

  if(next)next()
  return true
}

function increaseUSERCall(req,res,next) {
  let ip = req.socket.remoteAddress
  if(USER_CALLS[ip]==undefined)USER_CALLS[ip]=0
  if(USER_CALLS[ip] >= config.rate_limits.user.max) {
    res.status(429)
    res.send("You are sending too many requests!")
    console.log(2,"rate limiting " + ip);
    return false
  }
  USER_CALLS[ip]++;
  if(next)next()
  return true
}

app.use(useragent.express());
app.use(fileUpload())
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
app.use(clientErrorHandler);
app.use(cookieParser(cookiesecret));

var blocked_headers = [
  'HTTP_VIA',
  'HTTP_X_FORWARDED_FOR',
  'HTTP_FORWARDED_FOR',
  'HTTP_X_FORWARDED',
  'HTTP_FORWARDED',
  'HTTP_CLIENT_IP',
  'HTTP_FORWARDED_FOR_IP',
  'VIA',
  'X_FORWARDED_FOR',
  'FORWARDED_FOR',
  'X_FORWARDED',
  'FORWARDED',
  'CLIENT_IP',
  'FORWARDED_FOR_IP',
  'HTTP_PROXY_CONNECTION'
]

if(!config.disallow_proxies_by_headers) {
  blocked_headers = []
}

if(DID_I_FINALLY_ADD_HTTPS) {

  //auto redirect to https
  app.use((req, res, next) => {
      if(req.secure){
        //already secure
        next()
      } else {
        //redirect to https
        res.redirect('https://' + req.headers.host + req.url)
      }
  })
}

app.use("/*",function(req,res,next){
  res.set("x-powered-by","ZeroTwoHub")
  for (let i = 0; i < blocked_headers.length; i++) {
    if(req.header(blocked_headers[i])!=undefined) {
      res.json({"error":"we don't allow proxies on our website."})
      return
    }
  }
  let fullurl = req.baseUrl + req.path
  if(fullurl != "/") {
    fullurl = fullurl.substring(0,fullurl.length-1)
  }
  if(!increaseIndividualCall(fullurl,req)){
    res.status(429)
    res.json({"error":"you are sending too many requests!"})
    return
  }

  next()
})

router.get("/",function(req,res) {
  if(!increaseUSERCall(req,res))return
  res.sendFile(dir+"views/index.html")
})

/*

START /API/*

*/

router.options("/api/post",async function(req,res,next) {
  res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
  res.set("Access-Control-Allow-Methods","POST")
  res.set("Access-Control-Allow-Headers","Content-Type")
  res.status(200).send("")
})

router.options("/api/getotheruser",async function(req,res,next) {
  res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
  res.set("Access-Control-Allow-Methods","GET")
  res.set("Access-Control-Allow-Headers","Content-Type")
  res.status(200).send("")
})

router.options("/api/getPost",async function(req,res,next) {
  res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
  res.set("Access-Control-Allow-Methods","GET")
  res.set("Access-Control-Allow-Headers","Content-Type")
  res.status(200).send("")
})

router.use("/api/*",async function(req,res,next) {
  res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
  if(config["allow_getotheruser_without_cookie"] && req.originalUrl.split("\?")[0] == "/api/getotheruser") {
    next()
    return
  }
  if(!increaseAPICall(req,res))return;
  let unsigned;
  if(req.body.user == undefined || req.body.pass == undefined) {
    unsigned = getunsigned(req,res)
    if(!unsigned)return
  } else {
    unsigned = `${req.body.user} ${SHA256(req.body.pass,req.body.user,HASHES_COOKIE)}`
    //basically we generate the unsigned cookie
    res.locals.isbot = true //only bots use user+pass
  }
  let sql = `select User_Name,User_Bio,User_Avatar from zerotwohub.users where User_Name=? and User_PW=?;`
  let values = unsigned.split(" ")
  values[1] = SHA256(values[1],values[0],HASHES_DIFF)
  res.locals.bio = ""
  res.locals.avatar = ""
  res.locals.publicKey = ""
  res.locals.privateKey = ""
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == values[0]) {
      res.locals.username = values[0];
      res.locals.bio = result[0].User_Bio || ""
      res.locals.avatar = result[0].User_Avatar || ""
      res.locals.publicKey = result[0].User_PublicKey || ""
      res.locals.privateKey = result[0].User_PrivateKey || ""
      next()
    } else {
      res.status(400)
      res.json({"error":"you cannot access the api without being logged in"})
    }
  });
})

router.get("/api/search", async function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  let type = req.query.type
  let arg = encodeURIComponent(req.query.selector)
  if(type=="user") {
    let sql = `select User_Name,User_Bio,User_Avatar from zerotwohub.users where User_Name like ? limit 10;`
    con.query(sql, [`%${arg}%`], function (err, result) {
      if (err) throw err;
      if(result[0] && result[0].User_Name) {
        res.json(result)
      } else {
        res.json({"error":"there is no such user!"})
      }
    });
  }else if (type=="post") {
    let sql = `select post_user_name,post_text,post_time,post_special_text,post_id from zerotwohub.posts where post_text like ? and (post_receiver_name is null or post_receiver_name = 'everyone') order by post_id desc limit 20;`
    con.query(sql, [`%${arg}%`], function (err, result) {
      if (err) throw err;
      if(result[0]) {
        res.json(result)
      } else {
        res.json({"error":"there is no such post!"})
      }
    });
  } else {
    res.json({"error":"invalid type passed along, expected `user` or `post`"})
  }
})

router.post("/api/setavatar",function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded. (req.files)');
  }
  let avatar = req.files.avatar;
  if(!avatar) {
    return res.status(400).send('No files were uploaded. (req.files.)');
  }
  const avatars = __dirname + '/avatars/'
  ensureExists(avatars, function(err) {
    if(err) {
      return res.status(500).json({"error":"there's been an internal server error."})
    }
    if(res.locals.avatar) {
      fs.unlinkSync(avatars + res.locals.avatar)
    }
    let filename = genstring(96) + ".png"
    while(fs.existsSync(avatars + "/" + filename) || filename == ".png") {
      console.log(5,"already have file: ",filename);
      original_log("already have file: ",filename)
      filename = genstring(96) + ".png"
    }
    avatar.mv(avatars+"temp_"+filename,function(err) {
      if(err) {
        return res.status(500).json({"error":"there's been an internal server error."})
      }
      Jimp.read(avatars+"temp_"+filename).then(function(image){
        image.resize(100, 100)
        image.write(avatars+filename)
        let sql = `update zerotwohub.users set User_Avatar=? where User_Name=?`
        con.query(sql, [filename,encodeURIComponent(res.locals.username)], function (err, result) {
          if (err) throw err;
          res.json({"success":"updated avatar"})
          fs.unlinkSync(avatars+"temp_"+filename)
        });
      })
    })
  })
})

router.get("/api/getuser",async function(req,res) {
  res.json({"username":res.locals.username,"bio":res.locals.bio,"avatar":res.locals.avatar})
})

router.get("/api/getalluserinformation",async function(req,res) {
  res.set("Access-Control-Allow-Origin","") //we don't want that here
  let unsigned = getunsigned(req,res)
  if(!unsigned)return
  unsigned = decodeURIComponent(unsigned)
  let sql = `select * from zerotwohub.users where User_Name=? and User_PW=?;`
  let values = unsigned.split(" ")
  values[1] = SHA256(values[1],values[0],HASHES_DIFF)
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == values[0]) {
      res.status(200)
      res.json(result[0])
    } else {
      res.status(400)
      res.json({"error":"you cannot access the api without being logged in"})
    }
  });
})

router.get("/api/getotheruser",async function(req,res) {
  res.set("Access-Control-Allow-Origin","*")
  let username = req.query.user

  let sql = `select User_Name,User_Bio,User_Avatar from zerotwohub.users where User_Name=?;`
  con.query(sql, [username], function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == username) {
      res.json({"username":username,"bio":result[0].User_Bio,"avatar":result[0].User_Avatar})
    } else {
      res.json({"error":"there is no such user!"})
    }
  });
})

router.post("/api/post", async function(req,res) {
  if(!req.body.message) {
    res.json({"error":"no message to post"})
    return
  }
  if((typeof req.body.message) != "string") {
    res.json({"error":"no message to post"})
    return
  }
  let reply_id
  if(!req.body.reply_id || req.body.reply_id < 0) {
    reply_id = 0
  } else {
    reply_id = req.body.reply_id
  }

  if(req.body.message.length > 1000) {
    res.json({"error":"message too long"})
    return
  }

  req.body.message = encodeURIComponent(req.body.message.trim())
  req.body.receiver = encodeURIComponent(req.body.receiver||"")
  if(req.body.receiver == "")req.body.receiver="everyone"

  if(!req.body.message) {
    res.json({"error":"no message to post"})
    return
  }

  let sql = `insert into zerotwohub.posts (post_user_name,post_text,post_time,post_receiver_name,post_from_bot,post_reply_id) values (?,?,?,?,?,?);`
  let values = [encodeURIComponent(res.locals.username),req.body.message,Date.now(),req.body.receiver,res.locals.isbot,reply_id]
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(req.body.receiver == "everyone") {
      wss.clients.forEach(function(ws) {
        ws.send(`new_post ${res.locals.username} ${req.body.message}`)
      });
    }
    res.json({"success":"successfully posted message"})
    console.log(5,`posted new message by ${res.locals.username} : ${req.body.message}`);
  });
})

router.get("/api/getPosts/*", async function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  res.redirect("/api/getPosts")
})

router.get("/api/getPosts", async function(req,res) {
  res.set("Access-Control-Allow-Origin","*")
  let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id from zerotwohub.posts where (post_receiver_name is null or post_receiver_name = 'everyone') group by post_id order by post_id desc limit 30;`
  con.query(sql, [], function (err, result) {
    if (err) throw err;
    res.json(result)
  });
})

router.get("/api/getPost", async function(req,res) {
  res.set("Access-Control-Allow-Origin","*")
  let arg = req.query.id
  let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id from zerotwohub.posts where post_id=?;`
  con.query(sql, [arg], function (err, result) {
    if (err) throw err;
    if(result[0]) {
      res.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
      res.json(result[0])
    } else {
      res.json({"error":"there is no such post!"})
    }
  });
})

router.get("/api/getPersonalPosts", async function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  let sql = `select post_user_name,post_text,post_time,post_special_text,post_id,post_from_bot,post_reply_id from zerotwohub.posts where (post_receiver_name = ?) order by post_id desc;`
  con.query(sql, [encodeURIComponent(res.locals.username)], function (err, result) {
    if (err) throw err;
    res.json(result)
  });
})

router.post("/api/setBio", async function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  let bio = req.body.Bio
  if(!bio){
    res.status(400)
    res.json({"error":"no bio set!"})
    return
  }
  bio = encodeURIComponent(bio)
  if(100 < bio.length) {
    res.status(400)
    res.json({"error":"the bio is too long!"})
    return
  }
  let sql = `update zerotwohub.users set User_Bio=? where User_Name=?`
  con.query(sql, [bio,encodeURIComponent(res.locals.username)], function (err, result) {
    if (err) throw err;
    res.json({"success":"updated bio"})
  });
})

router.post("/api/changePW", async function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  if((typeof req.body.newPW) != "string") {
    res.json({"error":"incorrect password"})
    return
  }
  if((typeof req.body.currentPW) != "string") {
    res.json({"error":"incorrect password"})
    return
  }
  if(req.body.newPW.length < 10) {
    res.status(400)
    res.json({"error":"password is too short"})
    return
  }

  let hashed_pw = SHA256(req.body.currentPW,res.locals.username,HASHES_DB)
  let hashed_new_pw = SHA256(req.body.newPW,res.locals.username,HASHES_DB)

  let sql = `select * from zerotwohub.users where User_Name=? and User_PW=?;`
  let values = [res.locals.username,hashed_pw]
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == res.locals.username) {
      let sql = `update zerotwohub.users set User_PW=? where User_Name=? and User_PW=?;`
      let values = [hashed_new_pw,res.locals.username,hashed_pw]
      con.query(sql, values, function (err, result) {
        if (err) throw err;
        let ip = req.socket.remoteAddress
        let setTo = res.locals.username + " " + SHA256(req.body.newPW,res.locals.username,HASHES_COOKIE)
        let cookiesigned = signature.sign(setTo, cookiesecret+ip);
        res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
        res.json({"success":"successfully changed password"})
      })
    } else {
      res.json({"error":"invalid password"})
    }
    sent_res = true
  });
  setTimeout(function(){if(!sent_res)res.json({"error":"timeout"})},3000);
})

router.post("/api/changeUsername", async function(req,res) {
  res.set("Access-Control-Allow-Origin","")
  if((typeof req.body.newUsername) != "string") {
    res.json({"error":"incorrect username"})
    return
  }
  if((typeof req.body.currentPW) != "string") {
    res.json({"error":"incorrect password..."})
    console.log(typeof req.body.currentPW);
    return
  }
  if(100 < req.body.newUsername.length) {
    res.status(400)
    res.json({"error":"username is too long"})
    return
  }

  if(req.body.newUsername == res.locals.username) {
    res.status(400)
    res.json({"error":"username can't be the current one"})
    return
  }

  let hashed_pw = SHA256(req.body.currentPW,res.locals.username,HASHES_DB)
  let hashed_new_pw = SHA256(req.body.currentPW,req.body.newUsername,HASHES_DB)

  let sql = `select * from zerotwohub.users where User_Name=?;`
  let values = [res.locals.username]
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_PW == hashed_pw) {
      let sql = `update zerotwohub.users set User_PW=?,User_Name=? where User_Name=? and User_PW=?;`
      let values = [hashed_new_pw,req.body.newUsername,res.locals.username,hashed_pw]
      con.query(sql, values, function (err, result) {
        if (err) throw err;
        let ip = req.socket.remoteAddress
        let setTo = req.body.newUsername + " " + SHA256(req.body.currentPW,req.body.newUsername,HASHES_COOKIE)
        let cookiesigned = signature.sign(setTo, cookiesecret+ip);
        res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
        //updated username in the users table, but not yet on posts
        let sql = `update zerotwohub.posts set post_user_name=? where post_user_name=?;`
        let values = [req.body.newUsername,res.locals.username,hashed_pw]
        con.query(sql, values, function (err, result) {
          res.json({"success":"successfully changed username"})
        });

      })
    } else {
      res.json({"error":"invalid password"})
      console.log(result);
    }
  });
})




/*

END /API/*

*/


router.get("/users/*", async function(req,res) {
  if(!increaseUSERCall(req,res))return
  res.sendFile(dir + "views/otheruser.html")
})

router.get("/css/*", (request, response) => {
  if(!increaseUSERCall(request,response))return
  if(fs.existsSync(__dirname + request.originalUrl)){
    response.sendFile(__dirname + request.originalUrl);
  } else {
    response.status(404).send("no file with that name found")
  }
  return;
});

router.get("/js/*", (request, response) => {
  if(!increaseUSERCall(request,response))return
  if(fs.existsSync(__dirname + request.originalUrl)){
    response.sendFile(__dirname + request.originalUrl);
  } else {
    response.status(404).send("no file with that name found")
  }
  return;
});

router.get("/images/*", (request, response) => {
  if(!increaseUSERCall(request,response))return
  if(fs.existsSync(__dirname + request.originalUrl)){
    response.sendFile(__dirname + request.originalUrl);
  } else {
    response.status(404).send("no file with that name found")
  }
  return;
});

router.get("/avatars/*", (request, response, next) => {
  if(!increaseUSERCall(request,response))return
  response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
  let originalUrl = request.originalUrl.split("?").shift()
  if(fs.existsSync(dir + originalUrl + ".png")) {
    return response.sendFile(dir + originalUrl + ".png");
  }
  if(fs.existsSync(dir + originalUrl)) {
    return response.sendFile(dir + originalUrl);
  }
  response.status(404).send("No avatar with that name found")
})

router.get("/logout",async function(req,res) {
  res.cookie("AUTH_COOKIE","", { maxAge: 0, httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS })
  res.redirect("/")
})

router.get("/*", (request, response, next) => {
  if(!increaseUSERCall(request,response))return
  let originalUrl = request.originalUrl.split("?").shift()
  if(fs.existsSync(dir + "views/"+originalUrl+".html")) {
    return response.sendFile(dir + "views/"+originalUrl+".html");
  }
  if(fs.existsSync(dir + "views"+originalUrl)) {
    return response.sendFile(dir + "views"+originalUrl);
  }
  if(fs.existsSync(dir + "views"+originalUrl+".html")) {
    return response.sendFile(dir + "views"+originalUrl+".html");
  }
  if(fs.existsSync(dir + "views"+originalUrl)) {
    return response.sendFile(dir + "views"+originalUrl);
  }
  response.status(404).send("No file with that name found")
})

router.post("/register",async function(req,res) {
  for (let i = 0; i < 10; i++) { //don't want people spam registering
    if(!increaseAPICall(req,res))return;
  }
  res.status(200)
  let username = req.body.user.toString()
  username = username.replace(/\s/gi,"")
  let password = req.body.pass.toString()
  if(!username) {
    res.status(400)
    res.redirect("/register?success=false&reason=username")
    return
  }
  if(username=="") {
    res.status(400)
    res.redirect("/register?success=false&reason=username")
    return
  }
  if(password.length < 10) {
    res.status(400)
    res.send("password is too short")
    return
  }
  if(username.length > 25) {
    res.status(400)
    res.send("username is too long")
    return
  }
  if(username.search("@")!=-1) {
    res.status(400)
    res.send("username can't contain @-characters")
    return
  }
  if(!password) {
    res.status(400)
    res.redirect("/register?success=false&reason=password")
    return
  }
  let userexistssql = `SELECT User_Name from zerotwohub.users where User_Name = ?`
  con.query(userexistssql,[encodeURIComponent(username)],function(error,result) {
    if(result && result[0] && result[0].User_Name) {
      res.status(400)
      res.redirect("/register?success=false&reason=already_exists")
      return
    }
    let less_hashed_pw = SHA256(password,username,HASHES_DIFF)
    let hashed_pw = SHA256(less_hashed_pw,username,HASHES_COOKIE)
    let ip = req.socket.remoteAddress
    let setTo = username + " " + SHA256(password,username,HASHES_COOKIE)
    let cookiesigned = signature.sign(setTo, cookiesecret+ip);
    ip = SHA256(ip,setTo,HASHES_DB)
    const {
      publicKey,
      privateKey,
    } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: password
      }
    });
    let values = [encodeURIComponent(username),hashed_pw, Date.now(), ip, ip, publicKey.toString(), privateKey.toString()]
    let sql = `INSERT INTO zerotwohub.users (User_Name, User_PW, User_CreationStamp, User_CreationIP, User_LastIP, User_PublicKey, User_PrivateKey) VALUES (?, ?, ?, ?, ?, ?, ?);`
    con.query(sql, values, function (err, result) {
      if (err) throw err;
      res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
      res.cookie("priv_key",privateKey.toString(), { maxAge: Math.pow(10,10), httpOnly: false, secure: DID_I_FINALLY_ADD_HTTPS }) //only meant to be used as temporary storage, moved to localStorage on user page
      res.redirect("/user?success=true")
    });
  })
})

router.post("/login",async function(req,res) {
  if(!increaseAPICall(req,res))return;
  if(!increaseAPICall(req,res))return;
  //login is counted twice (think of bruteforces man)
  if((typeof req.body.user) != "string") {
    res.json({"error":"incorrect username"})
    return
  }
  if((typeof req.body.pass) != "string") {
    res.json({"error":"incorrect password"})
    return
  }
  if(!req.body.user){
    res.status(400)
    res.send("no username given")
    return
  }
  if(!req.body.pass){
    res.status(400)
    res.send("no password given")
    return
  }
  let username = req.body.user.toString()
  username = username.replace(" ","")
  let password = req.body.pass.toString()
  if(!username) {
    res.status(400)
    res.send("no username given")
    return
  }
  if(username.length > 25) {
    res.status(400)
    res.send("username is too long")
    return
  }
  if(password.length < 10) {
    res.status(400)
    res.send("password is too short")
    return
  }
  if(!password) {
    res.status(400)
    res.send("no password given")
    return
  }
  let less_hashed_pw = SHA256(password,username,HASHES_DIFF)
  let hashed_pw = SHA256(less_hashed_pw,username,HASHES_COOKIE)

  let userexistssql = `SELECT * from zerotwohub.users where User_Name = ? and User_PW = ?;`
  con.query(userexistssql,[encodeURIComponent(username),hashed_pw],function(error,result) {
    if(result && result[0]) {
      let ip = req.socket.remoteAddress
      let setTo = username + " " + SHA256(password,username,HASHES_COOKIE)
      let cookiesigned = signature.sign(setTo, cookiesecret+ip);
      res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });

      ip = SHA256(ip,setTo,HASHES_DB)
      if(result[0].User_PublicKey == null) {
        const {
          publicKey,
          privateKey,
        } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: password
          }
        });
        res.cookie("priv_key",privateKey.toString(), { maxAge: Math.pow(10,10), httpOnly: false, secure: DID_I_FINALLY_ADD_HTTPS }) //only meant to be used as temporary storage, moved to localStorage on user page
        let sql = `update zerotwohub.users set User_PublicKey=?,User_PrivateKey=? where User_Name = ?;`
        con.query(sql,[publicKey.toString(),privateKey.toString(),encodeURIComponent(username)],function(error,result) {
          if(error)throw error
        })
      } else {
        res.cookie("priv_key",result[0].User_PrivateKey, { maxAge: Math.pow(10,10), httpOnly: false, secure: DID_I_FINALLY_ADD_HTTPS }) //only meant to be used as temporary storage, moved to localStorage on user page
      }
      if(result[0].User_LastIP != ip) {
        let sql = `update zerotwohub.users set User_LastIP = ? where User_Name = ?;`
        con.query(sql,[ip,encodeURIComponent(username)],function(error,result) {
          if(error)throw error
        })
      }
      res.redirect("/user?success=true")
    } else {
      res.redirect("/login?success=false?reason=noUser")
    }
  });
})

app.use(router)

const httpServer = http.createServer(app);
httpServer.listen(config["ports"]["http"]);

const privateKey = fs.readFileSync(config["ssl"]["privateKey"]).toString()
const certificate = fs.readFileSync(config["ssl"]["certificate"]).toString()

const credentials = {key: privateKey, cert: certificate};

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(config["ports"]["https"]);

const wss = new WebSocket({
  server: httpsServer,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024 * 16
  }
});
