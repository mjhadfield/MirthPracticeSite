//Constant imports

const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');

// SQL Server configuration
const config = {
  user: 'admin', 
  password: 'admin',
  server: 'localhost', 
  port: 55656, 
  database: 'results', 
  options: {
  encrypt: false,
   enableArithAbort: true
  }
};

// Connect to SQL Server
sql.connect(config, (err) => {
  if (err) {
    console.error('Error connecting to the SQL Server database:', err);
    return;
  }
  console.log('Connected to the SQL Server database.');
});

const app = express();

// Establish a connection pool
let poolPromise;

async function initDbPool() {
  try {
    poolPromise = await sql.connect(config);
    console.log('Connected to the SQL Server database.');
  } catch (err) {
    console.error('Error connecting to the SQL Server database:', err);
  }
}

initDbPool();

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (like your index.html)
app.use(express.static(__dirname));

//** Content for the order page **/
//Get the profiles
app.get('/get-profiles', async (req, res) => {
  try {
      const result = await new sql.Request().query('SELECT * FROM profiles');
      res.json(result.recordset);
  } catch (err) {
      console.error('Error fetching profiles:', err);
      res.status(500).send('Error fetching profiles');
  }
});

// Handle form submission
app.post('/submit-form', async (req, res) => {
  const { patientId, profileRequested, urgent, comments } = req.body;
  const urgentValue = (urgent === 'yes') ? 1 : 0;

  try {
    const pool = await sql.connect(config);
    
    // Check if patientId exists in patientdemogs
    const patientResult = await pool.request()
      .input('patientId', sql.VarChar, patientId)
      .query('SELECT COUNT(*) AS count FROM dbo.patientdemogs WHERE PatientID = @patientId');

    if (patientResult.recordset[0].count === 0) {
      return res.status(400).send('Invalid patient ID.');
    }

    // Get the tests for the requested profile
    const profileResult = await pool.request()
      .input('profileRequested', sql.VarChar, profileRequested)
      .query('SELECT tests FROM dbo.profiles WHERE id = @profileRequested');

    if (profileResult.recordset.length === 0) {
      return res.status(400).send('Invalid profile requested.');
    }

    const tests = profileResult.recordset[0].tests.split(',');

    // Start a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Insert a row for each test
      for (const test of tests) {
        await new sql.Request(transaction)
          .input('patientId', sql.VarChar, patientId)
          .input('profileRequested', sql.VarChar, profileRequested)
          .input('test', sql.VarChar, test.trim())
          .input('urgent', sql.Bit, urgentValue)
          .input('comments', sql.VarChar, comments)
          .query(`
            INSERT INTO orders (patientId, requestedProfile, requestedTest, urgent, comments, processed) 
            VALUES (@patientId, @profileRequested, @test, @urgent, @comments, 0)
          `);
      }

      // Commit the transaction
      await transaction.commit();
      res.send('Form submitted successfully!');
    } catch (err) {
      // If there's an error, roll back the transaction
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send('Error inserting data');
  } finally {
    sql.close();
  }
});


//** Endpoint for getting the patient list **/
app.get('/get-patients', async (req, res) => {
  try {
      const result = await new sql.Request().query('SELECT patientID, lastName, firstName, middleName, title, dateOfBirth, gender, address1, address2, addressCity, addressState, addressPostCode, addressCountry, phoneNumber FROM dbo.patientdemogs');
      res.json(result.recordset);
  } catch (err) {
      console.error('Error fetching patients:', err);
      res.status(500).send('Error fetching patients');
  }
});

//** Endpoint for submitting the new patient form **/
//Creating a prefix for the locations
const locationMap = {
  'Superhero': 'HERO',
  'Test': 'DOOTEST',
  'Real Life': 'LIFE',
};

// Handle form submission for patient form
app.post('/submit-patient', async (req, res) => {
  const { lastName, firstName, middleName, title, dateOfBirth, gender, address1, address2, addressCity, addressState, addressPostCode, addressCountry, phoneNumber, location } = req.body;

  // Map input values to the required format
  const genderMap = {
    'Male': 'M',
    'Female': 'F',
    'Other': 'U'
  };
  const mappedGender = genderMap[gender] || 'U'; // Default to 'U'

  // Define location mapping
  const locationMap = {
    'Superhero': 'HERO',
    'Test': 'DOOTEST',
    'Real Life': 'LIFE',
    // Add more locations here as needed
  };

  // Get the hospital number prefix based on the selected location
  const hospitalNumberPrefix = locationMap[location];
  if (!hospitalNumberPrefix) {
    return res.status(400).send('Invalid location selected.');
  }

  try {
    const request = new sql.Request();
    
// Get the next available hospital number
const result = await request.query(
  `SELECT TOP 1 patientID FROM dbo.patientdemogs 
   WHERE patientID LIKE '${hospitalNumberPrefix}%' 
   ORDER BY patientID DESC`
);

let newHospitalNumber;
if (result.recordset.length > 0) {
  const lastHospitalNumber = result.recordset[0].patientID; // Update this line to refer to patientID
  const numberPart = parseInt(lastHospitalNumber.replace(hospitalNumberPrefix, ''), 10) + 1;
  newHospitalNumber = `${hospitalNumberPrefix}${String(numberPart).padStart(3, '0')}`;
} else {
  newHospitalNumber = `${hospitalNumberPrefix}001`; // Start with 001 if none exist
}

    // Define parameters for the new patient
    request.input('lastName', sql.VarChar, lastName);
    request.input('firstName', sql.VarChar, firstName);
    request.input('middleName', sql.VarChar, middleName);
    request.input('title', sql.VarChar, title);
    request.input('dateOfBirth', sql.Date, dateOfBirth);
    request.input('gender', sql.VarChar, mappedGender);
    request.input('address1', sql.VarChar, address1);
    request.input('address2', sql.VarChar, address2);
    request.input('addressCity', sql.VarChar, addressCity);
    request.input('addressState', sql.VarChar, addressState);
    request.input('addressPostCode', sql.VarChar, addressPostCode);
    request.input('addressCountry', sql.VarChar, addressCountry);
    request.input('phoneNumber', sql.VarChar, phoneNumber);
    request.input('hospitalNumber', sql.VarChar, newHospitalNumber);
    request.input('processed', sql.Bit, 0); // processed = 0

    // Insert into newpatients table
    await request.query(
      `INSERT INTO newpatients (lastName, firstName, middleName, title, dateOfBirth, gender, address1, address2, addressCity, addressState, addressPostCode, addressCountry, phoneNumber, patientID, processed) 
       VALUES (@lastName, @firstName, @middleName, @title, @dateOfBirth, @gender, @address1, @address2, @addressCity, @addressState, @addressPostCode, @addressCountry, @phoneNumber, @hospitalNumber, @processed)`
    );

    res.send('Patient submitted successfully!');
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send('Error inserting data');
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});