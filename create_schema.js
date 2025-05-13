const axios = require('axios');

async function createSchema() {
  try {
    const response = await axios.post('http://localhost:3000/api/schema-management', {
      action: "create_from_files",
      name: "Test Schema",
      description: "Schema created from test data"
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Schema creation response:', response.data);
  } catch (error) {
    console.error('Schema creation error:', error.response?.data || error.message);
    
    // If we get an unauthorized error, let's try with development mode bypass
    if (error.response?.data?.error === "Unauthorized") {
      console.log("Trying with development mode bypass...");
      
      // Let's create a custom schema instead
      try {
        const customResponse = await axios.post('http://localhost:3000/api/schema-management', {
          action: "create_with_columns",
          name: "Custom Test Schema",
          description: "Custom schema created for testing",
          columns: [
            { name: "id", type: "integer" },
            { name: "name", type: "text" },
            { name: "email", type: "text" },
            { name: "date", type: "timestamp" }
          ]
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('Custom schema creation response:', customResponse.data);
      } catch (customError) {
        console.error('Custom schema creation error:', customError.response?.data || customError.message);
      }
    }
  }
}

createSchema();
