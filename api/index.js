import serverless from 'serverless-http';
import { createApp } from '../backend/src/createApp.js';

const app = createApp();
export default serverless(app);