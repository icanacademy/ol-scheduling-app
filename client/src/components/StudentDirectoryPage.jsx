import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudentDirectory, updateStudentStatus, updateStudentDirectoryFields, deleteStudent } from '../services/api';

const STATUS_OPTIONS = ['New', 'Active', 'On Hold', 'Finished'];
const STATUS_COLORS = {
  'New': 'bg-blue-100 text-blue-800',
  'Active': 'bg-green-100 text-green-800',
  'On Hold': 'bg-yellow-100 text-yellow-800',
  'Finished': 'bg-gray-100 text-gray-800',
};

function StudentDirectoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [editingStudent, setEditingStudent] = useState(null);

  // Fetch student directory
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['student-directory'],
    queryFn: async () => {
      const response = await getStudentDirectory();
      return response.data;
    },
  });

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateStudentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['student-directory']);
    },
  });

  // Update fields mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStudentDirectoryFields(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['student-directory']);
      setEditingStudent(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries(['student-directory']);
      queryClient.invalidateQueries(['students']);
    },
  });

  const handleDelete = (student) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${student.name}"?\n\nThis will remove the student from all dates and cannot be undone.`
    );
    if (confirmed) {
      deleteMutation.mutate(student.id);
    }
  };

  // Get unique grades for filter
  const uniqueGrades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();

  // Filter and sort students
  const filteredStudents = students
    .filter(student => {
      const matchesSearch =
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.english_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.korean_name?.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter;
      return matchesSearch && matchesStatus && matchesGrade;
    })
    .sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStatusChange = (studentId, newStatus) => {
    statusMutation.mutate({ id: studentId, status: newStatus });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatScheduleDays = (scheduleDays) => {
    if (!scheduleDays || !Array.isArray(scheduleDays)) return '-';
    const dayMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    return scheduleDays.map(d => dayMap[d] || d).join(', ');
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Count by status
  const statusCounts = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = students.filter(s => s.status === status).length;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Student Directory</h2>
          <p className="text-gray-500 text-sm mt-1">
            {students.length} total students
          </p>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STATUS_OPTIONS.map(status => (
          <div
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            className={`p-4 rounded-lg cursor-pointer transition-all ${
              statusFilter === status ? 'ring-2 ring-blue-500' : ''
            } ${STATUS_COLORS[status]}`}
          >
            <div className="text-2xl font-bold">{statusCounts[status] || 0}</div>
            <div className="text-sm font-medium">{status}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        {/* Grade Filter */}
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Grades</option>
          {uniqueGrades.map(grade => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>

        {/* Clear Filters */}
        {(searchTerm || statusFilter !== 'all' || gradeFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setGradeFilter('all');
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading students...</div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No students found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  onClick={() => handleSort('grade')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                >
                  Grade <SortIcon field="grade" />
                </th>
                <th
                  onClick={() => handleSort('country')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                >
                  Country <SortIcon field="country" />
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Subjects
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Class Days
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Class Times
                </th>
                <th
                  onClick={() => handleSort('program_start_date')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                >
                  Program Start <SortIcon field="program_start_date" />
                </th>
                <th
                  onClick={() => handleSort('program_end_date')}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                >
                  Program End <SortIcon field="program_end_date" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{student.name}</div>
                      {student.korean_name && (
                        <div className="text-sm text-gray-500">{student.korean_name}</div>
                      )}
                      {student.english_name && student.english_name !== student.name && student.english_name !== student.korean_name && (
                        <div className="text-sm text-gray-400">{student.english_name}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {student.grade || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingStudent === student.id ? (
                      <input
                        type="text"
                        defaultValue={student.country || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (student.country || '')) {
                            updateMutation.mutate({ id: student.id, data: { country: e.target.value } });
                          } else {
                            setEditingStudent(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                          } else if (e.key === 'Escape') {
                            setEditingStudent(null);
                          }
                        }}
                        className="w-full px-2 py-1 border rounded"
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => setEditingStudent(student.id)}
                        className="cursor-pointer hover:text-blue-600"
                      >
                        {student.country || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={student.status || 'Active'}
                      onChange={(e) => handleStatusChange(student.id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${
                        STATUS_COLORS[student.status] || STATUS_COLORS['Active']
                      }`}
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {student.subjects && Array.isArray(student.subjects) && student.subjects.length > 0
                      ? student.subjects.join(', ')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatScheduleDays(student.schedule_days)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {student.class_times && Array.isArray(student.class_times) && student.class_times.length > 0
                      ? student.class_times.slice(0, 3).join(', ') + (student.class_times.length > 3 ? '...' : '')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(student.program_start_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(student.program_end_date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingStudent(editingStudent === student.id ? null : student.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {editingStudent === student.id ? 'Done' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDelete(student)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {filteredStudents.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredStudents.length} of {students.length} students
        </div>
      )}
    </div>
  );
}

export default StudentDirectoryPage;
