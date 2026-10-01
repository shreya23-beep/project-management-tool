import axios from 'axios';
import { io } from 'socket.io-client';

export const API_BASE = 'http://localhost:5000/api';
export const socket = io('http://localhost:5000');

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});