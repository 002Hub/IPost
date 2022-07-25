function allowAllTraffic(router,str,type) {
    router.options(str,async function(req,res,next) {
        res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
        res.set("Access-Control-Allow-Methods",type || "GET")
        res.set("Access-Control-Allow-Headers","Content-Type")
        res.status(200).send("")
    })
}

module.exports = {
    "setup": function(router,con,server) {
        // router.options("/api/pid",async function(req,res,next) {
        //     res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
        //     res.set("Access-Control-Allow-Methods","GET")
        //     res.set("Access-Control-Allow-Headers","Content-Type")
        //     res.status(200).send("")
        // })
        
        // router.options("/api/post",async function(req,res,next) {
        //     res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
        //     res.set("Access-Control-Allow-Methods","POST")
        //     res.set("Access-Control-Allow-Headers","Content-Type")
        //     res.status(200).send("")
        // })
        
        // router.options("/api/getotheruser",async function(req,res,next) {
        //     res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
        //     res.set("Access-Control-Allow-Methods","GET")
        //     res.set("Access-Control-Allow-Headers","Content-Type")
        //     res.status(200).send("")
        // })
        
        // router.options("/api/getPost",async function(req,res,next) {
        //     res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
        //     res.set("Access-Control-Allow-Methods","GET")
        //     res.set("Access-Control-Allow-Headers","Content-Type")
        //     res.status(200).send("")
        // })
        // 
        // router.options("/api/getPostsLowerThan",async function(req,res,next) {
        //     res.set("Access-Control-Allow-Origin","*") //we'll allow it for now
        //     res.set("Access-Control-Allow-Methods","GET")
        //     res.set("Access-Control-Allow-Headers","Content-Type")
        //     res.status(200).send("")
        // })

        allowAllTraffic(router,"/api/pid")
        allowAllTraffic(router,"/api/post","POST")
        allowAllTraffic(router,"/api/getotheruser")
        allowAllTraffic(router,"/api/getPost")
        allowAllTraffic(router,"/api/getPostsLowerThan")
        allowAllTraffic(router,"/api/settings")
        allowAllTraffic(router,"/api/settings","POST")
        

    }
}