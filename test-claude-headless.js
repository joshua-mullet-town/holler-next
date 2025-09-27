const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Test function for Claude CLI headless integration
async function testClaudeHeadless() {
    console.log('Testing Claude CLI headless integration...\n');
    
    // Test 1: Basic exec with text output
    console.log('1. Testing basic text output:');
    try {
        const { stdout, stderr } = await execAsync('claude -p "What is 5+5?"');
        console.log('✅ Success:', stdout.trim());
        console.log('Errors:', stderr || 'none');
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: JSON output format
    console.log('2. Testing JSON output format:');
    try {
        const { stdout, stderr } = await execAsync('claude -p "What is 7+7?" --output-format json');
        const response = JSON.parse(stdout);
        console.log('✅ Success:');
        console.log('  Result:', response.result);
        console.log('  Cost:', `$${response.total_cost_usd}`);
        console.log('  Duration:', `${response.duration_ms}ms`);
        console.log('  Session ID:', response.session_id);
        console.log('Errors:', stderr || 'none');
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: spawn method (addressing the GitHub issue)
    console.log('3. Testing spawn method with proper stdio:');
    return new Promise((resolve) => {
        const child = spawn('claude', ['-p', 'What is 9+9?', '--output-format', 'json'], {
            stdio: ['inherit', 'pipe', 'pipe'] // This should help with the hanging issue
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (code === 0 && stdout) {
                try {
                    const response = JSON.parse(stdout);
                    console.log('✅ Spawn Success:');
                    console.log('  Result:', response.result);
                    console.log('  Cost:', `$${response.total_cost_usd}`);
                    console.log('  Duration:', `${response.duration_ms}ms`);
                } catch (parseError) {
                    console.log('❌ JSON Parse Error:', parseError.message);
                    console.log('Raw output:', stdout);
                }
            } else {
                console.log('❌ Spawn Error - Code:', code);
                console.log('Stdout:', stdout);
                console.log('Stderr:', stderr);
            }
            resolve();
        });
        
        // Timeout after 30 seconds to prevent hanging
        setTimeout(() => {
            child.kill('SIGTERM');
            console.log('❌ Spawn timeout - process killed');
            resolve();
        }, 30000);
    });
}

// Test 4: Utility function for production use
function claudeQuery(prompt, options = {}) {
    return new Promise((resolve, reject) => {
        const args = ['-p', prompt];
        
        if (options.outputFormat) {
            args.push('--output-format', options.outputFormat);
        }
        
        if (options.allowedTools && Array.isArray(options.allowedTools)) {
            args.push('--allowed-tools', options.allowedTools.join(','));
        }
        
        if (options.maxTurns) {
            args.push('--max-turns', options.maxTurns.toString());
        }
        
        if (options.dangerouslySkipPermissions) {
            args.push('--dangerously-skip-permissions');
        }
        
        const child = spawn('claude', args, {
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                if (options.outputFormat === 'json') {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (parseError) {
                        reject(new Error(`JSON parse error: ${parseError.message}\nRaw output: ${stdout}`));
                    }
                } else {
                    resolve(stdout.trim());
                }
            } else {
                reject(new Error(`Claude CLI exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
            }
        });
        
        child.on('error', (error) => {
            reject(error);
        });
        
        // Timeout after 60 seconds
        setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('Claude CLI timeout'));
        }, 60000);
    });
}

// Example usage of the utility function
async function testUtilityFunction() {
    console.log('4. Testing utility function:');
    
    try {
        // Simple text query
        const textResult = await claudeQuery('What is the capital of France?');
        console.log('✅ Text query result:', textResult);
        
        // JSON query with options
        const jsonResult = await claudeQuery('Generate a random number between 1 and 100', {
            outputFormat: 'json'
        });
        console.log('✅ JSON query result:', jsonResult.result);
        console.log('  Cost:', `$${jsonResult.total_cost_usd}`);
        
    } catch (error) {
        console.log('❌ Utility function error:', error.message);
    }
}

// Run all tests
async function runAllTests() {
    await testClaudeHeadless();
    console.log('\n' + '='.repeat(50) + '\n');
    await testUtilityFunction();
    
    console.log('\n🎉 Testing complete! Copy the claudeQuery function for production use.');
}

// Export the utility function for use in other modules
module.exports = { claudeQuery };

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}