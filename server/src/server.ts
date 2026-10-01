import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { AuthRequest } from './middleware/auth';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';

dotenv.config();

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

app.use((req: AuthRequest, _, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

io.on('connection', (socket) => {
  socket.on('join_project', (projectId: string) => {
    socket.join(`project:${projectId}`);
  });

  socket.on('leave_project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
  });

  socket.on('join_user', (userId: string) => {
    socket.join(`user:${userId}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});