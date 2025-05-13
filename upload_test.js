const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function uploadFile() {
  const form = new FormData();
  form.append('file', fs.createReadStream('./test_data.csv'));
  
  try {
    const response = await axios.post('http://localhost:3000/api/upload', form, {
      headers: {
        ...form.getHeaders()
      }
    });
    console.log('Upload response:', response.data);
  } catch (error) {
    console.error('Upload error:', error.response?.data || error.message);
  }
}

uploadFile();
