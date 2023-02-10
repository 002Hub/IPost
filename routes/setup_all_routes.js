import { setup as optionssetup } from "./api/options.js";
import { setup as allsetup } from "./api/all.js";
import { setup as settingshandlersetup } from "./api/settingshandler.js";
import { setup as postsetup } from "./api/post.js";
import { setup as dmsPersonalMessagessetup } from "./api/dms/PersonalMessages.js";
import { setup as dmspostsetup } from "./api/dms/post.js";
import { setup as fileiconsetup } from "./api/getFileIcon.js";
import { setup as searchsetup } from "./api/search.js";
import { setup as getpostssetup } from "./api/getPosts.js";
import { setup as userroutessetup } from "./api/userRoutes.js";
import { setup as servefilessetup} from "./serve_static_files.js"
import { setup as userfilessetup} from "./userfiles.js"
import { setup as userauthsetup} from "./user_auth.js"
import { setup as applicationsetup} from "./authorize.js"

export const setup = function (router, con, server) {
    const setuproute = handler => handler(router,con,server)

    setuproute(optionssetup)
    setuproute(allsetup)
    setuproute(settingshandlersetup)
    const get_pid = setuproute(postsetup);
    setuproute(dmsPersonalMessagessetup)
    const get_dmpid = setuproute(dmspostsetup);
    setuproute(fileiconsetup)
    setuproute(searchsetup)
    setuproute(getpostssetup)
    setuproute(userroutessetup)
    setuproute(servefilessetup)
    let global_page_variables = {
        getPID: get_pid,
        getDMPID: get_dmpid,
    }
    server.global_page_variables = global_page_variables
    setuproute(userfilessetup) //needs getPID and getDMPID
    
    setuproute(userauthsetup) //login & register

    setuproute(applicationsetup)
}