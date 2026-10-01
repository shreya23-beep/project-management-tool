import { useState, useEffect } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, MessageSquare, Bell, LogOut, Sparkles, Trash2 } from 'lucide-react';
import { api, socket } from './api';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  order: number;
  columnId: string;
  assignee?: { id: string; name: string };
  comments?: { id: string; content: string; author: { name: string } }[];
}

interface Column {
  id: string;
  title: string;
  order: number;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  columns: Column[];
}

export default function App() {
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; message: string }[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('pm_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      socket.emit('join_user', parsed.id);
    }
  }, []);

  useEffect(() => {
    if (user) {
      api.get('/projects').then((res) => {
        setProjects(res.data);
        if (res.data.length > 0) loadProject(res.data[0].id);
      }).catch((err) => console.error(err));
    }
  }, [user]);

  useEffect(() => {
    socket.on('task_moved', ({ taskId, targetColumnId, newOrder }) => {
      setCurrentProject((prev) => {
        if (!prev) return prev;
        const newCols = prev.columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
        let movingTask: Task | null = null;

        for (const col of newCols) {
          const idx = col.tasks.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            [movingTask] = col.tasks.splice(idx, 1);
            break;
          }
        }

        if (movingTask) {
          movingTask.columnId = targetColumnId;
          movingTask.order = newOrder;
          const targetCol = newCols.find((c) => c.id === targetColumnId);
          if (targetCol) {
            targetCol.tasks.splice(newOrder, 0, movingTask);
            targetCol.tasks.forEach((t, i) => (t.order = i));
          }
        }
        return { ...prev, columns: newCols };
      });
    });

    socket.on('task_created', (task: Task) => {
      setCurrentProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((c) =>
            c.id === task.columnId ? { ...c, tasks: [...c.tasks, task] } : c
          ),
        };
      });
    });

    socket.on('comment_added', (comment: any) => {
      setCurrentProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((c) => ({
            ...c,
            tasks: c.tasks.map((t) =>
              t.id === comment.taskId
                ? { ...t, comments: [...(t.comments || []), comment] }
                : t
            ),
          })),
        };
      });

      setActiveTask((prev) => {
        if (prev && prev.id === comment.taskId) {
          return { ...prev, comments: [...(prev.comments || []), comment] };
        }
        return prev;
      });
    });

    socket.on('new_notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      socket.off('task_moved');
      socket.off('task_created');
      socket.off('comment_added');
      socket.off('new_notification');
    };
  }, []);

  const loadProject = async (id: string) => {
    if (currentProject) socket.emit('leave_project', currentProject.id);
    try {
      const res = await api.get(`/projects/${id}`);
      setCurrentProject(res.data);
      socket.emit('join_project', id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login' ? { email, password } : { email, password, name };
      const res = await api.post(endpoint, payload);
      localStorage.setItem('pm_token', res.data.token);
      localStorage.setItem('pm_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      socket.emit('join_user', res.data.user.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setCurrentProject(null);
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await api.post('/projects', { name: newProjectName });
      setProjects((prev) => [...prev, res.data]);
      setCurrentProject(res.data);
      setNewProjectName('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create project');
    }
  };

  const deleteProject = async (projectId: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this project and all its cards?')) return;

    try {
      await api.delete(`/projects/${projectId}`);
      const remainingProjects = projects.filter((p) => p.id !== projectId);
      setProjects(remainingProjects);

      if (currentProject?.id === projectId) {
        if (remainingProjects.length > 0) {
          loadProject(remainingProjects[0].id);
        } else {
          setCurrentProject(null);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };

  const createTask = async (columnId: string) => {
    if (!newTaskTitle.trim() || !currentProject) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle,
        columnId,
        projectId: currentProject.id,
      });
      setNewTaskTitle('');
      setSelectedColId(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create task');
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !currentProject) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    const newCols = currentProject.columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
    const sourceCol = newCols.find((c) => c.id === source.droppableId);
    const destCol = newCols.find((c) => c.id === destination.droppableId);

    if (sourceCol && destCol) {
      const [movedTask] = sourceCol.tasks.splice(source.index, 1);
      movedTask.columnId = destCol.id;
      destCol.tasks.splice(destination.index, 0, movedTask);
      setCurrentProject({ ...currentProject, columns: newCols });

      try {
        await api.patch(`/tasks/${draggableId}/move`, {
          targetColumnId: destCol.id,
          newOrder: destination.index,
          projectId: currentProject.id,
        });
      } catch (err) {
        console.error('Failed to sync move', err);
      }
    }
  };

  const addComment = async () => {
    if (!activeTask || !newComment.trim() || !currentProject) return;
    try {
      await api.post(`/tasks/${activeTask.id}/comments`, {
        content: newComment,
        projectId: currentProject.id,
      });
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 selection:bg-rose-500/20">
        <div className="bg-[#121215]/90 backdrop-blur-2xl p-8 rounded-3xl border border-white/[0.08] w-full max-w-md shadow-2xl shadow-black/80">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-stone-800 to-stone-700 text-stone-200 border border-white/10 shadow-lg shadow-black/50">
              <Sparkles className="w-5 h-5 text-amber-200/90" />
            </div>
            <h1 className="text-xl font-medium tracking-tight text-stone-100">Project Management</h1>
          </div>

          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-5">
            {authMode === 'login' ? 'Sign in to workspace' : 'Create an account'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="text-[11px] font-medium text-stone-400">Name</label>
                <input
                  type="text"
                  required
                  placeholder="Shreya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-[#18181b]/80 border border-white/[0.08] rounded-2xl text-xs text-stone-100 placeholder:text-stone-600 outline-none focus:border-amber-200/40 transition"
                />
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium text-stone-400">Email address</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 bg-[#18181b]/80 border border-white/[0.08] rounded-2xl text-xs text-stone-100 placeholder:text-stone-600 outline-none focus:border-amber-200/40 transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-stone-400">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1.5 px-3.5 py-2.5 bg-[#18181b]/80 border border-white/[0.08] rounded-2xl text-xs text-stone-100 placeholder:text-stone-600 outline-none focus:border-amber-200/40 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 mt-2 bg-gradient-to-r from-stone-200 to-stone-300 hover:from-white hover:to-stone-200 text-stone-900 text-xs font-semibold tracking-wide rounded-2xl shadow-xl transition cursor-pointer"
            >
              {authMode === 'login' ? 'Continue' : 'Get Started'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-xs text-stone-400 hover:text-stone-200 transition cursor-pointer"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already registered? Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-stone-200 flex flex-col font-sans selection:bg-amber-500/20">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/[0.06] bg-[#0d0d10]/80 backdrop-blur-xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#18181b] border border-white/[0.08] text-stone-300 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-200/90" />
          </div>
          <span className="font-medium text-sm tracking-tight text-stone-100">Project Management</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-2 rounded-xl hover:bg-white/[0.04] transition cursor-pointer text-stone-400 hover:text-stone-200">
              <Bell className="w-4 h-4" />
            </div>
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-amber-400/90 text-[9px] text-stone-950 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 border-l border-white/[0.08] pl-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-stone-800 to-stone-700 border border-white/10 flex items-center justify-center font-medium text-xs text-stone-200 shadow-inner">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-xs font-medium text-stone-300">{user.name}</span>
            <button 
              onClick={handleLogout} 
              className="p-1.5 rounded-xl text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Aesthetic Sidebar */}
        <aside className="w-64 border-r border-white/[0.06] bg-[#0c0c0e]/60 backdrop-blur-md p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-bold tracking-widest text-stone-500 uppercase px-2 mb-3">
              Workspaces
            </h3>
            <div className="space-y-1">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => loadProject(p.id)}
                  className={`group flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                    currentProject?.id === p.id
                      ? 'bg-stone-800/70 text-stone-100 border border-white/[0.1] shadow-md shadow-black/40'
                      : 'text-stone-400 hover:bg-white/[0.03] hover:text-stone-200'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <button
                    onClick={(e) => deleteProject(p.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 text-stone-600 transition p-1 cursor-pointer"
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06]">
            <input
              type="text"
              placeholder="New workspace..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3 py-2 bg-[#141417] border border-white/[0.08] rounded-xl text-xs text-stone-200 placeholder:text-stone-600 mb-2 outline-none focus:border-amber-200/40 transition"
            />
            <button
              onClick={createProject}
              className="w-full flex items-center justify-center gap-2 py-2 bg-stone-900 hover:bg-stone-800/80 border border-white/[0.08] text-xs font-medium text-stone-300 rounded-xl transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-stone-400" /> Add Workspace
            </button>
          </div>
        </aside>

        {/* Board Workspace */}
        <main className="flex-1 overflow-x-auto p-8 bg-[#09090b] flex flex-col">
          {currentProject ? (
            <>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-stone-100">{currentProject.name}</h2>
                  <p className="text-xs text-stone-500 mt-1">{currentProject.description || 'Sprint Workspace'}</p>
                </div>
                <button
                  onClick={() => deleteProject(currentProject.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Project
                </button>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 flex gap-6 items-start">
                  {currentProject.columns.map((column) => (
                    <div
                      key={column.id}
                      className="w-80 bg-[#111114]/80 border border-white/[0.06] rounded-3xl flex flex-col max-h-full backdrop-blur-xl shadow-2xl shadow-black/60"
                    >
                      {/* Column Header */}
                      <div className="p-4 border-b border-white/[0.05] flex items-center justify-between">
                        <span className="font-medium text-stone-200 text-xs tracking-wide">
                          {column.title}
                        </span>
                        <span className="text-[11px] bg-white/[0.05] text-stone-400 px-2 py-0.5 rounded-full font-mono">
                          {column.tasks.length}
                        </span>
                      </div>

                      {/* Droppable Task Container */}
                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`p-3 flex-1 overflow-y-auto space-y-2.5 min-h-[160px] transition-colors rounded-b-3xl ${
                              snapshot.isDraggingOver ? 'bg-amber-950/10' : ''
                            }`}
                          >
                            {column.tasks.map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    onClick={() => setActiveTask(task)}
                                    className={`p-3.5 bg-[#17171b]/90 border border-white/[0.06] rounded-2xl hover:border-white/[0.15] cursor-pointer transition shadow-sm ${
                                      dragSnapshot.isDragging ? 'shadow-2xl border-stone-400/50 scale-[1.02] bg-[#1d1d22]' : ''
                                    }`}
                                  >
                                    <h4 className="text-xs font-normal text-stone-200 mb-3 leading-snug">
                                      {task.title}
                                    </h4>
                                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                                      <span
                                        className={`px-2 py-0.5 rounded-lg font-medium text-[9px] tracking-wider uppercase ${
                                          task.priority === 'HIGH' || task.priority === 'URGENT'
                                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                            : task.priority === 'MEDIUM'
                                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                        }`}
                                      >
                                        {task.priority}
                                      </span>
                                      <div className="flex items-center gap-2.5">
                                        {task.comments && task.comments.length > 0 && (
                                          <span className="flex items-center gap-1 text-stone-500 text-[10px]">
                                            <MessageSquare className="w-3 h-3" />
                                            {task.comments.length}
                                          </span>
                                        )}
                                        {task.assignee && (
                                          <div className="w-5 h-5 rounded-full bg-stone-700 border border-white/10 flex items-center justify-center text-[9px] font-bold text-stone-200">
                                            {task.assignee.name.charAt(0)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      {/* Add Task Box */}
                      <div className="p-3 border-t border-white/[0.05]">
                        {selectedColId === column.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Task name..."
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#09090b] border border-white/[0.1] rounded-xl text-xs text-stone-200 outline-none focus:border-amber-200/40"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => createTask(column.id)}
                                className="px-3 py-1 bg-stone-200 hover:bg-white text-stone-950 text-[11px] font-medium rounded-xl cursor-pointer transition"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setSelectedColId(null)}
                                className="px-3 py-1 bg-stone-800 text-stone-400 hover:text-stone-200 text-[11px] rounded-xl cursor-pointer transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedColId(column.id)}
                            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-300 hover:bg-white/[0.03] rounded-2xl transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Task
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DragDropContext>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-600 text-xs gap-3">
              <Sparkles className="w-6 h-6 stroke-[1.25] text-stone-700" />
              <span>Select or create a workspace to view tasks</span>
            </div>
          )}
        </main>
      </div>

      {/* Task Modal */}
      {activeTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#121215] border border-white/[0.08] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/[0.06] flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-stone-100">{activeTask.title}</h3>
                <span className="text-xs text-stone-500">Details & discussion</span>
              </div>
              <button
                onClick={() => setActiveTask(null)}
                className="text-stone-500 hover:text-stone-200 p-1 cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto space-y-4">
              <div>
                <h5 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2.5">
                  Comments
                </h5>
                <div className="space-y-2">
                  {activeTask.comments && activeTask.comments.length > 0 ? (
                    activeTask.comments.map((c) => (
                      <div key={c.id} className="p-3 bg-[#18181b]/70 border border-white/[0.04] rounded-2xl text-xs">
                        <span className="font-semibold text-stone-300 mr-2">{c.author.name}:</span>
                        <span className="text-stone-400">{c.content}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-600">No comments on this card yet.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Write a response..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#09090b] border border-white/[0.08] rounded-xl text-xs text-stone-200 placeholder:text-stone-600 outline-none focus:border-amber-200/40"
                />
                <button
                  onClick={addComment}
                  className="px-3.5 py-2 bg-stone-200 hover:bg-white text-stone-950 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}