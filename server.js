const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sql = require("mssql/msnodesqlv8");
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");

var dbConfig = {
  driver: "msnodesqlv8",
  connectionString: "DSN=sql1DataSource",
  server: "LAPTOP-VI6OKHB4\\MSSQLSERVER01",
  database: "recsale_DB",
  options: {
    trustedConnection: true,
  },
};

let pool; 

async function connectToDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("Connected to SQL Server");
  } catch (err) {
    console.error("Error connecting to SQL Server:", err);
    throw err;
  }
}
connectToDB().catch((err) => {
  console.error("Database connection failed:", err);
  process.exit(1); 
});

io.on('connection', (socket) => {
    console.log('A client connected');


    socket.on('disconnect', () => {
      console.log('A client disconnected');
    });
  });

  async function tableExists(tableName) {
    try {
      const result = await pool.request()
        .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}'`);
      return result.recordset.length > 0;
    } catch (err) {
      console.error('Error checking table existence:', err);
      throw err;
    }
  }
  
  async function createTableIfNotExists() {
    const tableName = 'Shoe_Revolution';
    try {
      if (!(await tableExists(tableName))) {
        await pool.request().query(`
          CREATE TABLE ${tableName} (
            ID INT IDENTITY(1,1) PRIMARY KEY,
            Username NVARCHAR(50) NOT NULL UNIQUE,
            Password NVARCHAR(100) NOT NULL
          )
        `);
        console.log('Table created:', tableName);
      }
    } catch (err) {
      console.error('Error creating table:', err);
      throw err;
    }
  }
  
  async function usernameExists(username) {
    try {
      const result = await pool.request()
        .input('Username', sql.NVarChar(50), username)
        .query('SELECT * FROM Shoe_Revolution WHERE Username = @Username');
      return result.recordset.length > 0;
    } catch (err) {
      console.error('Error checking username existence:', err);
      throw err;
    }
  }
  
  app.post('/createAccount', async (req, res) => {
    const { Username, Password } = req.body;
  
    try {
      await createTableIfNotExists();
  
      if (await usernameExists(Username)) {
        return res.status(400).json({ error: 'Username already exists. Please choose another username.' });
      }
  
      await pool.request()
        .input('Username', sql.NVarChar(50), Username)
        .input('Password', sql.NVarChar(100), Password)
        .query('INSERT INTO Shoe_Revolution (Username, Password) VALUES (@Username, @Password)');
  
      res.status(200).json({ message: 'Account created successfully' });
    } catch (err) {
      console.error('Error creating account:', err);
      res.status(500).json({ error: 'Error creating account', details: err.message });
    }
  });
  
  app.post('/logIn', async (req, res) => {
    const { Username, Password } = req.body;
  
    try {
      const result = await pool.request()
        .input('Username', sql.NVarChar(50), Username)
        .input('Password', sql.NVarChar(100), Password)
        .query('SELECT * FROM Shoe_Revolution WHERE Username = @Username AND Password = @Password');
  
      if (result.recordset.length > 0) {
        res.render('Customer.ejs');
      } else {
        res.status(401).json({ error: 'Wrong username or password' });
      }
    } catch (err) {
      console.error('Error logging in:', err);
      res.status(500).json({ error: 'Error logging in', details: err.message });
    }
  });

  

  



app.get("/", (req, res) => {
    res.render("HomePage.ejs");
  });
  
  app.get("/Customer-Dashboard", (req, res) => {
    res.render("Customer.ejs");
  });
   
  app.get("/Admin-Dashboard", (req, res) => {
    res.render("Admin.ejs");
  });
  

server.listen(port, () => {
    console.log(`Server is listening on port ${port}.`);
  });