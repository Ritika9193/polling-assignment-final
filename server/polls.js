const express = require('express');
const router = express.Router();

let activePoll = null;
let pollResults = {};

// Create a new poll
router.post('/', (req, res) => {
  if (activePoll) {
    return res.status(400).json({ error: 'A poll is already active.' });
  }
  const { question, options, timer } = req.body;
  const id = Date.now().toString();
  activePoll = { id, question, options, timer, createdAt: Date.now(), isActive: true };
  pollResults[id] = { votes: Array(options.length).fill(0), answers: {} };
  res.json(activePoll);
});

// Get active poll
router.get('/active', (req, res) => {
  if (!activePoll || !activePoll.isActive) return res.json(null);
  res.json(activePoll);
});

// Close poll
router.post('/:id/close', (req, res) => {
  if (!activePoll || activePoll.id !== req.params.id) {
    return res.status(404).json({ error: 'Poll not found.' });
  }
  activePoll.isActive = false;
  res.json({ success: true });
});

// Get poll results
router.get('/:id/results', (req, res) => {
  const results = pollResults[req.params.id];
  if (!results) return res.status(404).json({ error: 'Results not found.' });
  res.json(results);
});

module.exports = router; 