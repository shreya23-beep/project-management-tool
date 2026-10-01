import { Router } from 'express';
import prisma from '../prisma';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Get all projects for logged in user
router.get('/', authenticateJWT, async (req: any, res: any) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } }
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });

    return res.json(projects);
  } catch (error) {
    console.error('Failed to get projects:', error);
    return res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// Create project
router.post('/', authenticateJWT, async (req: any, res: any) => {
  const { name, description } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        description: description || '',
        members: {
          create: { userId, role: 'ADMIN' }
        },
        columns: {
          create: [
            { title: 'To Do', order: 0 },
            { title: 'In Progress', order: 1 },
            { title: 'Done', order: 2 }
          ]
        }
      },
      include: {
        columns: true,
        members: true
      }
    });

    return res.status(201).json(project);
  } catch (error) {
    console.error('Failed to create project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get single project board
router.get('/:id', authenticateJWT, async (req: any, res: any) => {
  const id = String(req.params.id);

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                assignee: { select: { id: true, name: true, email: true } },
                comments: {
                  include: { author: { select: { id: true, name: true } } }
                }
              }
            }
          }
        },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json(project);
  } catch (error) {
    console.error('Failed to get project:', error);
    return res.status(500).json({ error: 'Failed to retrieve project details' });
  }
});

// Delete project and cascade data
router.delete('/:id', authenticateJWT, async (req: any, res: any) => {
  const id = String(req.params.id);
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId }
    });

    if (!member) {
      return res.status(403).json({ error: 'You do not have permission to delete this project' });
    }

    await prisma.comment.deleteMany({
      where: { task: { column: { projectId: id } } }
    });
    await prisma.task.deleteMany({
      where: { column: { projectId: id } }
    });
    await prisma.column.deleteMany({
      where: { projectId: id }
    });
    await prisma.projectMember.deleteMany({
      where: { projectId: id }
    });
    await prisma.project.delete({
      where: { id }
    });

    return res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return res.status(500).json({ error: 'Internal server error while deleting project' });
  }
});

export default router;