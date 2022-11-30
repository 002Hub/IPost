import ejs from "ejs"
import LRU from "lru-cache"
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

    function load_var(fina) {
        if(load_var_cache.get(fina))return load_var_cache.get(fina)
        if(!existsSync(fina)) {
            console.log(1,"tried loading non-existent file",fina)
            load_var_cache.set(fina,"")
            return "";
        }
        let out = readFileSync(fina)
        if(fina.endsWith(".js")) {
            out = min_js(out.toString()).code
        }
        else if(fina.endsWith(".css")) {
            const {
                styles,
            } = new Clean({}).minify(out.toString());
            out = styles
        }

        load_var_cache.set(fina,out)
        
        return out
    }

    function get_channels(){
        return new Promise(function(resolve, reject) {
            let sql = `select post_receiver_name from ipost.posts where post_is_private = '0' group by post_receiver_name;`;
            con.query(sql, [], function (err, result) {
                if (err)reject(err)
    
                let out = []
    
                for(let channel of result){
                    if(channel.post_receiver_name == "")continue;
                    out[out.length] = channel.post_receiver_name
                }
    
                resolve(out)
            });
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
        getDMPID: server.global_page_variables.getDMPID
    }

    

    function handleUserFiles(request, response, overrideurl) {
        if (!increaseUSERCall(request, response))return;
        if(typeof overrideurl != "string")overrideurl = undefined;
    
        let originalUrl = overrideurl || request.originalUrl.split("?").shift();
    
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
    
        if(path != "" && originalUrl != "/favicon.ico" && originalUrl != "/api/documentation/") {
            global_page_variables.user = { "username": response.locals.username, "bio": response.locals.bio, "avatar": response.locals.avatar }
            global_page_variables.query = request.query
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
    
        if(originalUrl == "/favicon.ico") {
            response.set('Cache-Control', 'public, max-age=2592000');
            response.sendFile(dir + "/views/favicon.ico")
            return
        }
    
        if(originalUrl == "/api/documentation/") {
            readFile(path,function(_err,res){
                response.send(res.toString())
            })
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
    router.get("/", function (req, res) {
        handleUserFiles(req,res,"/index")
    });
    
    router.get("/*", handleUserFiles);
}