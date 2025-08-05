const axios = require('axios');

async function testSwaggerDocs() {
  try {
    // Test if Swagger JSON is accessible
    const response = await axios.get('http://localhost:3000/api-docs.json');
    
    if (response.status === 200 && response.data) {
      console.log('✅ Swagger documentation is working correctly!');
      console.log('Available API endpoints:');
      
      // Extract and display available paths
      const paths = response.data.paths;
      Object.keys(paths).forEach(path => {
        console.log(`- ${path}`);
        Object.keys(paths[path]).forEach(method => {
          console.log(`  • ${method.toUpperCase()}: ${paths[path][method].summary}`);
        });
      });
    } else {
      console.log('❌ Swagger documentation is not working correctly.');
    }
  } catch (error) {
    console.error('❌ Error testing Swagger documentation:', error.message);
  }
}

// Run the test
testSwaggerDocs();