/* **************************************
| Elijah Campbell-Ihim                  |
| 5/8/2024                              |
| CMPS-369 Web Application Development  |
| Final Project (P5)                    |
****************************************/



//General Requires
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const geo = require('node-geocoder');

// Initialize geocoder
const geocoder = geo({ provider: 'openstreetmap' });

// For Database
require('dotenv').config();
const Database = require('dbcmps369/index');
const db = new Database();

// Sessions and Encryption
const session = require('express-session');
const bcrypt = require('bcrypt');

// Create app & connect to database
const app = express();
app.locals.pretty = true;
db.connect();

// Set up body-parser middleware to parse JSON and URL-encoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Set up session middleware
app.use(session({
    secret: 'cmps369',
    resave: false,
    saveUninitialized: true
}));

// Set the view engine to Pug
app.set('view engine', 'pug');

// Set the directory for views
app.set('views', path.join(__dirname, 'views'));



// Connect to database
const initializeDatabase = async () => {
    try {
        await db.connect();
        // Define table schema if not exists
        await db.schema('users', [
            { name: 'id', type: 'INTEGER' },
            { name: 'first_name', type: 'TEXT' },
            { name: 'last_name', type: 'TEXT' },
            { name: 'username', type: 'TEXT' },
            { name: 'password', type: 'TEXT' }
        ], 'id');

        await db.schema('contacts', [
            { name: 'id', type: 'INTEGER' },
            { name: 'first_name', type: 'TEXT' },
            { name: 'last_name', type: 'TEXT' },
            { name: 'phone', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
            { name: 'street', type: 'TEXT' },
            { name: 'city', type: 'TEXT' },
            { name: 'state', type: 'TEXT' },
            { name: 'zip', type: 'TEXT' },
            { name: 'country', type: 'TEXT' },
            { name: 'contact_by_phone', type: 'INTEGER' },
            { name: 'contact_by_email', type: 'INTEGER' },
            { name: 'contact_by_mail', type: 'INTEGER' }, 
            { name: 'latitude', type: 'REAL' },
            { name: 'longitude', type: 'REAL' }
        ], 'id');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};



// Check if user "cmps369" exists during initialization
const initializeUser = async () => {
    try {
        // Connect to the database
        await db.connect();

        // Check if user "cmps369" exists
        const users = await db.read('users', [{ column: 'username', value: 'cmps369' }]);
        if (users.length === 0) {
            // User does not exist, create it
            const hashedPassword = await bcrypt.hash('rcnj', 10);
            await db.create('users', [{ column: 'first_name', value: 'Default' }, { column: 'last_name', value: 'Profile' }, 
            { column: 'username', value: 'cmps369' }, { column: 'password', value: hashedPassword }]);
            console.log('User "cmps369" created');
        } else {
            console.log('User "cmps369" already exists');
        }
    } catch (error) {
        console.error('Error initializing user:', error);
    }
};



// Function to start the server only after database initialization and default user creation
const startServer = async () => {
    await initializeDatabase();
    await initializeUser();
    
    // Start Server on port 8080
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
};


// Start the server
startServer();



// Route for Home Page
app.get('/', async (req, res) => {
    try {
        // Fetch all contacts from the database
        const contacts = await db.read('contacts', []);
        
        // Render the index.pug template with contacts
        res.render('index', { user: req.session.user, contacts });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).send('Error fetching contacts');
    }
});


// Route for Sign In Page
app.get('/login', (req, res) => {
    // Render the login.pug template
    res.render('login');
});


// Handle form submission to sign in user
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Retrieve user data from the database
    db.read('users', [{ column: 'username', value: username }])
        .then(users => {
            const user = users[0];
            if (!user) {
                res.render('login', { error: 'Invalid username or password' });
                return;
            }
            // Compare the provided password with the hashed password
            bcrypt.compare(password, user.password)
                .then(result => {
                    if (!result) {
                        res.render('login', { error: 'Invalid username or password' });
                    } else {
                        // Store user data in session
                        req.session.user = user;
                        res.redirect('/');
                    }
                })
                .catch(err => {
                    console.error('Error comparing passwords:', err.message);
                    res.status(500).send('Internal Server Error');
                });
        })
        .catch(err => {
            console.error('Error retrieving user:', err.message);
            res.status(500).send('Internal Server Error');
        });
});



// Route for handling logout requests
app.get('/logout', (req, res) => {
    // Clear the user session
    req.session.user = null;
    // Redirect to the home page after logout
    res.redirect('/');
});



// Route for Sign Up Page
app.get('/signup', (req, res) => {
    // Render the signup.pug template
    res.render('signup');
});



// Handle form submission to create a new user
app.post('/signup', (req, res) => {
    const { first_name, last_name, username, password, password2 } = req.body;

    // Check if the passwords match
    if (password !== password2) {
        return res.render('signup', { error: 'Passwords do not match' });
    }


    // Check if the username already exists
    db.read('users', [{ column: 'username', value: username }])
        .then(users => {
            if (users.length > 0) {
                return res.render('signup', { error: 'Username already exists' });
            }

            // Hash the password
            bcrypt.hash(password, 10)
                .then(hashedPassword => {
                    // Insert the user into the database
                    return db.create('users', [
                        { column: 'first_name', value: first_name },
                        { column: 'last_name', value: last_name },
                        { column: 'username', value: username },
                        { column: 'password', value: hashedPassword }
                    ]);
                })
                .then(() => {
                    res.redirect('/login');
                })
                .catch(err => {
                    console.error('Error creating user:', err.message);
                    res.status(500).send('Internal Server Error');
                });
        })
        .catch(err => {
            console.error('Error checking username:', err.message);
            res.status(500).send('Internal Server Error');
        });
});



// Route for Create Contact Page
app.get('/create', (req, res) => {
    // Render the create.pug template
    res.render('create', { user: req.session.user });
});



// Handle form submission to create a new contact
app.post('/create', async (req, res) => {
    // Extract data from the request body
    const { first_name, last_name, phone, email, street, city, state, zip, country, contact_by_phone, contact_by_email, contact_by_mail } = req.body;


    // Check if first_name and last_name are provided
    if (!first_name.trim() || !last_name.trim()) {
        // Render an error message if name fields are missing
        return res.render('create', { error: 'Please provide both a first and last name' });
    }

    try {
        // Perform geocoding to get latitude and longitude from the provided address
        const address = `${street}, ${city}, ${state}, ${zip}, ${country}`;
        const geocodeResult = await geocoder.geocode(address);

        // Check if geocoding result exists
        if (geocodeResult && geocodeResult.length > 0) {
            // Use the first result
            const { latitude, longitude } = geocodeResult[0];

            // Create an object with the contact data
            const contactData = {
                first_name,
                last_name,
                phone,
                email,
                street,
                city,
                state,
                zip,
                country,
                contact_by_phone: contact_by_phone ? 1 : 0, 
                contact_by_email: contact_by_email ? 1 : 0,
                contact_by_mail: contact_by_mail ? 1 : 0,
                latitude,
                longitude
            };

            // Insert the contact data into the database
            await db.create('contacts', Object.entries(contactData).map(([key, value]) => ({ column: key, value })));

            // Redirect to home page displaying the newly created contact
            res.redirect('/');
        } else {
            // If no result found, render an error message
            return res.render('create', { error: 'Address not found. Please enter an alternative address' });
        }
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).send('Error creating contact');
    }
});



// Route to display individual contact information
app.get('/:id', (req, res) => {
    const contactIndex = req.params.id;

    // Retrieve contact data from the database
    db.read('contacts', [{ column: 'id', value: contactIndex }])
        .then(contacts => {
            const contact = contacts[0];
            if (!contact) {
                res.status(404).send('Contact not found');
            } else {
                // Render the contact.pug template with the retrieved contact data
                res.render('contact', { user: req.session.user, contact, contactIndex });
            }
        })
        .catch(err => {
            console.error('Error retrieving contact:', err.message);
            res.status(500).send('Internal Server Error');
        });
});



// Route to edit individual contact information
app.get('/:id/edit', (req, res) => {
    const contactId = req.params.id;

    // Check if user is logged in
    if (!req.session.user) {
        // If not logged in, throw 401 Unauthorized status
        res.status(401).render('error', { errorCode: 401, errorMessage: 'Not Authorized' });
        return;
    }


    // Retrieve contact data from the database
    db.read('contacts', [{ column: 'id', value: contactId }])
        .then(contacts => {
            const contact = contacts[0];
            if (!contact) {
                res.status(404).send('Contact not found');
            } else {
                // Render the edit.pug template with the retrieved contact data
                res.render('edit', { user: req.session.user, contact });
            }
        })
        .catch(err => {
            console.error('Error retrieving contact:', err.message);
            res.status(500).send('Internal Server Error');
        });
});



// Update individual contact information based on edit form
app.post('/:id/edit', async (req, res) => {
    const contactId = req.params.id;
    const { first_name, last_name, phone, email, street, city, state, zip, country, contact_by_phone, contact_by_email, contact_by_mail } = req.body;

    // Check if first_name and last_name are provided
    if (!first_name.trim() || !last_name.trim()) {
        // Render an error message if name fields are missing
        return res.render('edit', { error: 'Please provide both a first and last name' });
    }

    try {
        // Perform geocoding to get latitude and longitude from the provided address
        const address = `${street}, ${city}, ${state}, ${zip}, ${country}`;
        const geocodeResult = await geocoder.geocode(address);

        // Check if geocoding result exists
        if (geocodeResult && geocodeResult.length > 0) {
            // Use the first result
            const { latitude, longitude } = geocodeResult[0];

            // Create an object with the contact data
            const contactData = {
                first_name,
                last_name,
                phone,
                email,
                street,
                city,
                state,
                zip,
                country,
                contact_by_phone: contact_by_phone ? 1 : 0,
                contact_by_email: contact_by_email ? 1 : 0,
                contact_by_mail: contact_by_mail ? 1 : 0,
                latitude,
                longitude
            };

            // Construct an array of update objects
            const updateData = Object.entries(contactData).map(([key, value]) => ({
                column: key,
                value
            }));

            // Update contact data in the database
            await db.update('contacts', updateData, [{ column: 'id', value: contactId }]);

            // Redirect to home page
            res.redirect('/');
        } else {
            // If no result found, render an error message
            return res.render('edit', { error: 'Address not found. Please enter an alternative address' });
        }
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).send('Error updating contact');
    }
});



// Route to delete individual contact information
app.get('/:id/delete', (req, res) => {
    const contactIndex = req.params.id;

    // Check if user is logged in
    if (!req.session.user) {
        // If not logged in, throw 401 Unauthorized status
        res.status(401).render('error', { errorCode: 401, errorMessage: 'Not Authorized' });
        return;
    }


    // Retrieve contact data from the database
    db.read('contacts', [{ column: 'id', value: contactIndex }])
        .then(contacts => {
            const contact = contacts[0];
            if (!contact) {
                res.status(404).send('Contact not found');
            } else {
                // Render the delete.pug template with the retrieved contact data
                res.render('delete', { user: req.session.user, contact, contactIndex });
            }
        })
        .catch(err => {
            console.error('Error retrieving contact:', err.message);
            res.status(500).send('Internal Server Error');
        });
});



// Delete individual contact information based on delete form
app.post('/:id/delete', (req, res) => {
    const contactId = req.params.id;

    // Delete contact from the database
    db.delete('contacts', [{ column: 'id', value: contactId }])
        .then(() => {
            res.redirect('/');
        })
        .catch(err => {
            console.error('Error deleting contact:', err.message);
            res.status(500).send('Internal Server Error');
        });
});








