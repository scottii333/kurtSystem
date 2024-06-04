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

  socket.on('newProduct', async (productData) => {
    console.log('New product added:', productData);

    const base64Image = productData.image.split(';base64,').pop();

    const buffer = Buffer.from(base64Image, 'base64');


    try {

      await createProdTableIfNotExists();

      await pool.request()
        .input('ProductName', sql.NVarChar(100), productData.productName)
        .input('Category', sql.NVarChar(50), productData.category)
        .input('Size', sql.NVarChar(10), productData.size)
        .input('Price', sql.Decimal(18, 2), productData.price)
        .input('Stock', sql.Int, productData.stock)
        .input('DateAdded', sql.DateTime, new Date())
        .input('Image', sql.VarBinary(sql.MAX), buffer)
        .query(`
          INSERT INTO Shoes_Products (ProductName, Category, Size, Price, Stock, DateAdded, Image) 
          VALUES (@ProductName, @Category, @Size, @Price, @Stock, @DateAdded, @Image)
        `);



      console.log('Product added successfully');
      io.emit('productAdded', productData);
    } catch (err) {
      console.error('Error saving product data to database:', err);

    }




  });

  socket.on('confirmOrder', (orderData) => {
    console.log('New product added:', orderData);


    io.emit('orderReceived', orderData);
  });



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

async function createProdTableIfNotExists() {
  const tableName = 'Shoes_Products';
  try {
    if (!(await tableExists(tableName))) {
      await pool.request().query(`
          CREATE TABLE ${tableName} (
            ID INT IDENTITY(1,1) PRIMARY KEY,
            ProductName NVARCHAR(100) NOT NULL,
            Category NVARCHAR(50) NOT NULL,
            Size NVARCHAR(10) NOT NULL,
            Price DECIMAL(18, 2) NOT NULL,
            Stock INT NOT NULL,
            DateAdded DATETIME NOT NULL,
            Image VARBINARY(MAX) -- Store image as VARBINARY
          )
        `);
      console.log('Table created:', tableName);
    }
  } catch (err) {
    console.error('Error creating table:', err);
    throw err;
  }
}

app.get('/shoes_products', async (req, res) => {
  try {
    const result = await pool.request().query('SELECT * FROM Shoes_Products');
    const products = result.recordset.map(product => ({
      ...product,
      Image: `data:image/jpeg;base64,${Buffer.from(product.Image, 'binary').toString('base64')}`
    }));
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching shoes products:', error);
    res.status(500).json({ error: 'Failed to fetch shoes products' });
  }
});




server.listen(port, () => {
  console.log(`Server is listening on port ${port}.`);
});