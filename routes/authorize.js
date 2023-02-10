import {randomBytes} from "crypto"
import {SHA256} from "../extra_modules/SHA.js";
import {unsign} from "../extra_modules/unsign.js";

export const setup = function (router, con, server) {
    const temp_code_to_token = {}
    router.post("/authorize",async (req,res) => {
        if (!unsign(req.cookies.AUTH_COOKIE, req, res)){
            return
        }

        let data = await server.hcaptcha.verify(req.body["h-captcha-response"])

        if(data.success) {

            let appid = req.body.application_id
            if(typeof appid === "string") {
                appid = Number(appid)
            }
            if(typeof appid === "number") {

                const token = randomBytes(150).toString("base64")
                
                let tokencode;
                while(tokencode===undefined || temp_code_to_token[tokencode]!==undefined) {
                    tokencode = randomBytes(15).toString("base64")
                }
                temp_code_to_token[tokencode]={
                    "userid":res.locals.userid,
                    "appid":appid,
                    "token":token
                }
                setTimeout(() => {
                    let data = temp_code_to_token[tokencode]
                    if(data !== undefined && data.token===token && data.appid === appid && data.userid === res.locals.userid) {
                        temp_code_to_token[tokencode]=undefined
                    }
                }, 300000); //wait for 5 minutes

                const sql = "SELECT application_auth_url FROM ipost.application where application_id=?"

                con.query(sql,[appid],(err,result) => {
                    if(err || result.length !== 1) {
                        console.err(err)
                        res.redirect(`/authorize?id=${req.body.application_id}`)
                        return
                    }
                    res.redirect(`${result[0].application_auth_url}?code=${tokencode}`)
                })

                
                
                return
            }
        }

        res.redirect(`/authorize?id=${req.body.application_id}`)
    })

    router.post("/redeemauthcode", (req,res) => {

        if(temp_code_to_token[req.body.authcode]===undefined) {
            res.status(400)
            res.json({"status":400,"message":"invalid code given"})
            return
        }

        if(typeof req.body.auth === "string") {
            try{
                req.body.auth = JSON.parse(req.body.auth)
            } catch(err) {
                console.log("error parsing",err)
            }
        } 
        if(
            typeof req.body.auth            !== "object" || 
            typeof req.body.auth.secret     !== "string" || 
            typeof req.body.auth.appid      !== "number" || 
            req.body.auth.secret.length     !== 200      || 
            Buffer.from(req.body.auth.secret,"base64").length !== 150 ||
            req.body.auth.appid !== temp_code_to_token[req.body.authcode].appid
        ) {
            //console.log(1,req.body.auth,temp_code_to_token[req.body.authcode].appid)
            res.status(420).send("invalid authentication object")
            return;
        }

        const appid = req.body.auth.appid

        const checksecret = SHA256(req.body.auth.secret,appid,10000)

        const checksql = "SELECT application_id from ipost.application where application_secret=? and application_id=?"
        const checkvalues = [checksecret,appid]

        con.query(checksql,checkvalues,(error,result_object) => {

            if(error || result_object[0]===undefined || result_object[0].application_id!==appid) {
                res.status(400)
                res.json({"status":400,"message":"invalid code given"})
                return
            }

            let data = temp_code_to_token[req.body.authcode]
            temp_code_to_token[req.body.authcode] = undefined
            
            
            const sql = "INSERT INTO `ipost`.`auth_tokens`(`auth_token`,`auth_token_u_id`,`auth_token_isfrom_application_id`) VALUES(?,?,?);"
            
            const values = [SHA256(data.token,appid,10000),data.userid,data.appid] //token,id,appid
            con.query(sql,values,(err,result) => {
                if(err) {
                    res.json({"status":500,"message":"error redeeming code"})
                    console.err(err)
                } else {
                    res.json({"status":200,"message":"successfully redeemed code","token":data.token})
                }
            })
        })

        
    
    })
}