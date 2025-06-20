"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentJoin() {
  const [name, setName] = useState("");
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="mb-8">
        <span className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full">
          <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
          Intervue Poll
        </span>
      </div>
      <h1 className="text-4xl font-bold mb-2">Let's <span className="font-extrabold">Get Started</span></h1>
      <p className="text-gray-500 mb-8 max-w-xl text-center">
        If you're a student, you'll be able to <b>submit your answers</b>, participate in live polls, and see how your responses compare with your classmates
      </p>
      <div className="mb-4">
        <label className="block font-semibold mb-2">Enter your Name</label>
        <input
          className="w-96 px-4 py-2 rounded bg-gray-100"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>
      <button
        className="mt-6 bg-gradient-to-r from-purple-500 to-purple-300 text-white px-10 py-3 rounded-full text-lg font-medium shadow-md hover:from-purple-600 hover:to-purple-400 transition-colors"
        disabled={!name.trim()}
        onClick={() => {
          if (name.trim()) {
            // Store name in sessionStorage for poll page
            sessionStorage.setItem('studentName', name);
            router.push(`/student/poll`);
          }
        }}
      >
        Continue
      </button>
    </div>
  );
} 