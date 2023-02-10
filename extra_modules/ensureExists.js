import {mkdir} from "fs"

/**
 * makes sure that a given folder exists, if it doesn't it creates one for you
 * @param  {string}         path                the path of the folder
 * @param  {permission}     mask                permission mask for the new folder to have
 * @param  {Function}       cb                  callback, gives null if the folder exists, otherwise gives the error
 * @return {undefined}                          see: callback
 */
 function ensureExists(path, mask, cb) {
    if (typeof mask === 'function') { // Allow the `mask` parameter to be optional
        cb = mask;
        mask = 0o744;
    }
    mkdir(path, mask, function (err) {
        if (err) {
            if (err.code === 'EEXIST')
                cb(null); // Ignore the error if the folder already exists
            else
                cb(err); // Something else went wrong
        }
        else
            cb(null); // Successfully created folder
    });
}

export {
    ensureExists
} ;