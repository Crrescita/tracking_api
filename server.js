require("dotenv").config();
const express = require("express");
require("./config/until");
require("./middleware/validation");

const app = require("./app");
//const port = process.env.PORT || 3000
const port = 3000;
// Create HTTP server and listen on provided port, or default to 3000
// http.createServer(app).listen(port);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
