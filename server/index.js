// backend/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const pollsRouter = require('./polls');

const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use('/polls', pollsRouter);

let activePoll = null;
let pollResults = {};
let studentAnswers = {}; // { pollId: { studentId: true } }
let connectedStudents = new Map(); // socket.id -> name
let pollHistory = [];
let chatHistory = [];

io.on('connection', (socket) => {
  // Student registers with their name
  socket.on('registerStudent', (name) => {
    connectedStudents.set(socket.id, name);
    // Send the active poll to the newly connected student
    if (activePoll && activePoll.isActive) {
      socket.emit('newPoll', activePoll);
    }
    // Broadcast updated participant list
    io.emit('participants', Array.from(connectedStudents.values()));
  });

  socket.on('disconnect', () => {
    connectedStudents.delete(socket.id);
    io.emit('participants', Array.from(connectedStudents.values()));
  });

  // Teacher kicks out a student by name
  socket.on('kickOutStudent', (studentName) => {
    for (const [id, name] of connectedStudents.entries()) {
      if (name === studentName) {
        io.to(id).emit('kickedOut');
        connectedStudents.delete(id);
        io.emit('participants', Array.from(connectedStudents.values()));
        break;
      }
    }
  });

  // Teacher creates a poll
  socket.on('createPoll', (pollData, callback) => {
    if (activePoll && activePoll.isActive) {
      callback({ error: 'A poll is already active.' });
      return;
    }
    const id = Date.now().toString();
    activePoll = { ...pollData, id, isActive: true };
    pollResults[id] = { votes: Array(pollData.options.length).fill(0), answers: {} };
    studentAnswers[id] = {};
    io.emit('newPoll', activePoll);
    callback({ success: true, poll: activePoll });

    // Auto-close poll after 60 seconds
    setTimeout(() => {
      if (activePoll && activePoll.id === id && activePoll.isActive) {
        activePoll.isActive = false;
        io.emit('pollClosed', { pollId: id });
        // Add to poll history
        pollHistory.push({ ...activePoll, results: pollResults[id] });
      }
    }, 60000);
  });

  // Student submits an answer
  socket.on('submitAnswer', ({ pollId, optionIdx, studentId }, callback) => {
    if (!activePoll || !activePoll.isActive || activePoll.id !== pollId) {
      callback({ error: 'No active poll.' });
      return;
    }
    if (pollResults[pollId].answers[studentId]) {
      callback({ error: 'Already answered.' });
      return;
    }
    pollResults[pollId].votes[optionIdx]++;
    pollResults[pollId].answers[studentId] = true;
    studentAnswers[pollId][studentId] = true;
    io.emit('pollResults', pollResults[pollId]);
    // If all students have answered, close the poll
    if (Object.keys(studentAnswers[pollId]).length >= connectedStudents.size) {
      activePoll.isActive = false;
      io.emit('pollClosed', { pollId });
      // Add to poll history
      pollHistory.push({ ...activePoll, results: pollResults[pollId] });
    }
    callback({ success: true });
  });

  // Teacher can request results
  socket.on('getResults', (pollId, callback) => {
    callback(pollResults[pollId] || {});
  });

  // Teacher requests poll history
  socket.on('getPollHistory', (callback) => {
    callback(pollHistory);
  });

  // Send chat history to new connections
  socket.emit('chatHistory', chatHistory);

  // Handle new chat messages
  socket.on('chatMessage', (msg) => {
    chatHistory.push(msg);
    io.emit('chatMessage', msg);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));