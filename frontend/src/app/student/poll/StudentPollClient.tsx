"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

let socket: Socket;

interface PollOption {
  text: string;
  // isCorrect is not typically sent to students during voting
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  startTime: number;
  duration: number;
  isActive: boolean;
  isShowingResults: boolean;
}

interface PollResults {
  votes: number[];
  answers: { [studentId: string]: boolean };
}

interface ChatMessage {
  user: string;
  text: string;
}

export default function StudentPollClient() {
  const searchParams = useSearchParams();
  const [clientName, setClientName] = useState<string>('');
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [waiting, setWaiting] = useState<boolean>(true);
  const [timer, setTimer] = useState<number | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [pollResults, setPollResults] = useState<PollResults | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<'chat' | 'participants'>('chat');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [kickedOut, setKickedOut] = useState<boolean>(false);

  useEffect(() => {
    const sessionName = sessionStorage.getItem('studentName');
    const paramName = searchParams.get("name");
    const effectiveName = sessionName || paramName || "";
    setClientName(effectiveName);

    socket = io("https://socket-polling-api.onrender.com");
    socket.emit("registerStudent", effectiveName); // Use the consistent effectiveName

    socket.on("newPoll", (pollData: Poll | null) => {
      if (pollData && pollData.isActive) { // Voting is active
        setPoll(pollData);
        setSelected(null);
        const submittedPolls = JSON.parse(sessionStorage.getItem('submittedPolls') || '{}');
        setSubmitted(!!submittedPolls[pollData.id]);
        setWaiting(false);
        setShowResults(false);
        setPollResults(null); // Clear previous results

        if (pollData.startTime && pollData.duration) {
          const elapsedTime = Math.floor((Date.now() - pollData.startTime) / 1000);
          const remainingTime = Math.max(0, pollData.duration - elapsedTime);
          setTimer(remainingTime);
        } else {
          setTimer(pollData.duration || 0);
        }
      } else if (pollData && pollData.isShowingResults) { // Results are being shown for the last poll
        setPoll(pollData); // Keep poll data to display question
        setWaiting(false);
        setShowResults(true); // Results will be populated by 'pollVotingClosed'
        // Timer might still be relevant if it's counting down the results view duration, or just display static
      } else { // No active poll, or poll cycle fully ended
        setPoll(null);
        setWaiting(true);
        setShowResults(false);
        setPollResults(null);
        setTimer(null);
        setSelected(null);
        setSubmitted(false);
      }
    });

    socket.on("pollVotingClosed", (data: { pollId: string, results: PollResults }) => {
      if (poll && poll.id === data.pollId) {
        setPollResults(data.results);
        setShowResults(true);
        setWaiting(false);
        // Update local poll state to reflect it's no longer active for voting
        setPoll(prevPoll => {
          if (prevPoll) { // Ensure prevPoll is not null
            return { ...prevPoll, isActive: false, isShowingResults: true };
          }
          return null; // Should not happen in this flow, but good for type safety
        });
      }
    });

    socket.on("clearActivePoll", () => {
      setPoll(null);
      setWaiting(true);
      setShowResults(false);
      setPollResults(null);
      setTimer(null);
      setSelected(null);
      setSubmitted(false);
    });

    socket.on("kickedOut", () => {
      setKickedOut(true);
    });
    socket.on("participants", (list: string[]) => {
      setParticipants(list);
    });
    socket.on("pollResults", (results: PollResults) => {
      setPollResults(results);
      // setShowResults(true); // This was causing all students to prematurely see the results view.
                           // Individual submission success or pollClosed event will handle showing results.
    });
    // Real-time chat
    socket.on("chatHistory", (history: ChatMessage[]) => {
      setChat(history);
    });
    socket.on("chatMessage", (msg: ChatMessage) => {
      setChat((prevChat) => [...prevChat, msg]);
    });
    return () => {
      socket.disconnect();
    };
  }, [searchParams]); // Added searchParams to dependency array

  // Timer countdown - This useEffect now only runs if a poll is active for voting.
  useEffect(() => {
    if (!poll || !poll.isActive || typeof poll.startTime !== 'number' || typeof poll.duration !== 'number') {
      // If poll is not active for voting, or timing data is missing, clear timer.
      if (timer !== null && timer !== 0 && !poll?.isShowingResults) setTimer(0); // Set to 0 if it was running
      return;
    }

    const calculateRemaining = () => {
      const elapsedSeconds = Math.floor((Date.now() - poll.startTime) / 1000);
      return Math.max(0, poll.duration - elapsedSeconds);
    };

    const initialRemaining = calculateRemaining();
    setTimer(initialRemaining);

    if (initialRemaining <= 0) {
      // Server will handle poll closure, client just reflects timer.
      // setShowResults(true) will be handled by 'pollVotingClosed' event.
      return; 
    }

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        // Server will emit 'pollVotingClosed' which handles UI transition to results.
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [poll]); // Rerun effect if poll data changes (especially poll.id or poll.isActive)

  const handleSubmit = () => {
    if (poll && selected !== null && !submitted) {
      socket.emit(
        "submitAnswer",
        // Use clientName for consistency, though server now uses socket.id for uniqueness
        { pollId: poll.id, optionIdx: selected, studentId: clientName },
        (res: { success: boolean; error?: string }) => {
          if (res.success) {
            setSubmitted(true); // Mark as submitted, but don't force showResults yet
            const submittedPolls = JSON.parse(sessionStorage.getItem('submittedPolls') || '{}');
            submittedPolls[poll.id] = true;
            sessionStorage.setItem('submittedPolls', JSON.stringify(submittedPolls));
            // setShowResults(true); // Let global poll end events handle this
          }
        }
      );
    }
  };

  const handleSendChat = () => {
    if (chatInput.trim() && clientName) { // Check and use clientName
      const msg = { user: clientName, text: chatInput }; // Use clientName
      socket.emit('chatMessage', msg);
      setChatInput("");
    }
  };

  let content;

  if (kickedOut) {
    content = (
      // Removed redundant full-screen wrapper. Parent div handles centering.
      <>
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
      </>
    );
  } else if (waiting) {
    content = (
      // Removed redundant full-screen wrapper. Parent div handles centering.
      <>
        <div className="mb-8">
          <span className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full">
            <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
            Intervue Poll
          </span>
        </div>
        <div className="text-5xl text-purple-600 mb-4 animate-spin">C</div>
        <div className="text-2xl font-bold">Wait for the teacher to ask questions..</div>
      </>
    );
  } else if (showResults && poll) { // Changed condition: show results if showResults is true and poll exists
    // Poll results (bars, votes) will be shown conditionally if pollResults object is available
    const totalVotes = pollResults ? pollResults.votes.reduce((a: number, b: number) => a + b, 0) : 0;
    content = (
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Question</h2>
          <span className="text-lg font-semibold">
            {timer !== null && (
              <span className={timer <= 10 ? "text-red-500" : ""}>
                ⏱ {timer < 10 ? `00:0${timer}` : `00:${timer}`}
              </span>
            )}
          </span>
        </div>
        <div className="bg-gray-800 text-white rounded-t-lg px-6 py-4 text-lg font-semibold">
            {poll.question}
          </div>
          <div className="bg-white border border-purple-200 rounded-b-lg px-6 py-4">
            {poll.options.map((opt: any, idx: number) => {
              const voteCount = pollResults && pollResults.votes ? pollResults.votes[idx] : 0;
              const percent = pollResults && totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
              return (
                <div key={idx} className="mb-3">
                  <div className={`flex items-center p-2 rounded border ${pollResults && voteCount > 0 ? "border-purple-500 bg-purple-100" : "border-gray-200"}`}>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 ${pollResults && voteCount > 0 ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-700"}`}>{idx + 1}</span>
                    <span className="flex-1 font-medium">{opt.text}</span>
                    {/* Show vote count */}
                    <span className="ml-2 text-gray-500 text-sm">{voteCount} vote{voteCount !== 1 ? "s" : ""}</span>
                  </div>
                  {/* Progress bar */}
                  {pollResults && (
                    <div className="relative h-2 bg-purple-100 rounded mt-1 mb-2 overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-2 bg-purple-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-gray-500 mt-6">
            Wait for the teacher to ask a new question.
          </p>
        </div>
    );
  } else if (poll) { // Default: Active poll voting view 
    const totalVotes = pollResults ? pollResults.votes.reduce((a: number, b: number) => a + b, 0) : 0;
    content = (
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
            const voteCount = pollResults && pollResults.votes ? pollResults.votes[idx] : 0;
            const percent = pollResults && totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            const isSelected = selected === idx;
            return (
              <div key={idx} className="mb-3">
                <div
                  className={`flex items-center p-2 rounded border transition-all duration-200 ${
                    isSelected
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200"
                  }`}
                  onClick={() => !submitted && setSelected(idx)}
                  style={{ cursor: submitted ? 'not-allowed' : 'pointer' }}
                >
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 ${
                    isSelected
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}>
                  {idx + 1}
                  </span>
                  <span className="flex-1 font-medium">{opt.text}</span>
                  {/* Show vote count in real time */}
                  {pollResults && (
                    <span className="ml-2 text-gray-500 text-sm">{voteCount} vote{voteCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
                {/* Progress bar */}
                {pollResults && (
                  <div className="relative h-2 bg-purple-100 rounded mt-1 mb-2 overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-2 bg-purple-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
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
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white relative">
      {content}
      
      {/* Floating Chat Button and Panel - Conditionally render if not kickedOut */}
      {!kickedOut && (
        <>
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 bg-purple-600 text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center text-3xl hover:bg-purple-700 transition-colors"
              aria-label="Open chat"
            >
              <span>💬</span>
            </button>
          )}

          {/* Chat Panel */}
          {chatOpen && (
            <div className="fixed bottom-0 right-0 mb-6 mr-6 w-80 h-96 bg-white rounded-lg shadow-xl flex flex-col">
              {/* Header with Tabs and Close Button */}
              <div className="p-3 border-b flex justify-between items-center">
            <div>
              <button
                onClick={() => setTab('chat')}
                className={`px-3 py-1 text-sm rounded ${tab === 'chat' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Chat
              </button>
              <button
                onClick={() => setTab('participants')}
                className={`px-3 py-1 text-sm rounded ml-1 ${tab === 'participants' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Participants ({participants.length})
              </button>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close chat">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-grow p-3 overflow-y-auto">
            {tab === 'chat' && (
              <div className="space-y-2">
                {chat.map((msg, index) => (
                  <div key={index} className={`p-2 rounded-lg max-w-[80%] ${msg.user === clientName ? 'bg-purple-500 text-white self-end ml-auto' : 'bg-gray-200 text-gray-800 self-start'}`}>
                    <p className="text-xs font-semibold">{msg.user === clientName ? 'You' : msg.user}</p>
                    <p>{msg.text}</p>
                  </div>
                ))}
                 {chat.length === 0 && <p className="text-sm text-gray-400 text-center">No messages yet.</p>}
              </div>
            )}
            {tab === 'participants' && (
              <ul className="space-y-1">
                {participants.map((pName, index) => (
                  <li key={index} className="text-sm text-gray-700 p-1">
                    {pName} {pName === clientName && "(You)"}
                  </li>
                ))}
                {participants.length === 0 && <p className="text-sm text-gray-400 text-center">No participants yet.</p>}
              </ul>
            )}
          </div>

          {/* Input Area (only for chat tab) */}
          {tab === 'chat' && (
            <div className="p-3 border-t">
              <div className="flex">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Type a message..."
                  className="flex-grow border rounded-l-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  onClick={handleSendChat}
                  className="bg-purple-600 text-white px-4 py-2 rounded-r-md hover:bg-purple-700 text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
