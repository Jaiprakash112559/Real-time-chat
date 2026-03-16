require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express and Socket.io
app.use(cors({ origin: '*' }));

const io = new Server(server, {
  cors: {
    // Replace '*' with your actual Netlify link
    origin: ["https://realtimechat123.netlify.app", "http://localhost:3000"], 
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Init Middleware
app.use(express.json());

// Define Routes
app.use('/api/auth', require('./routes/auth'));

// Socket.io logic
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('join_room', async ({ room, username }) => {
    socket.join(room);
    console.log(`User ${username} joined room ${room}`);

    // Send previous messages from DB to the user who just joined
    try {
      const messages = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
      socket.emit('previous_messages', messages);
    } catch (err) {
      console.error(err);
    }

    // Broadcast that a user has joined
    socket.to(room).emit('receive_message', {
      sender: 'System',
      content: `${username} has joined the chat`,
      room,
      timestamp: new Date()
    });
  });

  socket.on('send_message', async (data) => {
    // data = { sender, content, room }
    try {
      const newMessage = new Message({
        sender: data.sender,
        content: data.content,
        room: data.room
      });
      await newMessage.save();

      io.to(data.room).emit('receive_message', newMessage);
    } catch (err) {
      console.error('Error saving message', err);
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.room).emit('user_typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.room).emit('user_stop_typing', data);
  });

  // Edit a message — only the original sender should call this
  socket.on('edit_message', async ({ messageId, newContent, room }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { content: newContent, edited: true },
        { new: true }
      );
      if (updated) {
        io.to(room).emit('message_edited', updated);
      }
    } catch (err) {
      console.error('Error editing message', err);
    }
  });

  // Delete a message — only the original sender should call this
  socket.on('delete_message', async ({ messageId, room }) => {
    try {
      await Message.findByIdAndDelete(messageId);
      io.to(room).emit('message_deleted', { messageId });
    } catch (err) {
      console.error('Error deleting message', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Start server: boot in-memory MongoDB first, then listen
async function startServer() {
  try {
    // Use MongoDB Atlas URI from env if provided, else spin up in-memory DB
    let uri = process.env.MONGODB_URI;
    if (!uri || uri.includes('127.0.0.1') || uri.includes('localhost')) {
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log('[Dev] In-memory MongoDB started');
    }
    await mongoose.connect(uri);
    console.log('MongoDB Connected...');

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
