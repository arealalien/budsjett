import serverless from 'serverless-http';
import { createApp } from './src/createApp.js';

const app = createApp();
export default serverless(app);