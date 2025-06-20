"use client"

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

let socket: Socket;

export default function StudentPoll() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const [poll, setPoll] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [timer, setTimer] = useState<number | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [pollResults, setPollResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'participants'>('chat');
  const [chat, setChat] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [kickedOut, setKickedOut] = useState(false);

  useEffect(() => {
    socket = io("https://socket-polling-api.onrender.com");
    const studentName = sessionStorage.getItem('studentName') || '';
    socket.emit("registerStudent", studentName);
    socket.on("newPoll", (pollData: any) => {
      setPoll(pollData);
      setSelected(null);
      setSubmitted(false);
      setWaiting(false);
      setTimer(60);
      setPollResults(null);
      setShowResults(false);
    });
    socket.on("pollClosed", () => {
      setShowResults(true);
    });
    socket.on("kickedOut", () => {
      setKickedOut(true);
    });
    socket.on("participants", (list: string[]) => {
      setParticipants(list);
    });
    socket.on("pollResults", (results: any) => {
      setPollResults(results);
      setShowResults(true);
    });
    // Real-time chat
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

  // Timer countdown
  useEffect(() => {
    if (timer === null || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t && t > 0) return t - 1;
        setShowResults(true);
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSubmit = () => {
    if (poll && selected !== null && !submitted) {
      socket.emit(
        "submitAnswer",
        { pollId: poll.id, optionIdx: selected, studentId: name },
        (res: any) => {
          if (res.success) {
            setSubmitted(true);
            setShowResults(true);
          }
        }
      );
    }
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      const msg = { user: name, text: chatInput };
      socket.emit('chatMessage', msg);
      setChatInput("");
    }
  };

  if (kickedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="mb-8">
          <span className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full">
            <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
            Intervue Poll
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-2">You've been Kicked out !</h1>
        <p className="text-gray-400 text-lg max-w-xl text-center">
          Looks like the teacher had removed you from the poll system .Please<br />Try again sometime.
        </p>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="mb-8">
          <span className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full">
            <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
            Intervue Poll
          </span>
        </div>
        <div className="text-5xl text-purple-600 mb-4 animate-spin">C</div>
        <div className="text-2xl font-bold">Wait for the teacher to ask questions..</div>
      </div>
    );
  }

  // Always show results box and live bars
  const totalVotes = pollResults ? pollResults.votes.reduce((a: number, b: number) => a + b, 0) : 0;

  // Show results if submitted or timer ran out
  if (showResults && poll && pollResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-full max-w-xl">
          <h2 className="text-2xl font-bold mb-4">Question</h2>
          <div className="bg-gray-800 text-white rounded-t-lg px-6 py-4 text-lg font-semibold">
            {poll?.question}
          </div>
          <div className="bg-white border border-purple-200 rounded-b-lg px-6 py-4">
            {poll?.options.map((opt: any, idx: number) => {
              const percent = totalVotes > 0 ? (pollResults.votes[idx] / totalVotes) * 100 : 0;
              return (
                <div key={idx} className="mb-3">
                  <div className={`flex items-center p-2 rounded border ${pollResults.votes[idx] > 0 ? "border-purple-500 bg-purple-100" : "border-gray-200"}`}>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 ${pollResults.votes[idx] > 0 ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-700"}`}>{idx + 1}</span>
                    <span className="flex-1 font-medium">{opt.text}</span>
                  </div>
                  <div className="h-2 bg-purple-300 rounded mt-1 mb-2" style={{ width: `${percent}%` }}></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-full max-w-xl">
        <div className="flex items-center mb-4">
          <span className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full mr-4">
            <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
            Intervue Poll
          </span>
          <span className="ml-auto text-lg font-semibold">
            {timer !== null && (
              <span className={timer <= 10 ? "text-red-500" : ""}>
                ⏱ {timer < 10 ? `00:0${timer}` : `00:${timer}`}
              </span>
            )}
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-4">Question</h2>
        <div className="bg-gray-800 text-white rounded-t-lg px-6 py-4 text-lg font-semibold">
          {poll?.question}
        </div>
        <div className="bg-white border border-purple-200 rounded-b-lg px-6 py-4">
          {poll?.options.map((opt: any, idx: number) => {
            const percent = pollResults && totalVotes > 0 ? (pollResults.votes[idx] / totalVotes) * 100 : 0;
            const isSelected = selected === idx;
            return (
              <div key={idx} className="mb-3">
                <div
                  className={`flex items-center p-2 rounded border transition-all duration-200 ${
                    isSelected
                      ? "border-purple-500 bg-purple-50"
                      : pollResults && pollResults.votes[idx] > 0
                      ? "border-purple-500 bg-purple-100"
                      : "border-gray-200"
                  }`}
                  onClick={() => !submitted && setSelected(idx)}
                  style={{ cursor: submitted ? 'default' : 'pointer' }}
                >
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 ${
                    isSelected || (pollResults && pollResults.votes[idx] > 0)
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-medium">{opt.text}</span>
                </div>
                <div className="h-2 bg-purple-300 rounded mt-1 mb-2" style={{ width: `${percent}%` }}></div>
              </div>
            );
          })}
        </div>
        <button
          className="mt-8 bg-gradient-to-r from-purple-500 to-purple-300 text-white px-10 py-3 rounded-full text-lg font-medium shadow-md hover:from-purple-600 hover:to-purple-400 transition-colors"
          disabled={selected === null || submitted}
          onClick={handleSubmit}
        >
          {submitted ? "Submitted" : "Submit"}
        </button>
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
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-1">{p}</td>
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