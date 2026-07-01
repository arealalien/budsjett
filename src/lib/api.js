import axios from 'axios';

export const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});
