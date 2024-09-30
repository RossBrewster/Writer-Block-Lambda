import { openaiHandler } from './src/handler';
import dotenv from 'dotenv';

dotenv.config();

async function testHandler() {
    const event = {
    body: JSON.stringify({
        prompt: "Translate the following English text to French: Hello, world!"
    })
    };

    const context = {} as any;

    try {
    const result = await openaiHandler(event as any, context, () => {});
    console.log('Result:', result);
    } catch (error) {
    console.error('Error:', error);
    }
}

testHandler();