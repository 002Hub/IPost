const http = require('http');
const https = require('https');
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const router = express.Router();
const redirrouter = express.Router();
const app = express();
const useragent = require('express-useragent');
const fileUpload = require('express-fileupload');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const signature = require('cookie-signature')
const mysql = require('mysql');
const csurf = require("csurf");
const helmet = require("helmet");

const csrfProtection = csurf({ cookie: true })

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

function SHA256(str) {
  if(!str)return;
  return crypto
    .createHash("sha256")
    .update(str)
    .digest("base64");
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
  }
  return unsigned
}

var API_CALLS = {}
var USER_CALLS = {}
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

app.use(helmet());
app.use(useragent.express());
app.use(fileUpload())
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
app.use(clientErrorHandler);
app.use(cookieParser(cookiesecret));

router.get("/",function(req,res) {
  if(!increaseUSERCall(req,res))return
  res.sendFile(dir+"views/index.html")
})

/*

START /API/*

*/

router.use("/api/*",async function(req,res,next) {
  increaseAPICall(req,res,next)
})

router.get("/api/getuser",async function(req,res) {
  //already counted due to the /api/* handler
  let cookie = req.cookies.AUTH_COOKIE
  if(!cookie){
    res.status(400)
    res.json({"error":"you are not logged in!"})
    return
  }
  let unsigned = unsign(cookie,req,res)

  let values = unsigned.split(" ")
  let hashed_pw = values[1]
  let username = values[0]

  for (let i = 0; i < 9999; i++) {
    hashed_pw = SHA256(hashed_pw)
  }

  values[1] = hashed_pw

  let sql = `select * from zerotwohub.users where User_Name=? and User_PW=?;`
  let sent_res = false
  con.query(sql, values, function (err, result) {
    if (err) throw err;
    if(result[0] && result[0].User_Name && result[0].User_Name == username) {
      res.json({"username":username})
    } else {
      res.json({"error":"you are not logged in!"})
    }
    sent_res = true
  });
  setTimeout(function(){if(!sent_res)res.json({"error":"timeout"})},3000);
})

router.post("/api/post", async function(req,res) {
  //already counted due to the /api/* handler
  res.send("not implemented yet.")
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
  username = username.replace(" ","")
  let password = req.body.pass.toString()
  if(!username) {
    res.status(400)
    res.redirect("/register?success=false&reason=username")
    return
  }
  if(username.length > 100) {
    res.status(400)
    res.send("username is too long")
    return
  }
  if(password.length > 100000) {
    res.status(400)
    res.send("password is too long")
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
    let hashed_pw = password;
    for (let i = 0; i < 10000; i++) {
      hashed_pw = SHA256(hashed_pw)
    }
    let values = [username,hashed_pw]
    let sql = `INSERT INTO zerotwohub.users (User_Name, User_PW) VALUES (?, ?);`
    con.query(sql, values, function (err, result) {
      if (err) throw err;
      let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
      let setTo = username + " " + SHA256(password)
      let cookiesigned = signature.sign(setTo, cookiesecret+ip);
      res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: true });
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
  if(password.length > 100000) {
    res.status(400)
    res.send("password is too long")
    return
  }
  if(!password) {
    res.status(400)
    res.send("no password given")
    return
  }

  let hashed_pw = password;
  for (let i = 0; i < 10000; i++) {
    hashed_pw = SHA256(hashed_pw)
  }

  let userexistssql = `SELECT * from zerotwohub.users where User_Name = ? and User_PW = ?`
  con.query(userexistssql,[username,hashed_pw],function(error,result) {
    if(result && result[0] && result[0].User_Name && result[0].User_Name==username && result[0].User_PW && result[0].User_PW == hashed_pw) {
      let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
      let setTo = username + " " + SHA256(password)
      let cookiesigned = signature.sign(setTo, cookiesecret+ip);
      res.cookie('AUTH_COOKIE',cookiesigned, { maxAge: Math.pow(10,10), httpOnly: true, secure: true });
      res.redirect("/user?success=true")
    } else {
      res.redirect("/login?success=false")
    }
  });
})


app.use(router)

const httpServer = http.createServer(app);
httpServer.listen(25566);
