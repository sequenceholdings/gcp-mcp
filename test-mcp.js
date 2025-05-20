#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// Start the MCP server as a child process
const mcpServer = spawn('tsx', ['index.ts'], {
  stdio: ['pipe', 'pipe', process.stderr]
});

// Handle server output
const serverOut = readline.createInterface({
  input: mcpServer.stdout,
  terminal: false
});

// Create a function to send a request to the server and get the response
function sendRequest(method, params = {}) {
  return new Promise((resolve) => {
    const request = {
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method,
      params
    };

    // Listen for the response
    let responseData = '';
    const responseHandler = (line) => {
      try {
        responseData += line;
        const response = JSON.parse(responseData);
        if (response.id === request.id) {
          serverOut.removeListener('line', responseHandler);
          resolve(response);
        }
      } catch (e) {
        // Incomplete JSON, continue collecting data
      }
    };

    serverOut.on('line', responseHandler);

    // Send the request
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function main() {
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    console.log('🔍 Testing GCP MCP Server...');
    
    // Use the initialize method first
    console.log('\n🚀 Initializing MCP connection:');
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
    console.log('Initialize response:', JSON.stringify(initResponse, null, 2));
    
    // List available tools - correct method name is 'tools/list'
    console.log('\n📋 Listing available tools:');
    const toolsResponse = await sendRequest('tools/list');
    console.log('Tools response:', JSON.stringify(toolsResponse, null, 2));
    
    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log('\nAvailable tools:');
      toolsResponse.result.tools.forEach(tool => {
        console.log(`- ${tool.name}: ${tool.description}`);
      });

      // List available projects - using tools/call
      console.log('\n🔍 Listing available GCP projects:');
      const projectsResponse = await sendRequest('tools/call', {
        name: 'list-projects',
        arguments: {}
      });
      console.log('Projects response:', JSON.stringify(projectsResponse, null, 2));
      
      if (projectsResponse.result && projectsResponse.result.content) {
        const content = projectsResponse.result.content.find(c => c.type === 'text');
        if (content) {
          console.log('\nProjects:', content.text);
          
          try {
            const projectsData = JSON.parse(content.text);
            if (projectsData.projects && projectsData.projects.length > 0) {
              // Try to select the first project
              console.log('\nTrying to parse first project...');
              const firstProject = JSON.parse(projectsData.projects[0]);
              console.log('First project:', firstProject);
              const projectId = firstProject.projectId;
              
              console.log(`\n🔍 Selecting project: ${projectId}`);
              const selectResponse = await sendRequest('tools/call', {
                name: 'select-project',
                arguments: { projectId }
              });
              
              console.log('Select response:', JSON.stringify(selectResponse, null, 2));
              
              // Try getting billing info for the selected project
              console.log('\n💰 Getting billing info:');
              const billingResponse = await sendRequest('tools/call', {
                name: 'get-billing-info',
                arguments: {}
              });
              
              console.log('Billing info response:', JSON.stringify(billingResponse, null, 2));
            }
          } catch (e) {
            console.log('Error parsing projects:', e.message);
          }
        } else {
          console.log('No text content in response');
        }
      } else {
        console.log('Error or unexpected format in projects response');
      }
    } else {
      console.log('Error getting tools or no tools available');
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    mcpServer.stdin.end();
    setTimeout(() => {
      mcpServer.kill();
      process.exit(0);
    }, 1000);
  }
}

main(); 