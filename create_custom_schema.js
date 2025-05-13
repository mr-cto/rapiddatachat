const axios = require('axios');

async function createCustomSchema() {
  try {
    const response = await axios.post('http://localhost:3000/api/schema-management', {
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
    console.log('Custom schema creation response:', response.data);
  } catch (error) {
    console.error('Custom schema creation error:', error.response?.data || error.message);
  }
}

createCustomSchema();
