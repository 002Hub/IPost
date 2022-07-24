module.exports = {
    "setup": function(router,con,server) {
        router.options("/api/pid",async function(req,res,next) {
            res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
            res.set("Access-Control-Allow-Methods","GET")
            res.set("Access-Control-Allow-Headers","Content-Type")
            res.status(200).send("")
        })
        
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
        
        router.options("/api/getPostsLowerThan",async function(req,res,next) {
            res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
            res.set("Access-Control-Allow-Methods","GET")
            res.set("Access-Control-Allow-Headers","Content-Type")
            res.status(200).send("")
        })
    }
}