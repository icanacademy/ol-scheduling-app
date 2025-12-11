import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import Dashboard from './components/Dashboard';
import TeachersPage from './components/TeachersPage';
import StudentsPage from './components/StudentsPage';
import StudentPrintPage from './components/StudentPrintPage';
import TeacherPrintPage from './components/TeacherPrintPage';
import BackupRestorePage from './components/BackupRestorePage';
import DayWrapper from './components/DayWrapper';
import ChatBubble from './components/ChatBubble';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

function App() {
  const [selectedDay, setSelectedDay] = useState('All Week');
  const [activeTab, setActiveTab] = useState('schedule');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-green-100">
        <header className="bg-green-100">
          <div className="max-w-full mx-auto px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <img
                  src="/assets/ican-logo.png"
                  alt="ICAN Logo"
                  className="h-12 w-auto bg-gradient-to-br from-blue-500 to-blue-700 p-2 rounded-lg shadow-md"
                />
                <h1 className="text-4xl font-bold text-blue-600 tracking-wide">
                  Online Scheduler
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {['All Week', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      selectedDay === day
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b-2 border-gray-200">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-6 py-3 font-semibold text-base border-b-3 transition-all ${
                  activeTab === 'schedule'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => setActiveTab('teachers')}
                className={`px-6 py-3 font-semibold text-base border-b-3 transition-all ${
                  activeTab === 'teachers'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Teachers
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`px-6 py-3 font-semibold text-base border-b-3 transition-all ${
                  activeTab === 'students'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Students
              </button>
              <button
                onClick={() => setActiveTab('student-report')}
                className={`px-6 py-3 font-semibold text-base border-b-3 transition-all ${
                  activeTab === 'student-report'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Student Schedule Sheet
              </button>
              <button
                onClick={() => setActiveTab('teacher-report')}
                className={`px-6 py-3 font-semibold text-base border-b-3 transition-all ${
                  activeTab === 'teacher-report'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Teacher Schedule Sheet
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                className={`px-6 py-3 font-semibold text-base border-b-3 transition-all ${
                  activeTab === 'backups'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Backups
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-full mx-auto p-8">
          {activeTab === 'schedule' && <Dashboard selectedDay={selectedDay} />}
          {activeTab === 'teachers' && <DayWrapper selectedDay={selectedDay} Component={TeachersPage} />}
          {activeTab === 'students' && <DayWrapper selectedDay={selectedDay} Component={StudentsPage} />}
          {activeTab === 'student-report' && <DayWrapper selectedDay={selectedDay} Component={StudentPrintPage} />}
          {activeTab === 'teacher-report' && <DayWrapper selectedDay={selectedDay} Component={TeacherPrintPage} />}
          {activeTab === 'backups' && <BackupRestorePage />}
        </main>

        {/* AI Chat Assistant */}
        <ChatBubble />
      </div>
    </QueryClientProvider>
  );
}

export default App;
