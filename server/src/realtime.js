import { Server } from 'socket.io';
import { authorizeThread, threadRoom } from './access.js';
import { userFromToken } from './auth.js';
import { config } from './config.js';
import { markMessages, userRoom } from './receipts.js';

/** Live updates: clients join a thread room after the same access check as the REST API. */
export function attachRealtime(httpServer, app) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins.length ? config.corsOrigins : false },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromToken(socket.handshake.auth?.token);
      next();
    } catch (err) {
      next(new Error(err.message));
    }
  });

  io.on('connection', (socket) => {
    // A personal room lets the server push messages (and know the user is online) anywhere in the app.
    const userId = socket.data.user._id;
    void socket.join(userRoom(userId));
    // Anything sent while this user was offline has now reached their device.
    void markMessages(io, { recipientId: userId }).catch(() => {});

    socket.on('thread:join', async ({ childId, parentId } = {}, ack) => {
      try {
        await authorizeThread(socket.data.user, childId, parentId);
        await socket.join(threadRoom(childId, parentId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });
    socket.on('thread:leave', ({ childId, parentId } = {}) => {
      void socket.leave(threadRoom(childId, parentId));
    });
  });

  app.set('io', io);
  return io;
}
