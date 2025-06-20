"use client"

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket;

const mockParticipants = [
  { name: "Rahul Arora" },
  { name: "Pushpender Rautela" },
  { name: "Rijul Zalpuri" },
  { name: "Nadeem N" },
  { name: "Ashwin Sharma" },
];

export default function TeacherPage() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const [activePoll, setActivePoll] = useState<any>(null);
  const [pollResults, setPollResults] = useState<any>(null);
  const [showPollForm, setShowPollForm] = useState(true);
  const [tab, setTab] = useState<'chat' | 'participants'>('chat');
  const [chat, setChat] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pollHistory, setPollHistory] = useState<any[]>([]);

  useEffect(() => {
    socket = io("http://localhost:5001");
    socket.on("newPoll", (poll: any) => {
      setActivePoll(poll);
      setShowPollForm(false);
      setError("");
      setPollResults(null);
    });
    socket.on("pollClosed", () => {
      setActivePoll(null);
      setShowPollForm(true);
    });
    socket.on("pollResults", (results: any) => {
      setPollResults(results);
    });
    socket.on("participants", (list: string[]) => {
      setParticipants(list);
    });
    socket.on("chatHistory", (history: any[]) => {
      setChat(history);
    });
    socket.on("chatMessage", (msg: any) => {
      setChat((prev) => [...prev, msg]);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOptionChange = (idx: number, value: string) => {
    setOptions(options.map((opt, i) => i === idx ? { ...opt, text: value } : opt));
  };

  const handleCorrectChange = (idx: number, isCorrect: boolean) => {
    setOptions(options.map((opt, i) => i === idx ? { ...opt, isCorrect } : opt));
  };

  const addOption = () => {
    setOptions([...options, { text: "", isCorrect: false }]);
  };

  const handleAskQuestion = () => {
    if (!question.trim() || options.some(opt => !opt.text.trim())) {
      setError("Please fill in the question and all options.");
      return;
    }
    socket.emit(
      "createPoll",
      { question, options, timer },
      (response: any) => {
        if (response.error) {
          setError(response.error);
        } else {
          setActivePoll(response.poll);
          setError("");
        }
      }
    );
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      const msg = { user: "Teacher", text: chatInput };
      socket.emit('chatMessage', msg);
      setChatInput("");
    }
  };

  const handleKickOut = (name: string) => {
    socket.emit('kickOutStudent', name);
  };

  const fetchPollHistory = () => {
    socket.emit('getPollHistory', (history: any[]) => {
      setPollHistory(history);
      setHistoryOpen(true);
    });
  };

  return (
    <div className="min-h-screen bg-white px-8 py-8 flex flex-row justify-center items-start">
      {/* Poll History Button */}
      <button
        className="fixed top-8 right-8 bg-purple-600 text-white px-6 py-2 rounded-full shadow-lg z-50 hover:bg-purple-700 transition-colors"
        onClick={fetchPollHistory}
      >
        Poll History
      </button>
      {/* Poll History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[32rem] max-h-[80vh] overflow-y-auto p-6 relative">
            <button
              className="absolute top-2 right-4 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close history"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4">Poll History</h2>
            {pollHistory.length === 0 ? (
              <div className="text-gray-500">No previous polls.</div>
            ) : (
              pollHistory.slice().reverse().map((poll, idx) => (
                <div key={poll.id || idx} className="mb-6 border-b pb-4">
                  <div className="font-semibold mb-2">{poll.question}</div>
                  <div>
                    {poll.options.map((opt: any, i: number) => {
                      const totalVotes = poll.results ? poll.results.votes.reduce((a: number, b: number) => a + b, 0) : 0;
                      const percent = poll.results && totalVotes > 0 ? (poll.results.votes[i] / totalVotes) * 100 : 0;
                      return (
                        <div key={i} className="mb-2">
                          <div className="flex items-center">
                            <span className="w-6 h-6 flex items-center justify-center rounded-full mr-3 bg-purple-500 text-white">{i + 1}</span>
                            <span className="flex-1">{opt.text}</span>
                            <span className="ml-2 text-gray-500 text-sm">{poll.results ? poll.results.votes[i] : 0} votes</span>
                          </div>
                          <div className="h-2 bg-purple-300 rounded mt-1 mb-2" style={{ width: `${percent}%` }}></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center">
        {/* Poll Form or Poll Results */}
        {showPollForm ? (
          <div className="w-full max-w-xl">
            {/* Header */}
            <div className="flex items-center mb-8">
              <span className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full mr-4">
                <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
                Intervue Poll
              </span>
              <h1 className="text-4xl font-bold text-gray-900 ml-2">Let's <span className="font-extrabold">Get Started</span></h1>
            </div>
            <p className="text-gray-500 mb-8 max-w-xl">
              you'll have the ability to create and manage polls, ask questions, and monitor your students' responses in real-time.
            </p>
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {/* Question Input */}
            <div className="mb-6 flex items-center justify-between">
              <label className="font-semibold text-lg">Enter your question</label>
              <select
                className="border rounded px-4 py-2 text-gray-700"
                value={timer}
                onChange={e => setTimer(Number(e.target.value))}
                disabled={!showPollForm}
              >
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={90}>90 seconds</option>
              </select>
            </div>
            <textarea
              className="w-full h-32 bg-gray-100 rounded p-4 text-lg mb-2 resize-none"
              maxLength={100}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Type your question here..."
              disabled={!showPollForm}
            />
            <div className="text-right text-gray-400 mb-6">{question.length}/100</div>
            {/* Options */}
            <div className="mb-2 flex justify-between items-center">
              <label className="font-semibold">Edit Options</label>
              <label className="font-semibold">Is it Correct?</label>
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center mb-4">
                <span className="w-6 h-6 flex items-center justify-center bg-purple-500 text-white rounded-full mr-3">{idx + 1}</span>
                <input
                  className="flex-1 bg-gray-100 rounded px-4 py-2 mr-4"
                  value={opt.text}
                  onChange={e => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  disabled={!showPollForm}
                />
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={opt.isCorrect}
                      onChange={() => handleCorrectChange(idx, true)}
                      className="accent-purple-600 mr-1"
                      name={`correct-${idx}`}
                      disabled={!showPollForm}
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!opt.isCorrect}
                      onChange={() => handleCorrectChange(idx, false)}
                      className="accent-purple-600 mr-1"
                      name={`correct-${idx}`}
                      disabled={!showPollForm}
                    />
                    No
                  </label>
                </div>
              </div>
            ))}
            <button
              className="border border-purple-500 text-purple-600 px-4 py-2 rounded mt-2 mb-8 hover:bg-purple-50"
              onClick={addOption}
              type="button"
              disabled={!showPollForm}
            >
              + Add More option
            </button>
            {/* Ask Question Button */}
            <div className="flex justify-end">
              <button
                className="bg-gradient-to-r from-purple-500 to-purple-300 text-white px-10 py-3 rounded-full text-lg font-medium shadow-md hover:from-purple-600 hover:to-purple-400 transition-colors"
                onClick={handleAskQuestion}
                disabled={!showPollForm}
              >
                Ask Question
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-xl mt-12">
            <h2 className="text-2xl font-bold mb-4">Question</h2>
            <div className="bg-gray-800 text-white rounded-t-lg px-6 py-4 text-lg font-semibold">
              {activePoll?.question}
            </div>
            <div className="bg-white border border-purple-200 rounded-b-lg px-6 py-4">
              {activePoll?.options.map((opt: any, idx: number) => {
                const totalVotes = pollResults ? pollResults.votes.reduce((a: number, b: number) => a + b, 0) : 0;
                const percent = pollResults && totalVotes > 0 ? (pollResults.votes[idx] / totalVotes) * 100 : 0;
                return (
                  <div key={idx} className="mb-3">
                    <div className={`flex items-center p-2 rounded border ${pollResults && pollResults.votes[idx] > 0 ? "border-purple-500 bg-purple-100" : "border-gray-200"}`}>
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 ${pollResults && pollResults.votes[idx] > 0 ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-700"}`}>{idx + 1}</span>
                      <span className="flex-1 font-medium">{opt.text}</span>
                    </div>
                    {pollResults && (
                      <div className="h-2 bg-purple-300 rounded mt-1 mb-2" style={{ width: `${percent}%` }}></div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end mt-6">
              <button
                className="bg-gradient-to-r from-purple-500 to-purple-300 text-white px-8 py-2 rounded-full text-lg font-medium shadow-md hover:from-purple-600 hover:to-purple-400 transition-colors"
                onClick={() => {
                  setShowPollForm(true);
                  setQuestion("");
                  setOptions([
                    { text: "", isCorrect: false },
                    { text: "", isCorrect: false },
                  ]);
                  setPollResults(null);
                }}
              >
                + Ask a new question
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          className="fixed bottom-8 right-8 bg-purple-600 text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center text-3xl z-50 hover:bg-purple-700 transition-colors"
          onClick={() => setChatOpen(true)}
          aria-label="Open chat"
        >
          <span>💬</span>
        </button>
      )}
      {/* Chat/Participants Panel as floating widget */}
      {chatOpen && (
        <div className="fixed bottom-8 right-8 w-96 bg-white rounded shadow-lg border border-gray-200 z-50">
          <div className="flex border-b border-gray-200 relative">
            <button
              className={`flex-1 py-3 font-semibold ${tab === 'chat' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
              onClick={() => setTab('chat')}
            >
              Chat
            </button>
            <button
              className={`flex-1 py-3 font-semibold ${tab === 'participants' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
              onClick={() => setTab('participants')}
            >
              Participants
            </button>
            <button
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 text-xl"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          {tab === 'chat' ? (
            <div className="p-4 h-80 overflow-y-auto flex flex-col">
              {chat.map((msg, idx) => (
                <div key={idx} className={`mb-2 ${msg.user === 'Teacher' ? 'text-right' : 'text-left'}`}>
                  <span className={`text-xs font-semibold ${msg.user === 'Teacher' ? 'text-purple-600' : 'text-blue-600'}`}>{msg.user}</span>
                  <div className={`inline-block px-3 py-2 rounded-lg ${msg.user === 'Teacher' ? 'bg-purple-100 text-purple-800' : 'bg-gray-800 text-white'}`}>{msg.text}</div>
                </div>
              ))}
              <div className="mt-auto flex">
                <input
                  className="flex-1 border rounded-l px-3 py-2"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                />
                <button
                  className="bg-purple-600 text-white px-4 py-2 rounded-r"
                  onClick={handleSendChat}
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 h-80 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((name, idx) => (
                    <tr key={idx}>
                      <td className="py-1">{name}</td>
                      <td className="py-1 text-blue-600 cursor-pointer hover:underline" onClick={() => handleKickOut(name)}>Kick out</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 