const http = require('http');
const https = require('https');
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const useragent = require('express-useragent');
const fileUpload = require('express-fileupload');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const signature = require('cookie-signature')
const mysql = require('mysql');
const csurf = require("csurf");
const WebSocket = require("ws").Server;

const router = express.Router();
const app = express();

const csrfProtection = csurf({ cookie: true })

const HASHES_DB = 10000
const HASHES_COOKIE = 10
const HASHES_DIFF = HASHES_DB - HASHES_COOKIE

const DID_I_FINALLY_ADD_HTTPS = true

const con = mysql.createConnection({
  host: "localhost",
  user: fs.readFileSync("mysql_user.txt").toString(),
  password: fs.readFileSync("mysql_key.txt").toString()
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
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



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function genstring(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function clientErrorHandler(err, req, res, next) {
  if(err) {
    if (req.xhr) {
      res.status(200).send({ error: 'Something failed!' });
    } else {
      console.log(err);
    }
  } else {
    next()
  }
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function unsign(text,req,res) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  let unsigned = signature.unsign(text,cookiesecret+ip)
  if(!unsigned) {
    res.status(400)
    res.json({"error":"Bad auth cookie set"})
    return false
  }
  return unsigned
}

var API_CALLS = {}
var USER_CALLS = {}
var SESSIONS = {}
var REVERSE_SESSIONS = {}
function clear_api_calls() {
  API_CALLS = {}
}
function clear_user_calls() {
  USER_CALLS = {}
}
setInterval(clear_api_calls, 10000)
setInterval(clear_user_calls, 30000)

function increaseAPICall(req,res,next) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  if(API_CALLS[ip]==undefined)API_CALLS[ip]=0
  if(API_CALLS[ip] >= 20) {
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
      console.log("sending session to " + ip);
    }

  }
  if(API_CALLS[ip] >= 60) {
    res.status(429)
    res.send("You are sending too many api calls!")
    console.log("rate limiting " + ip);
    return false
  }
  API_CALLS[ip]++;
  if(next)next()
  return true
}

function increaseUSERCall(req,res,next) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  if(USER_CALLS[ip]==undefined)USER_CALLS[ip]=0
  if(USER_CALLS[ip] >= 60) {
    res.status(429)
    res.send("You are sending too many requests!")
    console.log("rate limiting " + ip);
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


// app.use("/*",function(req,res,next){
//   if(req.get("User-Agent").search("python") != -1) {
//     res.status(400)
//     res.send("illegal user agent")
//     return
//   }
//   next()
// })
//maybe someone wants it?

app.use("/*",function(req,res,next){
  res.set("x-powered-by","ZeroTwoHub")
  next()
})

router.get("/",function(req,res) {
  if(!increaseUSERCall(req,res))return
  res.sendFile(dir+"views/index.html")
})

/*

START /API/*

*/

router.use("/api/*",async function(req,res,next) {
  if(!increaseAPICall(req,res))return;
  let cookie = req.cookies.AUTH_COOKIE
  if(!cookie){
    res.status(400)
    res.json({"error":"you are not logged in! (no cookie)"})
    return
  }
  let unsigned = unsign(cookie,req,res)
  if(!unsigned)return
  let sql = `select * from zerotwohub.users where User_Name=? and User_PW=?;`
  let values = unsigned.split(" ")
  values[1] = SHA256(values[1],values[0],HASHES_DIFF)
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == values[0]) {
      res.locals.username = values[0];
      next()
    } else {
      res.json({"error":"you cannot access the api without being logged in"})
    }
  });
})

router.get("/api/getuser",async function(req,res) {
  //already counted due to the /api/* handler
  let cookie = req.cookies.AUTH_COOKIE
  if(!cookie){
    res.status(400)
    res.json({"error":"you are not logged in! (no cookie)"})
    return
  }
  let unsigned = unsign(cookie,req,res)

  let values = unsigned.split(" ")
  let username = values[0]

  values[1] = SHA256(values[1],username,HASHES_DIFF)

  let sql = `select * from zerotwohub.users where User_Name=? and User_PW=?;`
  let sent_res = false
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == username) {
      res.json({"username":username})
    } else {
      res.json({"error":"you are not logged in! (invalid cookie)"})
    }
    sent_res = true
  });
  setTimeout(function(){if(!sent_res)res.json({"error":"timeout"})},3000);
})

router.post("/api/post", async function(req,res) {
  if(!req.body.message) {
    res.send("error")
    return
  }
  let sql = `insert into zerotwohub.posts (post_user_name,post_text,post_time) values (?,?,?);`
  let values = [res.locals.username,req.body.message,Date.now()]
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    console.log(result);
    wss.clients.forEach(function(ws) {
      ws.send("new_post " + res.locals.username)
    });
    res.send("success")
  });
})

// router.get("/api/getPosts/*", async function(req,res) {
//
//   let sql = `select post_user_name,post_text,post_time,post_special_text from zerotwohub.posts where post_id >= ? and post_id <= ? order by post_id desc;`
//   let id = parseInt(req.originalUrl.replace("/api/getPosts/"))
//   if(isNaN(id))id=0
//   let values = [id,id+100]
//   con.query(sql, values, function (err, result) {
//     if (err) throw err;
//     res.json(result)
//   });
// })

router.get("/api/getPosts/*", async function(req,res) {

  let sql = `select post_user_name,post_text,post_time,post_special_text from zerotwohub.posts order by post_id desc;`
  con.query(sql, [], function (err, result) {
    if (err) throw err;
    res.json(result)
  });
})

router.post("/api/changePW", async function(req,res) {
  //let values = [req.body.currentPW,req.body.newPW]
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
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
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


/*

END /API/*

*/

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
  response.status(200).send("No file with that name found")
})



router.post("/register",async function(req,res) {
  if(!increaseAPICall(req,res))return;
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
  if(username.length > 100) {
    res.status(400)
    res.send("username is too long")
    return
  }
  if(!password) {
    res.status(400)
    res.redirect("/register?success=false&reason=password")
    return
  }
  let userexistssql = `SELECT User_Name from zerotwohub.users where User_Name = ?`
  con.query(userexistssql,[username],function(error,result) {
    if(result && result[0] && result[0].User_Name) {
      res.status(400)
      res.redirect("/register?success=false&reason=already_exists")
      return
    }
    let hashed_pw = SHA256(password,username,HASHES_DB)
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    let values = [username,hashed_pw, Date.now(), ip, ip]
    let sql = `INSERT INTO zerotwohub.users (User_Name, User_PW, User_CreationStamp, User_CreationIP, User_LastIP) VALUES (?, ?, ?, ? ,?);`
    con.query(sql, values, function (err, result) {
      if (err) throw err;
      let setTo = username + " " + SHA256(password,username,HASHES_COOKIE)
      let cookiesigned = signature.sign(setTo, cookiesecret+ip);
      res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
      res.redirect("/user?success=true")
    });
  })
})

router.post("/login",async function(req,res) {
  if(!increaseAPICall(req,res))return;
  if(!increaseAPICall(req,res))return;
  //login is counted twice (think of bruteforces man)
  let username = req.body.user.toString()
  username = username.replace(" ","")
  let password = req.body.pass.toString()
  if(!username) {
    res.status(400)
    res.send("no username given")
    return
  }
  if(username.length > 100) {
    res.status(400)
    res.send("username is too long")
    return
  }
  if(!password) {
    res.status(400)
    res.send("no password given")
    return
  }

  let hashed_pw = SHA256(password,username,HASHES_DB)

  let userexistssql = `SELECT User_Name,User_PW,Last_IP from zerotwohub.users where User_Name = ? and User_PW = ?`
  con.query(userexistssql,[username,hashed_pw],function(error,result) {
    if(result && result[0] && result[0].User_Name && result[0].User_Name==username && result[0].User_PW && result[0].User_PW == hashed_pw) {
      let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
      let setTo = username + " " + SHA256(password,username,HASHES_COOKIE)
      let cookiesigned = signature.sign(setTo, cookiesecret+ip);
      res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: DID_I_FINALLY_ADD_HTTPS });
      res.redirect("/user?success=true")
      if(result[0].Last_IP != ip) {
        let sql = `update zerotwohub.users set Last_IP=? where User_Name=?;`
        con.query(sql,[ip,username],function(error,result) {
          if(error)throw error
        })
      }
    } else {
      res.redirect("/login?success=false")
    }
  });
})


app.use(router)

const httpServer = http.createServer(app);
httpServer.listen(25567);

const privateKey = fs.readFileSync("C:/Certbot/live/ws.zerotwohub.tk/privkey.pem").toString()
const certificate = fs.readFileSync("C:/Certbot/live/ws.zerotwohub.tk/cert.pem").toString()

const credentials = {key: privateKey, cert: certificate};

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(25566);

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

// wss.on("connection", function connection(ws) {
//   // ws.isAlive = true;
//   ws.on("close", function close() {
//
//   })
//   ws.on("message", function incoming(message) {
//     //message = message.toString()
//   })
// })
