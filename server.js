const express = require("express");
const { exec } = require("child_process");
const path = require("path");

const app = express();
const PORT = 3000;

// serve static files (index.html etc.)
app.use(express.static(path.join(__dirname, "public")));

// route to run batch file
app.get("/getmac", (req, res) => {
  exec("getmac.bat", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).send("Error getting MAC address");
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return res.status(500).send("Error getting MAC address");
    }
    res.json({ mac: stdout.trim() });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${5000}`);
});
