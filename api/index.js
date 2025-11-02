import { createApp } from '../backend/src/createApp.js';
const app = createApp();
export default function handler(req, res) {
    return app(req, res);
}