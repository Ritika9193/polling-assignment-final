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

let activePoll = null; // Will store { id, question, options, startTime, duration, isActive, isShowingResults }
let pollResults = {};
let studentAnswers = {}; // { pollId: { studentId: true } }
let connectedStudents = new Map(); // socket.id -> name
let pollHistory = [];
let chatHistory = [];

const RESULTS_VIEW_DURATION = 25000; // 20 seconds
let pollTimerId = null;
let resultsTimerId = null;

const endPollVoting = (pollId) => {
  if (activePoll && activePoll.id === pollId && activePoll.isActive) {
    activePoll.isActive = false;
    activePoll.isShowingResults = true;
    
    const currentPollResultsData = pollResults[pollId] || { votes: Array(activePoll.options.length).fill(0), answers: {} };
    io.emit('pollVotingClosed', { pollId: pollId, results: currentPollResultsData });
    
    const pollForHistory = { ...activePoll, results: currentPollResultsData }; // isActive is already false
    pollHistory.push(pollForHistory);

    if (pollTimerId) clearTimeout(pollTimerId);
    if (resultsTimerId) clearTimeout(resultsTimerId);

    resultsTimerId = setTimeout(() => {
      if (activePoll && activePoll.id === pollId && activePoll.isShowingResults) {
        activePoll.isShowingResults = false; // Fully concluded
        io.emit('clearActivePoll');
        // activePoll remains as the last poll (now fully inactive) until a new one starts
      }
    }, RESULTS_VIEW_DURATION);
  }
};

io.on('connection', (socket) => {
  socket.on('registerStudent', (name) => {
    connectedStudents.set(socket.id, name);
    if (activePoll) {
      socket.emit('newPoll', activePoll); // Client will check isActive/isShowingResults
      if (activePoll.isShowingResults || !activePoll.isActive) { // If results are showing or voting is over
        const currentPollResultsData = pollResults[activePoll.id] || { votes: Array(activePoll.options.length).fill(0), answers: {} };
        socket.emit('pollVotingClosed', { pollId: activePoll.id, results: currentPollResultsData });
      }
    } else {
      socket.emit('newPoll', null); // No poll has been run yet
    }
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
      return callback({ error: 'A poll is already active.' });
    }

    if (pollTimerId) clearTimeout(pollTimerId);
    if (resultsTimerId) clearTimeout(resultsTimerId);

    const id = Date.now().toString();
    activePoll = { 
      ...pollData, 
      id, 
      isActive: true, 
      isShowingResults: false,
      startTime: Date.now(),
      duration: pollData.timer
    };
    pollResults[id] = { votes: Array(pollData.options.length).fill(0), answers: {} };
    studentAnswers[id] = {};
    io.emit('newPoll', activePoll);
    callback({ success: true, poll: activePoll });

    pollTimerId = setTimeout(() => {
      endPollVoting(id);
    }, activePoll.duration * 1000);
  });

  // Student submits an answer
  socket.on('submitAnswer', ({ pollId, optionIdx }, callback) => {
    if (!activePoll || !activePoll.isActive || activePoll.id !== pollId) {
      return callback({ error: 'No active poll or poll is not active for voting.' });
    }
    if (pollResults[pollId].answers[socket.id]) {
      return callback({ error: 'Already answered.' });
    }

    pollResults[pollId].votes[optionIdx]++;
    pollResults[pollId].answers[socket.id] = true;
    if (!studentAnswers[pollId]) studentAnswers[pollId] = {};
    studentAnswers[pollId][socket.id] = true;
    
    // Emit full results for the current poll as votes come in
    io.emit('pollResults', pollResults[pollId]); 

    if (Object.keys(studentAnswers[pollId]).length >= connectedStudents.size) {
      endPollVoting(pollId); // All connected students voted
    }
    callback({ success: true });
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