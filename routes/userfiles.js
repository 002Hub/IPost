import ejs from "ejs"
import { LRUCache as LRU} from "lru-cache"
import {minify as min_js} from "uglify-js"
import Clean from 'clean-css';
import Minifier from 'html-minifier-terser';
import { web_version } from "unsafe_encrypt";
import {existsSync, readFileSync, readFile} from "fs"

export const setup = function (router, con, server) {

    const increaseUSERCall = server.increaseUSERCall
    const dir = server.dirname + "/"

    ejs.cache = new LRU({max:20})

    const load_var_cache = new LRU({
        max: 20,
        maxSize: 10000,
        sizeCalculation: (value) => {
            return value.length
        },
        ttl: 1000 * 60,
        allowStale: true,
        updateAgeOnGet: true,
        updateAgeOnHas: true
    })

    function load_var(filePath) {
        if (load_var_cache.has(filePath)) {
          return load_var_cache.get(filePath);
        }

        if (!existsSync(filePath)) {
          console.log(1,'Tried loading non-existent file', filePath);
          load_var_cache.set(filePath, '');
          return '';
        }

        let output = readFileSync(filePath);

        if (filePath.endsWith('.js')) {
          output = min_js(output.toString()).code;
        } else if (filePath.endsWith('.css')) {
          const { styles } = new Clean({}).minify(output.toString());
          output = styles;
        }
        load_var_cache.set(filePath, output);
        return output;
    }

    function get_channels(){
        return new Promise(function(resolve, reject) {
            let sql = `select post_receiver_name from ipost.posts where post_is_private = '0' group by post_receiver_name;`;
            con.query(sql, [], function (err, result) {
                if (err)reject(err)
    
                let out = []
    
                for(let channel of result){
                    if(channel.post_receiver_name === "")continue;
                    out[out.length] = channel.post_receiver_name
                }
    
                resolve(out)
            });
        })
    }

    const appId_Cache = new LRU({max:20,ttl: 1000 * 60 * 15}) //cache for 15 minutes
    function getAppWithId(appid) {
        appid = Number(appid)
        return new Promise((res,rej) => {
            if(isNaN(appid)) {
                res({})
                return
            }
            if(appId_Cache.has(appid)) {
                res(appId_Cache.get(appid) || {})
                return
            }
            con.query("SELECT * FROM ipost.application WHERE application_id=?",[appid],(err,result) => {
                if(err) {
                    console.error(err)
                    rej({})
                    return
                }
                appId_Cache.set(appid,result[0])
                res(result[0] || {})
            })
        })
    }

    let global_page_variables = {
        globalcss: load_var("./css/global.css"),
        httppostjs: load_var("./js/httppost.js"),
        navbar: load_var("./extra_modules/navbar.html"),
        markdownjs: load_var("./js/markdown.js"),
        htmlescapejs: load_var("./js/htmlescape.js"),
        warnmessagejs: load_var("./js/warn_message.js"),
        loadfile: load_var,
        getChannels: get_channels,
        encryptJS: min_js(web_version().toString()).code,
        cookiebanner: `<script id="cookieyes" type="text/javascript" src="https://cdn-cookieyes.com/client_data/3cf33f6b631f3587bf83813b/script.js" async></script>`,
        newrelic: load_var("./extra_modules/newrelic_monitor.html"),
        getPID: server.global_page_variables.getPID,
        getDMPID: server.global_page_variables.getDMPID,
        unauthorized_description: "Chat now by creating an account on IPost",
        hcaptcha_sitekey: server.hcaptcha.sitekey,
        getAppWithId: getAppWithId
    }

    

    async function handleUserFiles(request, response, overrideurl) {
        if (!increaseUSERCall(request, response))return;
        if(typeof overrideurl !== "string")overrideurl = undefined;
    
        let originalUrl = overrideurl
            || request.params.file
            || request.originalUrl.split("?").shift(); //backup in case anything goes wrong
    
        let path = ""
        if (existsSync(dir + "views" + originalUrl)) {
            path = dir + "views" + originalUrl
            //send .txt files as plaintext to help browsers interpret it correctly
            if(originalUrl.endsWith(".txt")) {
                response.set('Content-Type', 'text/plain');
                readFile(path,(err,data)=> {
                    if(err)return
                    response.send(data)
                })
                return
            }
        }
        if (existsSync(dir + "views/" + originalUrl + "index.html")) {
            path = dir + "views/" + originalUrl + "index.html"
        }
        if (existsSync(dir + "views/" + originalUrl + ".html")) {
            path = dir + "views/" + originalUrl + ".html"
        }
        if (existsSync(dir + "views" + originalUrl + ".html")) {
            path = dir + "views" + originalUrl + ".html"
        }
    
        if(path !== "" && originalUrl !== "favicon.ico" && originalUrl !== "api_documentation" && originalUrl !== "api_documentation.html") {
            console.log(originalUrl)
            global_page_variables.user = { "username": response.locals.username, "bio": response.locals.bio, "avatar": response.locals.avatar }
            global_page_variables.query = request.query
            if(originalUrl === "authorize") {
                global_page_variables.application = await getAppWithId(request.query.id)
            }
            ejs.renderFile(path,global_page_variables,{async: true},async function(err,str){
                str = await str
                err = await err
                if(err) {
                    console.log(1,err)
                    response.status(500)
                    response.send("error")
                    //TODO: make error page
                    return
                }
                try {
                    str = await Minifier.minify(str,{
                        removeComments: true,
                        removeCommentsFromCDATA: true,
                        removeCDATASectionsFromCDATA: true,
                        collapseWhitespace: true,
                        collapseBooleanAttributes: true,
                        removeAttributeQuotes: true,
                        removeRedundantAttributes: true,
                        useShortDoctype: true,
                        removeEmptyAttributes: true
                    })
                } catch(ignored){
                    console.log(2,"error minifying",originalUrl);
                }
    
                try {
                    response.send(str)
                } catch(err) {
                    console.error(err)
                }
            })
            return;
        }

        if(originalUrl === "api_documentation" || originalUrl === "api_documentation.html") {
            response.set('Cache-Control', 'public, max-age=2592000');
            response.set('Content-Type', 'text/html')
            response.send(load_var("./views/api_documentation.html"))
            return
        }

        if(originalUrl === "favicon.ico") {
            response.set('Cache-Control', 'public, max-age=2592000');
            response.sendFile(dir + "/views/favicon.ico")
            return
        }

        console.log(5,"no file found",originalUrl);
        try {
            response.status(404).send("No file with that name found");
        } catch(err) {
            console.error(err)
        }
    }

    /**
    * Handle default URI as /index (interpreted redirect: "localhost" -> "localhost/index" )
    */
    router.get("/", (req, res) => {
        req.params.file = "index"
        handleUserFiles(req,res,"/index")
    });

    router.get("/:file", handleUserFiles);
    router.get("/:folder/:file", (req, res) => {
        req.params.file = req.params.folder+"/"+req.params.file
        handleUserFiles(req,res)
    });
}