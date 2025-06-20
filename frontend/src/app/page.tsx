"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Component() {
  const [selectedRole, setSelectedRole] = useState<string>("")
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-32 h-32 bg-purple-100 rounded-full opacity-30"></div>
        <div className="absolute top-40 right-40 w-20 h-20 bg-purple-200 rounded-full opacity-20"></div>
        <div className="absolute bottom-32 left-20 w-24 h-24 bg-purple-100 rounded-full opacity-25"></div>
        <div className="absolute bottom-20 left-40 w-16 h-16 bg-purple-200 rounded-full opacity-30"></div>
        <div className="absolute top-1/3 left-1/4 w-12 h-12 bg-purple-100 rounded-full opacity-20"></div>
        <div className="absolute top-2/3 right-1/3 w-14 h-14 bg-purple-200 rounded-full opacity-25"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-2xl mx-auto text-center space-y-8">
          {/* Header Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-full">
              <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
              Interview Poll
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Welcome to the <span className="text-purple-600">Live Polling System</span>
            </h1>
            <p className="text-gray-600 text-lg max-w-lg mx-auto">
              Please select the role that best describes you to begin using the live polling system
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Student Card */}
            <div
              className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedRole === "student"
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 bg-white hover:border-purple-300"
              }`}
              onClick={() => setSelectedRole("student")}
            >
              <div className="text-left space-y-3">
                <h3 className="text-xl font-semibold text-gray-900">I'm a Student</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Lorem Ipsum is simply dummy text of the printing and typesetting industry.
                </p>
              </div>
            </div>

            {/* Teacher Card */}
            <div
              className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedRole === "teacher"
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 bg-white hover:border-purple-300"
              }`}
              onClick={() => setSelectedRole("teacher")}
            >
              <div className="text-left space-y-3">
                <h3 className="text-xl font-semibold text-gray-900">I'm a Teacher</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Submit answers and view live poll results in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="pt-8">
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-3 rounded-full text-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedRole}
              onClick={() => {
                if (selectedRole === "teacher") {
                  router.push("/teacher")
                } else if (selectedRole === "student") {
                  router.push("/student")
                }
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
