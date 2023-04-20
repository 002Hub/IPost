const fs = require('fs');
const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'IPost API',
    description: 'the official IPost.rocks API documentation',
  },
  host: 'ipost.rocks',
  schemes: ['https'],
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./server.js'];

function pushdirectory(currentpath) {
  fs.readdirSync(currentpath, {
    withFileTypes: true
  }).forEach(dirent => {
    if (dirent.isFile()) {
      endpointsFiles.push(currentpath + dirent.name);
    } else {
      pushdirectory(currentpath + dirent.name + "/");
    }
  });
}

pushdirectory("./routes/");

console.log(endpointsFiles)

/* NOTE: if you use the express Router, you must pass in the 
   'endpointsFiles' only the root file where the route starts,
   such as index.js, app.js, routes.js, ... */

swaggerAutogen(outputFile, endpointsFiles, doc);