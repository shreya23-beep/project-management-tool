import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, columnId, priority, projectId } = req.body;

  const taskCount = await prisma.task.count({ where: { columnId } });

  const task = await prisma.task.create({
    data: {
      title,
      description,
      columnId,
      priority: priority || 'MEDIUM',
      order: taskCount
    },
    include: { assignee: { select: { id: true, name: true } } }
  });

  req.io?.to(`project:${projectId}`).emit('task_created', task);

  res.status(201).json(task);
});

router.patch('/:id/move', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { targetColumnId, newOrder, projectId } = req.body;

  const updated = await prisma.task.update({
    where: { id },
    data: { columnId: targetColumnId, order: newOrder }
  });

  req.io?.to(`project:${projectId}`).emit('task_moved', {
    taskId: id,
    targetColumnId,
    newOrder
  });

  res.json(updated);
});

router.patch('/:id/assign', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { assigneeId } = req.body;

  const task = await prisma.task.update({
    where: { id },
    data: { assigneeId },
    include: { column: true, assignee: { select: { id: true, name: true } } }
  });

  if (assigneeId && assigneeId !== req.user?.id) {
    const notif = await prisma.notification.create({
      data: {
        userId: assigneeId,
        message: `${req.user?.name || 'Someone'} assigned you to: "${task.title}"`
      }
    });
    req.io?.to(`user:${assigneeId}`).emit('new_notification', notif);
  }

  res.json(task);
});

router.post('/:id/comments', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { content, projectId } = req.body;
  const authorId = req.user!.id;

  const comment = await prisma.comment.create({
    data: { content, taskId: id, authorId },
    include: {
      author: { select: { id: true, name: true } },
      task: true
    }
  });

  req.io?.to(`project:${projectId}`).emit('comment_added', comment);

  if (comment.task.assigneeId && comment.task.assigneeId !== authorId) {
    const notif = await prisma.notification.create({
      data: {
        userId: comment.task.assigneeId,
        message: `${req.user?.name || 'Someone'} commented on: "${comment.task.title}"`
      }
    });
    req.io?.to(`user:${comment.task.assigneeId}`).emit('new_notification', notif);
  }

  res.status(201).json(comment);
});

export default router;