function allowAllTraffic(router, str, type) {
    router.options(str,  function (req, res, next) {
        res.set("Access-Control-Allow-Origin", "*"); //we'll allow it for now
        res.set("Access-Control-Allow-Methods", type || "GET");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(200).send("");
    });
}
function setup(router, con, server) {
    allowAllTraffic(router, "/api/pid");
    allowAllTraffic(router, "/api/post", "POST");
    allowAllTraffic(router, "/api/getotheruser");
    allowAllTraffic(router, "/api/getPost");
    allowAllTraffic(router, "/api/getPostsLowerThan");
    allowAllTraffic(router, "/api/settings");
    allowAllTraffic(router, "/api/settings", "POST");
}
export { setup };
